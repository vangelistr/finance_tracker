#!/usr/bin/env bash
# deploy/rollback.sh: switch back to the previous recorded tag (images are kept locally, nothing is pulled).
# Migrations are forward-only and idempotent, so the older code runs on the newer schema (see README).
source "$(dirname "$0")/lib.sh"

PREV="$(previous_tag)"
CUR="$(current_tag)"
[ -n "$PREV" ] || { log "rollback: no previous tag recorded"; exit 1; }
log "rollback $CUR -> $PREV"
dc "$PREV" up -d --no-build --remove-orphans app worker backup
if wait_ready; then
  record "$PREV"
  log "rollback to $PREV ok"
  exit 0
fi
log "rollback to $PREV did not become ready within ${DEPLOY_READY_TIMEOUT}s"
exit 1
