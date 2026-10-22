import { inviteCreateSchema } from '@/lib/validation/auth';
import { randomToken, tokenId } from '@/server/auth/crypto';
import { col } from '@/server/db/collections';
import { env } from '@/server/env';
import { api } from '@/server/http/api';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const GET = api('owner', async ({ auth }) => {
  const { invites } = await col();
  const list = await invites
    .find({ createdBy: auth!.user._id, usedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return { invites: list.map((i) => ({ id: i._id, note: i.note, createdAt: i.createdAt, expiresAt: i.expiresAt })) };
});

export const POST = api('owner', async ({ body, auth }) => {
  const { note } = await body(inviteCreateSchema);
  const token = randomToken(24);
  const now = new Date();
  const { invites } = await col();
  const doc = {
    _id: tokenId(token),
    createdBy: auth!.user._id,
    note,
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    usedAt: null,
    usedBy: null,
  };
  await invites.insertOne(doc);
  // The link is shown once; only the keyed hash is stored.
  return { id: doc._id, url: new URL(`/invite/${token}`, env().APP_URL).toString(), expiresAt: doc.expiresAt };
});
