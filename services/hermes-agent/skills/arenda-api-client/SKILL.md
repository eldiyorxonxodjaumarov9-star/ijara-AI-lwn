---
name: arenda-api-client
description: Authenticate to Ijara AI Agent Gateway and call read-only endpoints.
---

# Arenda API client

## Auth
`POST {HERMES_ARENDA_API_BASE_URL}/api/internal/agent/v1/auth/token`
Body: `{ "clientId", "clientSecret" }` — scopes are server-owned.

Use short-lived Bearer token. Refresh on 401 `TOKEN_EXPIRED`.

## Headers
- `Authorization: Bearer …`
- `X-Trace-Id`, `X-Run-Id` when available

## Never send
`DATABASE_URL`, Telegram token, TTLock secrets, admin cookies.
