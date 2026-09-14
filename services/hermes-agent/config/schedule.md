# Scheduler

Target: **every day 08:00 Asia/Tashkent**

Use the official Hermes cron / scheduled jobs mechanism after install
(`hermes` docs: scheduled jobs / gateway). Do not hard-code wrong local offsets.

Flow:
1. Create AgentRun (idempotency `daily-manager-report:YYYY-MM-DD`)
2. GET daily-snapshot
3. Payment + Analyst skills
4. Compose Uzbek report
5. POST notifications/telegram (respect dry-run + telegramReportsEnabled)
6. PATCH run COMPLETED with token usage if provider returns it

Retries: limited exponential backoff for network errors only.
No retry on validation/auth errors. Never duplicate Telegram delivery.
