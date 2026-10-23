import { watchlistCreateSchema } from '@/lib/validation/investing';
import { api } from '@/server/http/api';
import { assertInvesting, createInstrument, ensureStarter, listWatchlist, watchlistDto } from '@/server/services/investing';

export const GET = api('user', async ({ auth }) => {
  const { user } = auth!;
  assertInvesting(user);
  await ensureStarter(user);
  return { watchlist: (await listWatchlist(user._id)).map(watchlistDto) };
});

export const POST = api('user', async ({ body, auth }) => {
  const { user } = auth!;
  assertInvesting(user);
  const { doc, warn } = await createInstrument(user._id, await body(watchlistCreateSchema));
  return { instrument: watchlistDto(doc), warnLarge: warn };
});
