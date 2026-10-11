# EC2 deployment

Use Ubuntu 24.04 ARM64 on `t4g.small`, a 20 GB gp3 disk, and an Elastic IP for stable access. Public IPv4 addresses can incur AWS charges. The database and inference stay hosted. The three containers use starting memory caps of 512 MiB (web), 704 MiB (API), and 96 MiB (Nginx). Validate actual usage under load rather than assuming these are guaranteed requirements.

The setup also supports AMD64 instances. Build on the target machine to select its architecture automatically. The supplied FinSight instance is `i-0f874e454c620d0d4`, an AMD64 `m7i-flex.large` running Ubuntu 26.04, with public address `13.206.122.144`. Its application directory is `/opt/finsight`. Keep `login.pem` private; it is excluded from Git and Docker build contexts.

Security group: allow TCP 22 only from the administrator's public IP; allow TCP 80 and 443 publicly. Never expose 3000, 4000 or 5432. Docker publishes only Nginx. Node services run as the node user. Container logs rotate at 10 MB with three files.

```bash
git clone YOUR_REPOSITORY finsight
cd finsight
bash scripts/ec2-setup.sh
# Reconnect SSH for Docker group membership.
cp .env.example .env
# Edit server-only values. Use APP_BASE_URL=https://YOUR_PUBLIC_IP.
# Database migrations and seed run on a trusted Node 22 workstation or CI.
```

Prefer ARM64 images built by `.github/workflows/arm64.yml`. Set `WEB_IMAGE` and `API_IMAGE` to immutable registry tags/digests in `.env`, then:

```bash
bash scripts/deploy.sh
```

For sequential local builds, allow temporary HTTP bootstrapping by setting `DEMO_MODE=true` only while using fictional data. This does not enable browser fixtures: keep `NEXT_PUBLIC_DEMO_MODE=false` for a seeded, authenticated API.

```bash
docker compose build api
docker compose build web
docker compose up -d
```

Builds may exceed a 2 GiB machine's memory. Prefer CI. Optional safety swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Check whether swap already exists before creating it. Swap is not physical RAM. If a build is killed, inspect `dmesg`, stop the build and use a prebuilt image. Monitor `df -h`, `docker system df` and `docker stats`; do not prune resources that hold needed data.

## Raw-IP HTTPS

The HTTP bootstrap config exposes the ACME webroot. Recent Certbot supports public IP certificates: require version 5.4+ for webroot IP support and select the six-day `shortlived` certificate profile, as described by [Let's Encrypt](https://letsencrypt.org/2026/03/11/shorter-certs-certbot). Ordinary domain certificates do not secure raw IP addresses.

```bash
export PUBLIC_IP=YOUR_PUBLIC_IPV4
export ACME_EMAIL=you@example.com
bash scripts/setup-ip-https.sh
```

An email is optional. Without `ACME_EMAIL`, Certbot creates the ACME account without email notifications; the renewal timer remains enabled.

This requests the certificate, installs the HTTPS configuration, redirects HTTP, verifies Nginx and `https://PUBLIC_IP/api/health`, and installs a twice-daily systemd renewal timer. The script exits on issuance failures without pretending HTTPS is working. Port 80 must remain accessible for renewal. To test renewal and inspect status:

```bash
sudo bash scripts/renew-certificate.sh
sudo systemctl list-timers finsight-cert-renew.timer
sudo journalctl -u finsight-cert-renew.service
openssl x509 -in infra/certbot/conf/live/finsight-ip/cert.pem -noout -dates
bash scripts/healthcheck.sh
```

After issuance set `DEMO_MODE=false` when using real records, set `APP_BASE_URL=https://PUBLIC_IP`, and restart the API. Synthetic seed accounts must be changed or restricted. If issuance is impossible, temporary HTTP is allowed only for explicitly labeled synthetic hackathon data; it is unsuitable for real credentials or financial records.

Rollback application images without deleting hosted data:

```bash
export WEB_IMAGE=YOUR_PREVIOUS_WEB_DIGEST
export API_IMAGE=YOUR_PREVIOUS_API_DIGEST
bash scripts/rollback.sh
```

Schema migrations are not reversed automatically. Take a Supabase backup before upgrades. Nginx listens internally on 8080/8443 and publishes public 80/443. Certificate material and environment files are never included in container build contexts.
