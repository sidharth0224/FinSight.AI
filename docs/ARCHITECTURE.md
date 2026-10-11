# FinSight architecture

The browser calls same-origin `/api`. Nginx routes requests to the NestJS API on the private Docker network and serves Next.js through its standalone server. Supabase provides the only database and private file storage. NVIDIA hosts inference. The instance runs exactly web, API, and Nginx containers.

`apps/web/src/components` contains the reusable workspace shell, dashboard, expense table and investigation view, budget charts, Copilot, evidence dialog, knowledge base, audit cards and settings. TanStack Query controls fetching and invalidation. React Hook Form and Zod validate submissions. Radix primitives provide accessible dialogs with focus management. Tailwind and CSS tokens define the visual system.

`apps/api/src` contains services for authentication, finance, risk, documents, retrieval, NVIDIA and Copilot orchestration. Controllers group related REST endpoints and use a session guard. The initial application uses a consolidated NestJS module to share these services rather than duplicating small service wrappers. Swagger is at `/api/docs`. `packages/shared/src` contains response contracts and deterministic seed data.

Financial queries use Prisma Decimal and PostgreSQL NUMERIC. Budget variance and utilization are computed in parameterized SQL. All queries bind the authenticated organization; restricted users also bind the department or employee. Department managers cannot access salary categories. Employees cannot access organization summaries. SQL results become the evidence package; the LLM has no SQL execution capability or financial write tools.

Documents use database status values QUEUED, PROCESSING, INDEXED and FAILED. One small worker claims a queued document every three seconds. Text extraction and embedding batches run serially to limit memory pressure. Indexing replaces vectors transactionally. Changing models requires explicit reindexing, and retrieval rejects chunks indexed with another model. A crashed PROCESSING job requires an operator to reset its status after verifying no worker owns it.

The UI preview is an explicitly labeled, independent browser fixture mode enabled only by `NEXT_PUBLIC_DEMO_MODE=true` at build time. It is not served by production API handlers and does not represent a live AI connection. Connected mode uses the authenticated API exclusively.
