# FinSight AI

**Ask your finance data. Get answers you can trust.**

A light, responsive finance workspace with oversized typography, italic serif accents, rounded controls, an evidence-focused Copilot, financial overview, department budgets, expense submissions and investigations, policy management, audit findings, authentication and organization-scoped APIs.

## Local start

Node 22 is the deployment target. The project is an npm workspace monorepo.

```bash
npm ci
npm run db:generate
# Copy .env.example to .env and supply server credentials for the connected API.
npm run db:migrate
npm run db:seed
npm run dev:api
# In another terminal:
npm run dev
```

Open `http://localhost:3000`. To explore the UI without a database, put `NEXT_PUBLIC_DEMO_MODE=true` in the ignored `apps/web/.env.local` and run `npm run dev`. This synthetic preview labels its fictional data and deterministic responses. Production API handlers never return browser fixtures.

For connected mode, use `NEXT_PUBLIC_DEMO_MODE=false`, start the API, and log in using a seeded role account. The database seed requires `DEMO_MODE=true` and a private `DEMO_SEED_PASSWORD`; see [demo instructions](docs/DEMO.md). Do not reuse seeded passwords or accounts for real data.

## Structure

- `apps/web`: Next.js App Router, strict TypeScript, Tailwind, Radix/shadcn-style UI, Lucide, Recharts, TanStack Query, React Hook Form and Zod.
- `apps/api`: NestJS authentication, scoped financial APIs, Decimal risk rules, private document ingestion, pgvector retrieval and NVIDIA orchestration.
- `packages/shared`: contracts and deterministic fictional seed generation.
- `prisma`: schema, SQL migrations and seed verification.
- `infra/nginx`, Dockerfiles and `docker-compose.yml`: three-service ARM64 or AMD64 deployment.
- `scripts`, `.github/workflows`: verification, deployment, IP HTTPS, renewal, rollback and ARM64 builds.
- `tests`, `apps/api/test`: browser flows and deterministic backend security/finance tests.

## Verification

```bash
npm run typecheck
npm run test
npm run build
npx playwright install chromium
# Start the synthetic UI preview first.
npm run test:e2e
node scripts/verify-integrations.mjs
docker compose config --quiet
docker buildx build --platform linux/arm64 -f apps/api/Dockerfile -t finsight-api:local --load .
docker buildx build --platform linux/arm64 -f apps/web/Dockerfile -t finsight-web:local --load .
```

The external verification script does not expose secrets. Migrations and live database tests require a reachable connection; NVIDIA model access must be tested separately. The Copilot returns evidence and a clear warning if language generation fails.

Deployment commands and raw-IP certificate setup are in [EC2 deployment](docs/EC2_DEPLOYMENT.md). Supabase setup is in [database documentation](docs/DATABASE.md). Read [architecture](docs/ARCHITECTURE.md), [AI/RAG](docs/AI_RAG.md), [security](docs/SECURITY.md) and [troubleshooting](docs/TROUBLESHOOTING.md) for implementation behavior and limits. No custom domain, local database, local model, Redis or Kubernetes is required.

## Current boundaries

Responses are returned when fully generated; token streaming is not implemented. Browser cancellation stops waiting but may not terminate the provider request. Connected services must be configured and migrations applied before production data flows. PDF OCR, malware scanning, password reset and full production operational controls are outside the initial demo. Financial decisions always require authorized human judgment.
