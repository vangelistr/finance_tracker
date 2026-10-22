import { ObjectId } from 'mongodb';
import { applyPlanContributions } from '@/server/services/goals';
import { loadPlan } from '@/server/services/plan';
import { api } from '@/server/http/api';
import { ApiError } from '@/server/http/errors';

/** Records this month's plan amounts as goal contributions (idempotent per goal per month). */
export const POST = api('user', async ({ auth }) => {
  const { user } = auth!;
  const { plan, month, today, inputs } = await loadPlan(user);
  if (plan.routing.efMinor > 0 && !inputs.emergencyGoalId) {
    throw new ApiError(400, 'validation', 'create an emergency fund goal first', { emergencyFund: 'missing' });
  }
  const allocations = [
    ...(inputs.emergencyGoalId ? [{ goalId: new ObjectId(inputs.emergencyGoalId), amountMinor: plan.routing.efMinor }] : []),
    ...plan.routing.goals.map((g) => ({ goalId: new ObjectId(g.goalId), amountMinor: g.allocMinor })),
  ];
  await applyPlanContributions(user._id, month, today, allocations);
  return { ok: true, applied: allocations.filter((a) => a.amountMinor > 0).length };
});
