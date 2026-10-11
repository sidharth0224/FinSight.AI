# Supabase setup

Use a dedicated project for fictional demo records. Copy the exact connection URI from the project's **Connect** dialog. Select **Session pooler**, port 5432, if direct IPv6 connectivity is unavailable. Pooler cluster names cannot be inferred reliably from the project region. Add `sslmode=require&connection_limit=3` to the runtime URL. Use a reachable direct or session-pooler URL for `MIGRATION_DATABASE_URL`; avoid the transaction pooler for migrations.

```bash
cp .env.example .env
# Edit the ignored .env with your project connection and server credentials.
npm ci
npm run db:generate
npm run db:migrate
```

The migration creates `extensions.vector(1024)`, relational tables, foreign keys, unique constraints and indexes. If pgvector is already installed in a different schema, inspect `pg_extension` and move it deliberately before applying the migration:

```sql
SELECT e.extname, n.nspname FROM pg_extension e
JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector';
-- Only when required and after inspecting the existing project:
ALTER EXTENSION vector SET SCHEMA extensions;
```

All financial tables enable RLS and have no public policies. The anonymous/browser key cannot read them. The trusted backend connects through PostgreSQL; its services enforce organization, role and department scope. Use server-only credentials. Do not grant public read policies to make the frontend work.

Currency fields are `NUMERIC(18,2)`. Journal creation verifies equal positive debit and credit totals and rejects an account outside the organization. Budget history records the allocation and actor. Expense approvals, review comments and audit logs preserve human actions.

Create a **private** Storage bucket named `finsight-private`, or run:

```bash
node scripts/verify-integrations.mjs --configure
```

This command checks integrations and creates the missing private bucket. It never prints keys. To seed, set `DEMO_MODE=true` and a unique development-only `DEMO_SEED_PASSWORD` with at least 12 characters, then run `npm run db:seed`. Re-running resets the synthetic expenses and queues policies for indexing; use only a dedicated demo database.

Expected October 2026 totals: income INR 2,450,000.00; approved expenditure INR 1,862,500.00; net INR 587,500.00; department allocation INR 1,800,000.00. Three departments are over budget. Pending claims are excluded from booked expenditure. Seed verification checks the SQL total.
