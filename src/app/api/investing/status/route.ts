import { api } from '@/server/http/api';
import { assertInvesting, dataStatus } from '@/server/services/investing';

export const GET = api('user', async ({ auth }) => {
  const { user } = auth!;
  assertInvesting(user);
  return dataStatus(user);
});
