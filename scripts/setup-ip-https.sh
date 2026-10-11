#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
: "${PUBLIC_IP:?Export the EC2 public IPv4 address}"
if [[ -n "${ACME_EMAIL:-}" ]]; then
  task_account_args=(--email "$ACME_EMAIL")
else
  task_account_args=(--register-unsafely-without-email)
fi
[[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Invalid IPv4 address' >&2; exit 1; }
CERTBOT=/snap/bin/certbot
"$CERTBOT" --help all | grep -q -- '--ip-address' || { echo 'Certbot 5.4+ with IP webroot support is required.' >&2; exit 1; }
mkdir -p infra/certbot/www infra/certbot/conf infra/certbot/work infra/certbot/logs
sudo "$CERTBOT" certonly --non-interactive --agree-tos "${task_account_args[@]}" --preferred-profile shortlived --ip-address "$PUBLIC_IP" --cert-name finsight-ip --webroot -w "$PWD/infra/certbot/www" --config-dir "$PWD/infra/certbot/conf" --work-dir "$PWD/infra/certbot/work" --logs-dir "$PWD/infra/certbot/logs"
sed "s/PUBLIC_IP_VALUE/$PUBLIC_IP/g" infra/nginx/https.conf.template > infra/nginx/nginx.conf
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
curl --fail --show-error "https://$PUBLIC_IP/api/health"
task_root="$PWD"
printf '[Unit]\nDescription=Renew FinSight IP certificate\n[Service]\nType=oneshot\nWorkingDirectory=%s\nExecStart=/usr/bin/bash %s/scripts/renew-certificate.sh\n' "$task_root" "$task_root" | sudo tee /etc/systemd/system/finsight-cert-renew.service >/dev/null
printf '[Unit]\nDescription=FinSight certificate renewal timer\n[Timer]\nOnCalendar=*-*-* 00,12:00:00\nRandomizedDelaySec=900\nPersistent=true\n[Install]\nWantedBy=timers.target\n' | sudo tee /etc/systemd/system/finsight-cert-renew.timer >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now finsight-cert-renew.timer
