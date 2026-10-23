#!/usr/bin/env bash
# deploy/deploy.sh <tag>: pull-based deploy of an immutable image tag (for example sha-abc1234).
#   1. pre-deploy backup through the backup service, and wait for it (stop on failure)
#   2. pull the exact tag (app and backup images)
#   3. run the idempotent migrations
#   4. docker compose up -d on the new tag
#   5. gate on /api/ready for DEPLOY_READY_TIMEOUT seconds
#   6. on failure, roll back to the running tag and exit non-zero
#   7. record the tag and keep only the last DEPLOY_KEEP_IMAGES images
# Run on the server from the project directory as the deploy user. Never touches anything outside this project.
source "$(dirname "$0")/lib.sh"

TAG="${1:-}"
valid_tag "$TAG" || { echo "usage: deploy/deploy.sh <tag>   (an immutable tag such as sha-abc1234; never latest)" >&2; exit 2; }
CURRENT="$(current_tag)"
log "deploy $TAG (running: ${CURRENT:-none})"
note_attempt "$TAG"

if backup_running; then
  log "pre-deploy backup"
  docker compose exec -T backup backup-now || { log "pre-deploy backup FAILED: nothing changed"; exit 1; }
  log "pre-deploy backup ok"
else
  log "no running backup service (first deploy): pre-deploy backup skipped"
fi

if [ "$DEPLOY_PULL" = "1" ]; then
  dc "$TAG" pull app backup || { log "pull of $TAG FAILED: nothing changed"; exit 1; }
fi

if switch_to "$TAG" && wait_ready; then
  record "$TAG"
  log "deploy $TAG ok"
  prune_images
  exit 0
fi

log "deploy $TAG FAILED readiness within ${DEPLOY_READY_TIMEOUT}s"
if [ -n "$CURRENT" ]; then
  log "rolling back to $CURRENT"
  dc "$CURRENT" up -d --no-build --remove-orphans app worker backup
  if wait_ready; then log "rollback to $CURRENT ok"; else log "rollback to $CURRENT did not become ready: check 'docker compose logs app'"; fi
else
  log "no previous tag to roll back to"
fi
exit 1
