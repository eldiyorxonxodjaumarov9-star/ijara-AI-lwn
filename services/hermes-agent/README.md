# Ijara AI × Hermes Agent Runtime

Official Hermes Agent (Nous Research) runs as a **separate persistent process**.
It never receives `DATABASE_URL`, Telegram bot tokens, or TTLock secrets.

## Architecture

```text
Hermes runtime (this folder / Docker)
  → Ijara AI Internal Agent Gateway (/api/internal/agent/v1/*)
  → existing Ijara AI services + Prisma
  → PostgreSQL
```

## Official sources

- Docs: https://hermes-agent.nousresearch.com/docs
- GitHub: https://github.com/NousResearch/hermes-agent
- Install (Windows PowerShell): `iex (irm https://hermes-agent.nousresearch.com/install.ps1)`
- Install (Linux/macOS): `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`

Project-scoped data directory: set `HERMES_HOME` to this folder's `.hermes/`
(ignored by git). Do not install into a global Python env for production deploys;
prefer the official installer (venv under `~/.hermes` or `$HERMES_HOME`).

## FREE Nous Portal auth

```bash
hermes setup --portal
# or: hermes model  → choose Nous Portal
```

If device/OAuth login is required, complete it in the browser. Never paste tokens into chat or git.

## Env (Hermes side — see `.env.example`)

| Variable | Purpose |
|---|---|
| `HERMES_ARENDA_API_BASE_URL` | e.g. `https://www.arendaai.uz` or `https://ijaraai.uz` |
| `HERMES_ARENDA_CLIENT_ID` | must match `AGENT_GATEWAY_CLIENT_ID` |
| `HERMES_ARENDA_CLIENT_SECRET` | must match `AGENT_GATEWAY_CLIENT_SECRET` |
| `HERMES_DAILY_REPORT_TIMEZONE` | `Asia/Tashkent` |
| `HERMES_DAILY_REPORT_HOUR` | `8` |

**Must NOT be set here:** `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, TTLock secrets.

## Skills

Custom Ijara AI skills live under `skills/` and should be linked/copied into
`$HERMES_HOME/skills/` after install (see `scripts/sync-skills.ps1`).

## Daily schedule

08:00 Asia/Tashkent → Manager orchestration (Payment + Analyst) → safe Telegram template via Agent API (default dry-run).

Configure via official Hermes cron/scheduled jobs after `hermes doctor` passes.
See `config/schedule.md`.

## Docker / 24×7 runtime

```bash
docker compose -f docker-compose.yml up -d --build
```

The image extends the official `nousresearch/hermes-agent` image. Its one-shot
bootstrap installs the five Arenda skills, disables all CLI toolsets, and
converts `08:00 Asia/Tashkent` to `03:00 UTC`. The gateway owns the scheduler.

First authenticate the persistent Docker volume, then start the gateway:

```bash
docker compose run --rm --entrypoint hermes bootstrap setup --portal
docker compose up -d --build
docker compose exec hermes-arenda hermes cron status
docker compose exec hermes-arenda hermes cron doctor
```

Run a production-data preview without Telegram delivery:

```bash
docker compose exec hermes-arenda \
  python /opt/data/scripts/arenda_runner.py --dry-run
```

Only after the preview is verified should `HERMES_DRY_RUN=false` and Telegram
reports be enabled. Requires a persistent host (VPS). Do **not** run Hermes as
a Vercel serverless daemon.

The runner obtains separate scoped tokens for Manager, Payment, and Analyst.
Payment/Analyst model prompts receive aggregates without tenant names. The
Telegram financial snapshot is rebuilt inside Ijara AI, so Hermes cannot
override amounts.

## Smoke tests

```bash
# From repo root (Node)
npm test -- src/lib/api-server/agent-gateway

# Hermes CLI (after install)
hermes doctor
```
