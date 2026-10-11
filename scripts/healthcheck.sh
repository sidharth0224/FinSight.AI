#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T api node -e "fetch('http://localhost:4000/api/health').then(async r=>{console.log(await r.json());process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
docker compose exec -T web node -e "fetch('http://localhost:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
docker compose exec -T nginx nginx -t
docker stats --no-stream
