#!/usr/bin/env bash
# deploy/dc.sh <compose args>: docker compose on the recorded tag, for manual commands on the server
# (for example `deploy/dc.sh ps` or `deploy/dc.sh logs -f app`), so nothing ever builds or runs "local".
source "$(dirname "$0")/lib.sh"
TAG="$(current_tag)"
[ -n "$TAG" ] || { echo "no deployed tag recorded yet" >&2; exit 1; }
exec env IMAGE_TAG="$TAG" docker compose "$@"
