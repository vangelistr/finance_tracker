import { readiness } from '@/server/health';

export const dynamic = 'force-dynamic';

export async function GET() {
  const r = await readiness();
  return Response.json(
    { status: r.ready ? 'ready' : 'not_ready', db: r.db, worker: r.worker },
    { status: r.ready ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
