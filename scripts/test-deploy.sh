#!/usr/bin/env bash
# Local acceptance test of deploy/deploy.sh and deploy/rollback.sh against Docker Compose, in a throwaway Compose
# project with its own volumes and port. Uses the locally built images (docker compose build) re-tagged as test
# releases; nothing is pulled. Checks: first deploy, pre-deploy backup on the next ones, pruning to the last 3
# images, automatic rollback when the new tag fails its readiness gate, rollback.sh, and idempotent migrations.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_APP="$(sed -n 's/^IMAGE_NAME=//p' .env | tail -n1):local"
BASE_BACKUP="$(sed -n 's/^IMAGE_NAME=//p' .env | tail -n1)-backup:local"
export COMPOSE_PROJECT_NAME=financedeploytest IMAGE_NAME=finance-deploytest APP_HOST_PORT=3310
export DEPLOY_PULL=0 DEPLOY_READY_TIMEOUT=150 DEPLOY_STATE_DIR
DEPLOY_STATE_DIR="$(mktemp -d)"
PASS=0
ok() { printf 'PASS %s\n' "$1"; PASS=$((PASS + 1)); }
fail() { printf 'FAIL %s\n' "$1"; tail -n 25 "$DEPLOY_STATE_DIR/out.log" 2>/dev/null; exit 1; }
# expect <description> <command...>: pass when the command succeeds, otherwise stop the test.
expect() { local d="$1"; shift; if "$@"; then ok "$d"; else fail "$d"; fi; }

cleanup() {
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '^finance-deploytest(-backup)?:' | xargs -r docker image rm >/dev/null 2>&1 || true
  rm -rf "$DEPLOY_STATE_DIR"
}
trap cleanup EXIT

docker image inspect "$BASE_APP" "$BASE_BACKUP" >/dev/null || fail "build the images first: docker compose build"

# Test releases: distinct images (one label each) so creation order and pruning are real.
for t in t1 t2 t3 t4; do
  printf 'FROM %s\nLABEL test.release=%s\n' "$BASE_APP" "$t" | docker build -q -t "finance-deploytest:$t" - >/dev/null
  printf 'FROM %s\nLABEL test.release=%s\n' "$BASE_BACKUP" "$t" | docker build -q -t "finance-deploytest-backup:$t" - >/dev/null
  sleep 1
done
# A broken release: the app process exits at once, so /api/ready never answers.
printf 'FROM %s\nCMD ["node","-e","process.exit(1)"]\n' "$BASE_APP" | docker build -q -t finance-deploytest:bad - >/dev/null
printf 'FROM %s\nLABEL test.release=bad\n' "$BASE_BACKUP" | docker build -q -t finance-deploytest-backup:bad - >/dev/null

state() { cat "$DEPLOY_STATE_DIR/$1" 2>/dev/null || true; }
ready() { curl -fsS --max-time 5 "http://127.0.0.1:$APP_HOST_PORT/api/ready" | grep -q '"status":"ready"'; }
mongo_eval() { docker compose exec -T mongo sh -c "mongosh --quiet --norc -u \"\$MONGO_INITDB_ROOT_USERNAME\" -p \"\$MONGO_INITDB_ROOT_PASSWORD\" --authenticationDatabase admin \"\$MONGO_INITDB_DATABASE\" --eval '$1'"; }

is_state() { [ "$(state "$1")" = "$2" ]; }
logged() { grep -q "$1" "$DEPLOY_STATE_DIR/deploy.log"; }
tags_of() { docker image ls "$1" --format '{{.Tag}}' | grep -E '^t[0-9]$' | sort | tr '\n' ' '; }

deploy/deploy.sh t1 >>"$DEPLOY_STATE_DIR/out.log" 2>&1 || fail "first deploy t1"
expect "first deploy records t1" is_state current t1
expect "first deploy t1 is ready" ready
expect "first deploy skips the backup when no backup service runs" logged "pre-deploy backup skipped"

deploy/deploy.sh t2 >>"$DEPLOY_STATE_DIR/out.log" 2>&1 || fail "deploy t2"
expect "deploy t2 logs a pre-deploy backup" logged "pre-deploy backup ok"
pre="$(mongo_eval 'print(db.backup_runs.countDocuments({trigger:"pre-deploy",status:"success"}))')"
expect "deploy t2 ran a successful pre-deploy backup first ($pre)" [ "$pre" -ge 1 ]
expect "current t2" is_state current t2
expect "previous t1" is_state previous t1

deploy/deploy.sh t3 >>"$DEPLOY_STATE_DIR/out.log" 2>&1 || fail "deploy t3"
deploy/deploy.sh t4 >>"$DEPLOY_STATE_DIR/out.log" 2>&1 || fail "deploy t4"
expect "pruning keeps the last 3 app images ($(tags_of finance-deploytest))" [ "$(tags_of finance-deploytest)" = "t2 t3 t4 " ]
expect "pruning keeps the last 3 backup images ($(tags_of finance-deploytest-backup))" [ "$(tags_of finance-deploytest-backup)" = "t2 t3 t4 " ]

rc=0; DEPLOY_READY_TIMEOUT=40 deploy/deploy.sh bad >>"$DEPLOY_STATE_DIR/out.log" 2>&1 || rc=$?
expect "a release that fails its readiness gate exits non-zero ($rc)" [ "$rc" -ne 0 ]
expect "automatic rollback keeps t4 recorded" is_state current t4
expect "automatic rollback: t4 is ready again" ready
expect "the automatic rollback is logged" logged "rollback to t4 ok"

deploy/rollback.sh >>"$DEPLOY_STATE_DIR/out.log" 2>&1 || fail "rollback.sh"
expect "rollback.sh records t3" is_state current t3
expect "rollback.sh keeps t4 as previous" is_state previous t4
expect "rollback.sh: t3 is ready" ready

out="$(IMAGE_TAG=t3 docker compose run --rm --no-deps migrate 2>&1 | grep -o '"applied":[0-9]*' | tail -n1)"
expect "migrations are idempotent on re-run ($out)" [ "$out" = '"applied":0' ]

printf '%s checks passed\n' "$PASS"
