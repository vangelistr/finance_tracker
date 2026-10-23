import { createInterface } from 'node:readline/promises';
import { hashPassword } from '@/server/auth/password';
import { closeDb } from '@/server/db/client';
import { col } from '@/server/db/collections';
import { emailSchema, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/validation/auth';

// Recovery tool, run inside the app container:
//   docker compose exec app node dist/admin.mjs reset-password <email>
//   docker compose exec app node dist/admin.mjs disable-totp <email>
//   docker compose exec app node dist/admin.mjs change-email <email> <new-email>
//   docker compose exec app node dist/admin.mjs list-users

const USAGE = 'usage: admin.mjs <reset-password|disable-totp> <email> | change-email <email> <new-email> | list-users';

async function readSecret(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const value = await rl.question(prompt);
  rl.close();
  return value;
}

async function main() {
  const [command, rawEmail, rawNewEmail] = process.argv.slice(2);
  const { users, sessions } = await col();
  if (command === 'list-users') {
    for (const u of await users.find({}, { projection: { email: 1, role: 1, createdAt: 1 } }).toArray()) {
      console.log(`${u.email}\t${u.role}\t${u.createdAt.toISOString()}`);
    }
    return;
  }
  const email = rawEmail?.trim().toLowerCase();
  if (!email || (command !== 'reset-password' && command !== 'disable-totp' && command !== 'change-email')) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const user = await users.findOne({ email });
  if (!user) {
    console.error('no such user');
    process.exitCode = 1;
    return;
  }
  const now = new Date();
  if (command === 'change-email') {
    const next = emailSchema.safeParse(rawNewEmail ?? '');
    if (!next.success) {
      console.error('invalid new email');
      process.exitCode = 1;
      return;
    }
    if (await users.findOne({ email: next.data })) {
      console.error('that email is already in use');
      process.exitCode = 1;
      return;
    }
    await users.updateOne({ _id: user._id }, { $set: { email: next.data, updatedAt: now } });
    console.log('email changed');
    return;
  }
  if (command === 'disable-totp') {
    await users.updateOne({ _id: user._id }, { $set: { totp: { enabled: false }, updatedAt: now } });
    console.log('two-step verification disabled');
    return;
  }
  const password = await readSecret(`New password (${PASSWORD_MIN}-${PASSWORD_MAX} characters): `);
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    console.error('password length out of range');
    process.exitCode = 1;
    return;
  }
  await users.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password), passwordChangedAt: now, updatedAt: now } });
  await sessions.deleteMany({ userId: user._id });
  console.log('password reset; all sessions signed out');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
