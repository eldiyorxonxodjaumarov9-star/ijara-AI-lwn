-- Additive: server-recorded business activity (human / AI / automation). No existing table is altered.

DO $$ BEGIN
  CREATE TYPE "ActivityActorType" AS ENUM ('HUMAN', 'AI', 'AUTOMATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "workspace_activity_events" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "actorType" "ActivityActorType" NOT NULL,
  "actionType" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_activity_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_activity_events_workspaceId_createdAt_idx"
  ON "workspace_activity_events"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "workspace_activity_events_workspaceId_featureKey_actorType_idx"
  ON "workspace_activity_events"("workspaceId", "featureKey", "actorType");

DO $$ BEGIN
  ALTER TABLE "workspace_activity_events" ADD CONSTRAINT "workspace_activity_events_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "workspace_activity_events" ADD CONSTRAINT "workspace_activity_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
