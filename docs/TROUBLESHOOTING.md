# Troubleshooting

**P1001/database connection failed:** a direct Supabase host often resolves only to IPv6. Copy the exact Session pooler URI from Connect, using port 5432, the `postgres.PROJECT_REF` username, and the correct password. Do not guess `aws-0` or `aws-1`. Enable SSL and verify outbound TCP 5432. Use the same reachable session URI for migrations when the direct connection is unavailable.

**NVIDIA 410 or 404:** the configured endpoint/model may be retired or inaccessible to the account even if listed in `/models`. Verify a small request with `node scripts/verify-integrations.mjs`. The initial verification found E5 unavailable, and explicitly selected `nvidia/llama-nemotron-embed-vl-1b-v2` at 1024 dimensions. Reindex every document after a model change. Do not truncate vectors from an unsupported dimension. `nvidia/nemotron-3-embed-1b` currently requires 2048, so it is incompatible with this schema.

**Document FAILED:** inspect the displayed processing error. Confirm the private bucket and service key, supported text type, model access and size limit. Scanned PDFs need external OCR. Reindex after fixing the cause. For a crashed worker, reset PROCESSING to QUEUED only after confirming no process owns the job.

**Anonymous data unavailable:** this is intentional. Do not add public RLS policies. Start the backend, sign in, and let the scoped services access the database.

**UI still shows synthetic preview:** set `NEXT_PUBLIC_DEMO_MODE=false` in `apps/web/.env.local` for local work and restart Next.js. For Docker, rebuild the frontend with that build argument. `DEMO_MODE` is a separate server flag and does not select UI fixtures.

**CSRF 403:** `APP_BASE_URL` must match the browser origin exactly, including port in local development. Production requests require same-origin metadata. API clients can send the configured Origin header.

**Certificate acquisition failed:** ensure public TCP 80, a supported Certbot version and a publicly routable IPv4. Inspect the ACME logs. Preserve bootstrap HTTP for fictional testing and never report it as secure real-data access. Renew short-lived certificates reliably.

**Browser executable missing:** `npx playwright install chromium`, then rerun `npm run test:e2e` against the synthetic preview. Tests start with clean browser storage.

**Build memory exhausted:** use the ARM64 CI workflow; avoid simultaneous builds on t4g.small. Check swap, disk space and instance logs. Do not delete hosted financial data to free local disk space.
