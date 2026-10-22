#!/usr/bin/env bash
# Shared helpers for the backup scripts. Never print secrets: log variable names, not values.
set -Eeuo pipefail

: "${BACKUP_TARGET:=local}"
: "${BACKUP_LOCAL_DIR:=/backups/restic}"
: "${BACKUP_HOST:=finance-tracker}"
: "${BACKUP_REPO_PREFIX:=restic}"
: "${BACKUP_SCHEDULE:=30 3 * * *}"
: "${BACKUP_KEEP_DAILY:=7}"
: "${BACKUP_KEEP_WEEKLY:=4}"
: "${BACKUP_KEEP_MONTHLY:=6}"
: "${BACKUP_TIMEOUT_MINUTES:=30}"
: "${BACKUP_STALE_HOURS:=26}"
: "${MONGO_HOST:=mongo}"
: "${MONGO_PORT:=27017}"
: "${MONGO_DB:=finance}"
: "${R2_REGION:=auto}"
: "${SFTP_PORT:=23}"
STATE_DIR=${BACKUP_STATE_DIR:-/var/lib/backup}
LOCK_FILE="$STATE_DIR/lock"
STATUS_FILE="$STATE_DIR/status.json"
STATE_FILE="$STATE_DIR/state.json"
LIB_DIR=/usr/local/lib/backup
export RESTIC_HOST="$BACKUP_HOST"

log() {
  local level=$1 msg=$2
  shift 2
  jq -cn --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg level "$level" --arg msg "$msg" \
    '{t: $t, level: $level, svc: "backup", msg: $msg} + ($ARGS.named | del(.t, .level, .msg))' "$@"
}

die() {
  log error "$1"
  exit "${2:-1}"
}

urlencode() { jq -rn --arg v "$1" '$v | @uri'; }

# Root connection string for dump, restore and the run log. Passed through files or env, never argv.
mongo_uri() {
  printf 'mongodb://%s:%s@%s:%s/?authSource=admin' \
    "$(urlencode "${MONGO_ROOT_USER:?}")" "$(urlencode "${MONGO_ROOT_PASSWORD:?}")" "$MONGO_HOST" "$MONGO_PORT"
}

# A 0600 mongodump/mongorestore config file holding the URI, removed when the calling script exits.
mongo_tool_config() {
  local f
  f=$(mktemp /tmp/mongo-tool.XXXXXX.yml)
  chmod 0600 "$f"
  printf 'uri: "%s"\n' "$(mongo_uri)" >"$f"
  echo "$f"
}

# Runs lib/runs.js (mongosh, no URI on the command line). Usage: runs <action> [NAME=value ...]
runs() {
  local action=$1
  shift
  env "$@" ACTION="$action" MONGO_URI="$(mongo_uri)" MONGO_DB="$MONGO_DB" \
    mongosh --nodb --quiet --norc --file "$LIB_DIR/runs.js"
}

restic_repository() {
  case "$BACKUP_TARGET" in
    local) echo "$BACKUP_LOCAL_DIR" ;;
    s3) echo "s3:${R2_ENDPOINT%/}/${R2_BUCKET}/${BACKUP_REPO_PREFIX}" ;;
    sftp) echo "sftp://${SFTP_USER}@${SFTP_HOST}:${SFTP_PORT}/${SFTP_PATH%/}/${BACKUP_REPO_PREFIX}" ;;
  esac
}

# restic with the target's repository and options (see lib/restic-target). The password comes from RESTIC_PASSWORD.
r() { "$LIB_DIR/restic-target" "$@"; }

offsite() { [ "$BACKUP_TARGET" != local ] && echo true || echo false; }

# Start-up configuration validation. Prints each failed rule by variable name and exits 78.
validate_config() {
  local problems=()
  local int
  case "$BACKUP_TARGET" in local | s3 | sftp) ;; *) problems+=("BACKUP_TARGET must be local, s3 or sftp") ;; esac
  [ "${#RESTIC_PASSWORD}" -ge 20 ] || problems+=("RESTIC_PASSWORD must be set (at least 20 characters)")
  [ -n "${MONGO_ROOT_USER:-}" ] && [ -n "${MONGO_ROOT_PASSWORD:-}" ] || problems+=("MONGO_ROOT_USER and MONGO_ROOT_PASSWORD are required")
  for int in BACKUP_KEEP_DAILY BACKUP_KEEP_WEEKLY BACKUP_KEEP_MONTHLY BACKUP_TIMEOUT_MINUTES BACKUP_STALE_HOURS; do
    [[ "${!int}" =~ ^[1-9][0-9]*$ ]] || problems+=("$int must be a positive integer")
  done
  if ! [[ "$BACKUP_SCHEDULE" =~ ^([0-9]{1,2})\ ([0-9]{1,2})\ \*\ \*\ \*$ ]] ||
    [ "${BASH_REMATCH[1]}" -gt 59 ] || [ "${BASH_REMATCH[2]}" -gt 23 ]; then
    problems+=("BACKUP_SCHEDULE must look like 'M H * * *' (daily, local time)")
  fi
  case "$BACKUP_TARGET" in
    local)
      [[ "$BACKUP_LOCAL_DIR" == /* ]] || problems+=("BACKUP_LOCAL_DIR must be an absolute path")
      [ -d "$BACKUP_LOCAL_DIR" ] && [ -w "$BACKUP_LOCAL_DIR" ] || problems+=("BACKUP_LOCAL_DIR must exist and be writable")
      ;;
    s3)
      [[ "${R2_ENDPOINT:-}" =~ ^https://[a-z0-9]+(\.(eu|fedramp))?\.r2\.cloudflarestorage\.com/?$ ]] ||
        problems+=("R2_ENDPOINT must be https://<ACCOUNT_ID>.r2.cloudflarestorage.com (HTTPS, no bucket path, never r2.dev)")
      [ -n "${R2_BUCKET:-}" ] && [[ "$R2_BUCKET" != */* ]] || problems+=("R2_BUCKET is required (no slashes)")
      [ -n "${R2_ACCESS_KEY_ID:-}" ] || problems+=("R2_ACCESS_KEY_ID is required")
      [ -n "${R2_SECRET_ACCESS_KEY:-}" ] || problems+=("R2_SECRET_ACCESS_KEY is required")
      ;;
    sftp)
      for int in SFTP_HOST SFTP_USER SFTP_PATH; do [ -n "${!int:-}" ] || problems+=("$int is required"); done
      [[ "$SFTP_PORT" =~ ^[0-9]+$ ]] || problems+=("SFTP_PORT must be a number")
      [ -r "${SFTP_KEY_FILE:-/nonexistent}" ] || problems+=("SFTP_KEY_FILE must be a readable key file")
      [ -r "${SFTP_KNOWN_HOSTS_FILE:-/nonexistent}" ] || problems+=("SFTP_KNOWN_HOSTS_FILE must be a readable known_hosts file")
      ;;
  esac
  if [ "${#problems[@]}" -gt 0 ]; then
    local p
    for p in "${problems[@]}"; do log error "invalid backup configuration" --arg rule "$p" >&2; done
    exit 78
  fi
  [ "$BACKUP_TARGET" = local ] && log warn "backup target is a local volume: it protects against app errors, not against losing the server"
  [ "$BACKUP_TARGET" = s3 ] && [ "$R2_REGION" != auto ] && log warn "R2_REGION is not 'auto'"
  return 0
}

# Opens the repository, creating it on the first run. Exit codes per the restic scripting docs.
ensure_repo() {
  local rc=0
  r cat config >/dev/null 2>&1 || rc=$?
  case "$rc" in
    0) ;;
    10) log info "initialising restic repository" && r init >/dev/null ;;
    12) die "wrong RESTIC_PASSWORD for the existing repository" 12 ;;
    *) die "cannot open the restic repository (restic exit $rc)" "$rc" ;;
  esac
}

state_get() { [ -f "$STATE_FILE" ] && jq -r --arg k "$1" '.[$k] // empty' "$STATE_FILE" || true; }
state_set() {
  local tmp
  tmp=$(mktemp "$STATE_DIR/state.XXXXXX")
  { [ -f "$STATE_FILE" ] && cat "$STATE_FILE" || echo '{}'; } | jq --arg k "$1" --arg v "$2" '.[$k] = $v' >"$tmp"
  mv "$tmp" "$STATE_FILE"
}
