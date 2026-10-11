# Security model

Passwords use bcrypt with cost 12. Login is rate limited. Random session tokens live in HttpOnly SameSite=Lax cookies and are stored only as HMAC hashes with an eight-hour expiry. HTTPS enables Secure cookies. Server-side membership is resolved on every request. Browser-supplied roles and organization IDs are not accepted.

Financial and document services bind organization and restricted department scope. Employees see their own expenses. Managers cannot access other departments or salary categories. Admin and finance roles can allocate budgets; approval requires an authorized human and prevents self-approval. Conversations are visible only to their owner within the organization. Citation file access is re-authorized before a signed URL is issued.

Mutations validate Origin and Fetch Metadata. Production changes without same-origin evidence are rejected. Zod validates inputs. Raw SQL is parameterized. API errors suppress implementation details. Helmet and Nginx supply security headers. The backend is not publicly exposed in Docker. RLS prevents direct anonymous access to the relational tables. Keys remain in ignored environment files and are excluded from Docker contexts.

Uploads limit size and validate supported extensions plus PDF/DOCX signatures; text files reject binary null bytes. Storage paths are random and scoped to the organization. Documents are private. A document cannot be deleted while indexing owns it. PDF OCR is not bundled. Uploads are not malware-scanned; add a scanning service before untrusted real-world deployment. Do not enable public Storage buckets.

Risk findings distinguish thresholds, potential duplicates, unusual amounts, missing receipts and department limits. They never label a person fraudulent. Audit trails record important human actions. AI cannot write accounting entries or approve expenses.

Local preview uses fictional records and browser-local storage. It provides no authentication guarantee and must not contain real records. Production builds default to connected mode. Restrict seeded accounts or replace their passwords before exposing any deployment. Rotate credentials shared during setup before using the project for real financial data.

The MVP is not a compliance certification. Production operations should add retention policies, a privileged-access review, backup/restore drills, centralized incident monitoring and a user password reset process.
