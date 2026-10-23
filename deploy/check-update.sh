#!/usr/bin/env bash
# deploy/check-update.sh: used by finance-updater.timer (off until you enable it). Pulls the moving `main` tag,
# reads the commit it was built from (OCI revision label) and deploys the matching immutable sha- tag when it
# differs from the running one.
source "$(dirname "$0")/lib.sh"

docker pull -q "$IMAGE_NAME:main" >/dev/null || { log "update check: pull of $IMAGE_NAME:main failed"; exit 1; }
REV="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMAGE_NAME:main")"
[ -n "$REV" ] || { log "update check: no revision label on $IMAGE_NAME:main"; exit 1; }
TAG="sha-${REV:0:7}"
if [ "$TAG" = "$(current_tag)" ]; then exit 0; fi
log "update check: $TAG is newer than $(current_tag)"
exec "$(dirname "$0")/deploy.sh" "$TAG"
