import 'server-only';
import type { ObjectId } from 'mongodb';
import { addMonthsToMonth, monthOf, toLocalDate } from '@/lib/dates';
import { buildPlan, DEFAULT_PLAN_SETTINGS, type PlanGoal, type PlanSettings } from '@/lib/plan';
import { monthlyEquivalent } from '@/lib/recurrence';
import { col } from '@/server/db/collections';
import type { UserDoc } from '@/server/db/types';
import { listGoals } from './goals';

export function planSettings(user: Pick<UserDoc, 'settings'>): PlanSettings {
  return { ...DEFAULT_PLAN_SETTINGS, ...(user.settings.plan ?? {}) };
}

/**
 * Gathers the Smart Plan inputs for the user's current month (docs/allocation-methodology.md section 3) and builds
 * the plan. Complete months only: the current month never shifts its own plan.
 */
export async function loadPlan(user: UserDoc, now = new Date(), taxReserveDueMinor = 0) {
  const c = await col();
  const userId: ObjectId = user._id;
  const settings = planSettings(user);
  const today = toLocalDate(now, user.timezone);
  const current = monthOf(today);
  const window = Array.from({ length: settings.baselineWindowMonths }, (_, i) => addMonthsToMonth(current, i - settings.baselineWindowMonths));
  const essentialsWindow = window.slice(-settings.essentialsWindowMonths);

  const [sources, expenses, categories, budgets, txs, goals] = await Promise.all([
    c.incomeSources.find({ userId }).toArray(),
    c.recurringExpenses.find({ userId, active: true }).toArray(),
    c.categories.find({ userId, kind: 'expense' }).toArray(),
    c.budgets.find({ userId }).toArray(),
    c.transactions.find({ userId, status: 'done', month: { $gte: window[0]!, $lte: current } }).toArray(),
    listGoals(userId, user.timezone, now),
  ]);

  const sourceType = new Map(sources.map((s) => [s._id.toHexString(), s.type]));
  const typeOf = (id: ObjectId | null) => (id ? (sourceType.get(id.toHexString()) ?? 'one_time') : 'one_time');
  const catById = new Map(categories.map((x) => [x._id.toHexString(), x]));
  const top = (id: ObjectId | null) => {
    let cat = id ? catById.get(id.toHexString()) : undefined;
    while (cat?.parentId) cat = catById.get(cat.parentId.toHexString());
    return cat;
  };

  // Baseline: fixed sources at their monthly equivalent; variable income per complete month, starting with the first
  // month that had a received variable payment.
  const fixedSources = sources.filter((s) => s.active && s.type === 'recurring_fixed' && s.schedule && s.expectedNetMinor);
  const variableByMonth = new Map<string, number>();
  for (const t of txs) {
    if (t.kind !== 'income' || typeOf(t.incomeSourceId) !== 'recurring_variable' || t.month === current) continue;
    variableByMonth.set(t.month, (variableByMonth.get(t.month) ?? 0) + t.amountMinor);
  }
  const firstVariable = [...variableByMonth.keys()].sort()[0];
  const variableMonths = firstVariable ? window.filter((m) => m >= firstVariable).map((m) => ({ month: m, totalMinor: variableByMonth.get(m) ?? 0 })) : [];

  // Essentials: fixed essential costs + per essential category max(average of complete months, budget).
  const fixedEssential = expenses
    .filter((e) => (!e.subscription || e.subscription.status === 'active') && top(e.categoryId)?.essential)
    .map((e) => ({ name: e.name, monthlyMinor: monthlyEquivalent(e.amountMinor, e.schedule.frequency) }));
  const essentialTops = categories.filter((x) => !x.parentId && x.essential);
  const essentialRows = essentialTops.map((cat) => {
    const totals = essentialsWindow.map((m) =>
      txs.filter((t) => t.kind === 'expense' && !t.recurringExpenseId && t.month === m && top(t.categoryId)?._id.equals(cat._id)).reduce((s, t) => s + t.amountMinor, 0),
    );
    const firstMonthWithData = essentialsWindow.findIndex((m) => txs.some((t) => t.kind === 'expense' && t.month === m));
    return {
      categoryId: cat._id.toHexString(),
      name: cat.name,
      monthTotals: firstMonthWithData === -1 ? [] : totals.slice(firstMonthWithData),
      budgetMonthlyMinor: budgets.find((b) => b.categoryId?.equals(cat._id))?.amountMinor ?? null,
    };
  });

  // Profile: received income of the complete months by source type.
  const received = { recurring_fixed: 0, recurring_variable: 0, one_time: 0 };
  for (const t of txs) if (t.kind === 'income' && t.month !== current) received[typeOf(t.incomeSourceId)] += t.amountMinor;

  const ef = goals.find((g) => g.goal.isEmergencyFund);
  const planGoals: PlanGoal[] = goals
    .filter((g) => !g.goal.isEmergencyFund)
    .map((g) => ({
      id: g.goal._id.toHexString(),
      name: g.goal.name,
      targetMinor: g.goal.targetMinor,
      savedMinor: g.savedMinor - (g.contributions.find((x) => x.planMonth === current)?.amountMinor ?? 0),
      deadline: g.goal.deadline ? monthOf(g.goal.deadline) : null,
      priority: g.goal.priority,
      isEmergencyFund: false,
      createdSeq: g.goal.seq,
    }));

  const plan = buildPlan({
    todayMonth: current,
    settings,
    baseline: { fixedMonthlyEquivalents: fixedSources.map((s) => monthlyEquivalent(s.expectedNetMinor!, s.schedule!.frequency)), variableMonths, manualVariableBaselineMinor: settings.manualVariableBaselineMinor },
    essentials: { fixedEssentialMonthly: fixedEssential, categories: essentialRows },
    profile: { receivedFixed6: received.recurring_fixed, receivedVariable6: received.recurring_variable, receivedOneTime6: received.one_time, hasActiveFixedSource: fixedSources.length > 0 },
    // This month's own plan contribution is excluded, so applying the plan twice gives the same result.
    emergencyGoal: ef ? { targetMinor: ef.goal.targetMinor, savedMinor: ef.savedMinor - (ef.contributions.find((x) => x.planMonth === current)?.amountMinor ?? 0) } : null,
    goals: planGoals,
    thisMonth: {
      receivedMinor: txs.filter((t) => t.kind === 'income' && t.month === current).reduce((s, t) => s + t.amountMinor, 0),
      taxReserveDueMinor,
    },
  });

  return {
    plan,
    settings,
    month: current,
    today,
    inputs: {
      fixedSources: fixedSources.map((s) => ({ name: s.name, monthlyMinor: monthlyEquivalent(s.expectedNetMinor!, s.schedule!.frequency) })),
      variableMonths,
      fixedEssential,
      emergencyGoalId: ef?.goal._id.toHexString() ?? null,
      goals: Object.fromEntries(
        goals.map((g) => [g.goal._id.toHexString(), { name: g.goal.name, priority: g.goal.priority, deadline: g.goal.deadline, requiredMonthlyMinor: g.status.requiredMonthlyMinor }]),
      ),
    },
  };
}
