#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
test -f .env || { echo 'Create the server-only .env first.' >&2; exit 1; }
mkdir -p infra/certbot/www infra/certbot/conf
docker compose config --quiet
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
bash scripts/healthcheck.sh
