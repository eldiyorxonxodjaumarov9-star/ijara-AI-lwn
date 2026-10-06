-- Additive: workspace scoping for AI Employees (runs, audits, settings).
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "agent_action_audits" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "agent_settings" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

CREATE INDEX IF NOT EXISTS "agent_runs_workspaceId_createdAt_idx" ON "agent_runs"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_runs_workspaceId_agentType_createdAt_idx" ON "agent_runs"("workspaceId", "agentType", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_action_audits_workspaceId_createdAt_idx" ON "agent_action_audits"("workspaceId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_settings_workspaceId_key" ON "agent_settings"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "agent_action_audits" ADD CONSTRAINT "agent_action_audits_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "agent_settings" ADD CONSTRAINT "agent_settings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Legacy Hermes/gateway runs only ever read the internal workspace; attribute them there.
UPDATE "agent_runs" SET "workspaceId" = (SELECT "id" FROM "workspaces" WHERE "isInternal" = true ORDER BY "createdAt" ASC LIMIT 1)
  WHERE "workspaceId" IS NULL;
UPDATE "agent_action_audits" SET "workspaceId" = (SELECT "id" FROM "workspaces" WHERE "isInternal" = true ORDER BY "createdAt" ASC LIMIT 1)
  WHERE "workspaceId" IS NULL;

-- The internal workspace keeps the toggles it had under the global row; "default" stays as the gateway kill switch.
INSERT INTO "agent_settings" ("id", "workspaceId", "masterEnabled", "managerEnabled", "paymentEnabled", "analystEnabled",
  "telegramReportsEnabled", "dryRunDefault", "dailyReportHour", "timezone", "updatedBy", "updatedAt", "createdAt")
SELECT 'ws:' || w."id", w."id", s."masterEnabled", s."managerEnabled", s."paymentEnabled", s."analystEnabled",
  s."telegramReportsEnabled", s."dryRunDefault", s."dailyReportHour", s."timezone", s."updatedBy", NOW(), NOW()
FROM "agent_settings" s
CROSS JOIN (SELECT "id" FROM "workspaces" WHERE "isInternal" = true ORDER BY "createdAt" ASC LIMIT 1) w
WHERE s."id" = 'default'
ON CONFLICT DO NOTHING;
