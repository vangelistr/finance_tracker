#!/bin/sh
# Backup acceptance checks against the running Compose stack (local restic repository):
#   retention, pre-deploy backup, restore into the live database with count comparison, restore test,
#   start-up config validation (exit 78) and the failure record used by the alert.
set -eu
dc() { docker compose "$@"; }
ok() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; exit 1; }
count_snapshots() { dc exec -T backup sh -c 'restic -r "$BACKUP_LOCAL_DIR" snapshots --json --host "$BACKUP_HOST"' | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))'; }

# 1. Retention (7 daily / 4 weekly / 6 monthly): several backups on one day keep the day's newest snapshot.
#    restic also keeps the oldest snapshot while the history is shorter than the policy, so a one-day history
#    settles at 2 snapshots however many backups run.
for _ in 1 2 3; do dc exec -T backup backup --trigger manual >/dev/null; done
n=$(count_snapshots)
[ "$n" -le 2 ] && ok "retention prunes same-day snapshots (kept $n after 3+ backups)" || fail "retention left $n snapshots"

# 2. Pre-deploy backup: no prune, exit 0, a second snapshot exists until the next pruning run.
kept=$(count_snapshots)
dc exec -T backup backup-now >/dev/null && ok "backup-now exits 0" || fail "backup-now failed"
n=$(count_snapshots)
[ "$n" -eq $((kept + 1)) ] && ok "backup-now does not prune ($n snapshots)" || fail "expected $((kept + 1)) snapshots, found $n"

# 3. Restore into the live database (app and worker stopped), then compare per-collection counts.
counts() { dc exec -T mongo sh -c 'mongosh --quiet --norc -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE" --eval "const o={};for(const n of db.getCollectionNames().sort())if(n!==\"backup_runs\")o[n]=db.getCollection(n).countDocuments({});print(JSON.stringify(o))"'; }
before=$(counts)
dc stop app worker >/dev/null 2>&1
dc exec -T mongo sh -c 'mongosh --quiet --norc -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE" --eval "db.getCollection(\"sessions\").deleteMany({})"' >/dev/null
dc exec -T backup restore --yes >/dev/null
after=$(counts)
dc start app worker >/dev/null 2>&1
[ "$before" = "$after" ] && ok "restore brings back identical document counts" || fail "counts differ: $before vs $after"

# 4. Restore test into a scratch mongod.
dc exec -T backup restore-test manual >/dev/null && ok "restore-test passes" || fail "restore-test failed"

# 5. Start-up validation fails loudly with exit 78 and names the variable, never the value.
rc=0
out=$(dc run --rm --no-deps -e BACKUP_TARGET=s3 -e R2_ENDPOINT=http://example.r2.dev -e R2_BUCKET= backup 2>&1) || rc=$?
[ "$rc" -eq 78 ] && ok "invalid s3 config exits 78" || fail "expected exit 78, got $rc"
echo "$out" | grep -q 'R2_ENDPOINT must be' && ok "error names R2_ENDPOINT" || fail "missing R2_ENDPOINT message"
rc=0
dc run --rm --no-deps -e RESTIC_PASSWORD=short backup >/dev/null 2>&1 || rc=$?
[ "$rc" -eq 78 ] && ok "short RESTIC_PASSWORD exits 78" || fail "expected exit 78, got $rc"

# 6. A failed backup is recorded as failed (the worker turns it into a push and banner alert).
rc=0
dc exec -T -e MONGO_DB=finance -e RESTIC_PASSWORD=wrong-password-for-this-repo backup backup --trigger manual >/dev/null 2>&1 || rc=$?
[ "$rc" -ne 0 ] && ok "backup with a wrong repository password exits non-zero ($rc)" || fail "backup should have failed"
failed=$(dc exec -T mongo sh -c 'mongosh --quiet --norc -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE" --eval "print(db.backup_runs.countDocuments({status:\"failed\", notifiedAt: null}))"')
[ "$failed" -ge 1 ] && ok "failed run recorded with notifiedAt null ($failed)" || fail "no failed run recorded"
