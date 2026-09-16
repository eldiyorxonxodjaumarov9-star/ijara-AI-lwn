# API route auth matrix (defense in depth)

Primary auth lives in each route handler (`requireUser`, `requireResourceAccess`, cron secrets, etc.).
There is **no** global Next.js middleware — dashboard pages use client `ProtectedRoute` + API gates.

| Group | Examples | Auth |
| --- | --- | --- |
| Public marketing | `/`, `/login`, `/ijara-qidiruv` | None |
| Tenant portal | `/portal`, `/api/portal/*` | Portal JWT / tenant session |
| Public forms | `/contract-form/[token]`, `/api/public/contract-form/*` | Signed token + rate limit |
| Public lead | `POST /api/clients/lead` | Rate limit + validation (no CRM overwrite) |
| Health (minimal) | `GET /api/health` | None → `{ ok: true }` only |
| Setup | `POST /api/setup/init` | `x-setup-secret` header |
| Staff CRUD | `/api/{tenants,contracts,...}` | JWT + RBAC (`requireResourceAccess`) |
| Employees | `/api/employees` | JWT; managers/admins only; salary stripped for others |
| Uploads | `POST /api/uploads` | JWT (returns public Blob URLs — see route comment) |
| Task attachments | `GET /api/tasks/attachments/[id]` | JWT + staff; private stream proxy |
| Integrations admin | `/api/integrations/instagram` PATCH/POST | Staff/admin |
| Integrations status | `/api/integrations/instagram/status` | Any staff; sanitized payload |
| TTLock / Telegram webhooks | `/api/integrations/ttlock/callback`, telegram routes | Provider secrets / verify tokens |
| Cron | `/api/cron/*` | `CRON_SECRET` or `Authorization: Bearer` |
| Agent gateway | `/api/internal/agent/v1/*` | Bearer agent token (health: minimal unless authed) |

**Page routes:** `(dashboard)/*` wrapped in `ProtectedRoute` (redirects to `/login`). API must never rely on this alone.
