import 'server-only';
import { MongoClient, type Db } from 'mongodb';
import { env, mongoUrl } from '@/server/env';

// One MongoClient per process. In development the client survives hot reloads on globalThis.

type Holder = { client?: MongoClient; connecting?: Promise<MongoClient> };
const holder = ((globalThis as { __financeMongo?: Holder }).__financeMongo ??= {});

export async function getClient(): Promise<MongoClient> {
  if (holder.client) return holder.client;
  holder.connecting ??= (async () => {
    const client = new MongoClient(mongoUrl(), {
      appName: 'finance-tracker',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5_000,
    });
    await client.connect();
    holder.client = client;
    return client;
  })().finally(() => {
    holder.connecting = undefined;
  });
  return holder.connecting;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(env().MONGO_DB);
}

export async function closeDb(): Promise<void> {
  const client = holder.client;
  holder.client = undefined;
  await client?.close();
}

export async function pingDb(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 }, { timeoutMS: 2_000 });
    return true;
  } catch {
    return false;
  }
}
