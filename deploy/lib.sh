# shellcheck shell=bash
# Shared helpers for deploy.sh, rollback.sh and check-update.sh. Sourced, not executed.
# Settings come from the caller's environment first, then from .env (read key by key, never sourced whole).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

envval() { # envval KEY -> value of KEY in .env without quotes ("" when absent)
  [ -f .env ] || return 0
  sed -n "s/^$1=//p" .env | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

: "${COMPOSE_PROJECT_NAME:=$(envval COMPOSE_PROJECT_NAME)}"
: "${COMPOSE_PROJECT_NAME:=finance}"
: "${IMAGE_NAME:=$(envval IMAGE_NAME)}"
: "${APP_HOST_PORT:=$(envval APP_HOST_PORT)}"
: "${APP_HOST_PORT:=3000}"
: "${DEPLOY_STATE_DIR:=$ROOT/.deploy}"
: "${DEPLOY_READY_TIMEOUT:=120}"
: "${DEPLOY_KEEP_IMAGES:=3}"
: "${DEPLOY_PULL:=1}"
export COMPOSE_PROJECT_NAME IMAGE_NAME APP_HOST_PORT

[ -n "$IMAGE_NAME" ] || { echo "deploy: IMAGE_NAME is not set (.env)" >&2; exit 2; }
mkdir -p "$DEPLOY_STATE_DIR"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$DEPLOY_STATE_DIR/deploy.log" >&2; }

valid_tag() { [[ "$1" =~ ^[A-Za-z0-9._-]{1,128}$ ]] && [ "$1" != "latest" ]; }

current_tag() { cat "$DEPLOY_STATE_DIR/current" 2>/dev/null || true; }
previous_tag() { cat "$DEPLOY_STATE_DIR/previous" 2>/dev/null || true; }

# dc <tag> <compose args...>: Compose with an explicit image tag (never "latest", never a local build).
dc() { local tag="$1"; shift; IMAGE_TAG="$tag" docker compose "$@"; }

backup_running() { [ -n "$(docker compose ps --status running -q backup 2>/dev/null)" ]; }

# Waits until /api/ready answers "ready" (database reachable and worker heartbeat fresh).
wait_ready() {
  local deadline=$(( $(date +%s) + DEPLOY_READY_TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl -fsS --max-time 5 "http://127.0.0.1:${APP_HOST_PORT}/api/ready" 2>/dev/null | grep -q '"status":"ready"'; then return 0; fi
    sleep 3
  done
  return 1
}

# Starts the stack on a tag. Migrations run first through the `migrate` service (idempotent, forward-only).
switch_to() {
  local tag="$1"
  dc "$tag" up -d --no-build --wait mongo
  dc "$tag" run --rm --no-deps migrate
  dc "$tag" up -d --no-build --remove-orphans app worker backup
}

record() { # record <new current>: the old current becomes previous
  local cur; cur="$(current_tag)"
  [ -n "$cur" ] && [ "$cur" != "$1" ] && printf '%s\n' "$cur" > "$DEPLOY_STATE_DIR/previous"
  printf '%s\n' "$1" > "$DEPLOY_STATE_DIR/current"
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "$DEPLOY_STATE_DIR/history"
}

note_attempt() { printf '%s\n' "$1" >> "$DEPLOY_STATE_DIR/attempts"; }

# Keeps the images of the last DEPLOY_KEEP_IMAGES tags this script deployed or tried (plus current and previous)
# and removes older ones it pulled. Images it never handled are left alone, and only this project's two
# repositories are touched: never `docker system prune`, which would remove other projects' images.
prune_images() {
  local keep repo tag
  keep="$( { current_tag; previous_tag; sed -n "1!G;h;\$p" "$DEPLOY_STATE_DIR/attempts" 2>/dev/null | awk '!seen[$0]++' | head -n "$DEPLOY_KEEP_IMAGES"; } | sort -u)"
  sed -n "1!G;h;\$p" "$DEPLOY_STATE_DIR/attempts" 2>/dev/null | awk '!seen[$0]++' | while read -r tag; do
    grep -qxF "$tag" <<<"$keep" && continue
    for repo in "$IMAGE_NAME" "${IMAGE_NAME}-backup"; do
      docker image inspect "$repo:$tag" >/dev/null 2>&1 || continue
      if docker image rm "$repo:$tag" >/dev/null 2>&1; then log "pruned $repo:$tag"; else log "kept $repo:$tag (in use)"; fi
    done
  done
}
