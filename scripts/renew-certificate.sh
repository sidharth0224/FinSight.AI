#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
/snap/bin/certbot renew --config-dir "$PWD/infra/certbot/conf" --work-dir "$PWD/infra/certbot/work" --logs-dir "$PWD/infra/certbot/logs" --quiet
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
openssl x509 -in infra/certbot/conf/live/finsight-ip/cert.pem -noout -enddate
