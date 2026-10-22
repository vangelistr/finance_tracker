import 'server-only';
import { ObjectId } from 'mongodb';
import { monthOf, toLocalDate, type LocalDate } from '@/lib/dates';
import { goalStatus } from '@/lib/goals';
import { col } from '@/server/db/collections';
import type { GoalDoc } from '@/server/db/types';
import { ApiError } from '@/server/http/errors';

export interface GoalInput {
  name: string;
  targetMinor: number;
  deadline: LocalDate | null;
  accountId: ObjectId | null;
  priority: number;
  isEmergencyFund: boolean;
}

/** Goals with their saved amount, contributions and computed status. */
export async function listGoals(userId: ObjectId, tz: string, now = new Date()) {
  const c = await col();
  const [goals, contributions] = await Promise.all([
    c.goals.find({ userId, archived: false }).sort({ isEmergencyFund: -1, priority: 1, seq: 1 }).toArray(),
    c.goalContributions.find({ userId }).sort({ localDate: -1 }).toArray(),
  ]);
  const today = toLocalDate(now, tz);
  return goals.map((g) => {
    const mine = contributions.filter((x) => x.goalId.equals(g._id));
    const saved = mine.reduce((s, x) => s + x.amountMinor, 0);
    return {
      goal: g,
      savedMinor: saved,
      contributions: mine,
      status: goalStatus({ targetMinor: g.targetMinor, savedMinor: saved, deadline: g.deadline, contributions: mine.map((x) => ({ month: x.month, amountMinor: x.amountMinor })) }, today),
    };
  });
}

export async function createGoal(userId: ObjectId, input: GoalInput, now = new Date()) {
  const c = await col();
  if (input.isEmergencyFund && (await c.goals.countDocuments({ userId, isEmergencyFund: true, archived: false })) > 0) {
    throw new ApiError(409, 'conflict', 'an emergency fund goal already exists', { isEmergencyFund: 'exists' });
  }
  const doc: GoalDoc = { _id: new ObjectId(), userId, ...input, archived: false, seq: await c.goals.countDocuments({ userId }), createdAt: now, updatedAt: now };
  await c.goals.insertOne(doc);
  return doc;
}

export async function updateGoal(userId: ObjectId, id: ObjectId, patch: Partial<GoalInput & { archived: boolean }>) {
  const c = await col();
  if (patch.isEmergencyFund && (await c.goals.countDocuments({ userId, isEmergencyFund: true, archived: false, _id: { $ne: id } })) > 0) {
    throw new ApiError(409, 'conflict', 'an emergency fund goal already exists', { isEmergencyFund: 'exists' });
  }
  return c.goals.findOneAndUpdate({ _id: id, userId }, { $set: { ...patch, updatedAt: new Date() } }, { returnDocument: 'after' });
}

export async function addContribution(userId: ObjectId, goalId: ObjectId, input: { amountMinor: number; localDate: LocalDate; note: string }, now = new Date()) {
  const c = await col();
  if (!(await c.goals.countDocuments({ _id: goalId, userId }, { limit: 1 }))) return null;
  const doc = {
    _id: new ObjectId(),
    userId,
    goalId,
    amountMinor: input.amountMinor,
    localDate: input.localDate,
    month: monthOf(input.localDate),
    source: 'manual' as const,
    planMonth: null,
    note: input.note,
    createdAt: now,
  };
  await c.goalContributions.insertOne(doc);
  return doc;
}

export async function removeContribution(userId: ObjectId, goalId: ObjectId, contributionId: ObjectId) {
  const c = await col();
  const res = await c.goalContributions.deleteOne({ _id: contributionId, goalId, userId });
  return res.deletedCount === 1;
}

/**
 * Records this month's Smart Plan amounts as contributions (one per goal per month). Applying again replaces the
 * month's plan amounts, so it is idempotent; a zero amount removes that month's plan contribution.
 */
export async function applyPlanContributions(userId: ObjectId, month: string, today: LocalDate, allocations: Array<{ goalId: ObjectId; amountMinor: number }>, now = new Date()) {
  const c = await col();
  for (const a of allocations) {
    if (a.amountMinor <= 0) {
      await c.goalContributions.deleteOne({ userId, goalId: a.goalId, planMonth: month });
      continue;
    }
    await c.goalContributions.updateOne(
      { userId, goalId: a.goalId, planMonth: month },
      {
        $set: { amountMinor: a.amountMinor, localDate: today, month: monthOf(today) },
        $setOnInsert: { _id: new ObjectId(), userId, goalId: a.goalId, source: 'plan', planMonth: month, note: '', createdAt: now },
      },
      { upsert: true },
    );
  }
}
