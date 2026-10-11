#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
: "${WEB_IMAGE:?Export the previous web image digest or version}"
: "${API_IMAGE:?Export the previous API image digest or version}"
docker compose pull web api
docker compose up -d web api
bash scripts/healthcheck.sh
# Database migrations are never automatically reversed or data deleted.
