#!/bin/sh
# Screenshot tour on a fresh database: builds nothing, expects `npm run build` done and a Mongo reachable at
# MONGO_URL_BASE (default mongodb://127.0.0.1:27018). Uses a throwaway database and drops it afterwards.
set -eu
BASE=${MONGO_URL_BASE:-mongodb://127.0.0.1:27018}
DB="finance_screens_$(date +%s)"
PORT=${PORT:-3200}
set -a
. ./.env
set +a
export NEXT_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
export MONGO_URL="$BASE/$DB" MONGO_DB="$DB" APP_URL="http://localhost:$PORT" PORT HOSTNAME=127.0.0.1
export WORKER_HEARTBEAT_FILE="${TMPDIR:-/tmp}/ft-heartbeat-$DB"
node dist/migrate.mjs >/dev/null
node .next/standalone/server.js >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; node -e "const {MongoClient}=require(\"mongodb\");(async()=>{const c=await MongoClient.connect(process.env.MONGO_URL);await c.db().dropDatabase();await c.close()})()"' EXIT
for _ in $(seq 1 30); do curl -sf "http://localhost:$PORT/api/health" >/dev/null && break; sleep 0.5; done
mkdir -p artifacts/screenshots
E2E_BASE_URL="http://localhost:$PORT" npx playwright test tests/e2e/screens.spec.ts "$@"
