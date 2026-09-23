-- CreateEnum
CREATE TYPE "TelegramAiLeadStatus" AS ENUM (
  'NEW',
  'QUALIFYING',
  'QUALIFIED',
  'VIEWING_REQUESTED',
  'HANDOFF',
  'CLOSED',
  'LOST'
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "telegram_ai_leads" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'TELEGRAM_AI',
  "telegramUserId" TEXT NOT NULL,
  "telegramUsername" TEXT,
  "displayName" TEXT,
  "phone" TEXT,
  "desiredArea" DOUBLE PRECISION,
  "businessType" TEXT,
  "peopleCount" INTEGER,
  "moveInDate" TEXT,
  "budget" DOUBLE PRECISION,
  "interestedRoomIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "TelegramAiLeadStatus" NOT NULL DEFAULT 'NEW',
  "conversationSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "telegram_ai_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telegram_ai_leads_telegramUserId_key"
  ON "telegram_ai_leads"("telegramUserId");
CREATE INDEX IF NOT EXISTS "telegram_ai_leads_workspaceId_idx"
  ON "telegram_ai_leads"("workspaceId");
CREATE INDEX IF NOT EXISTS "telegram_ai_leads_status_idx"
  ON "telegram_ai_leads"("status");
CREATE INDEX IF NOT EXISTS "telegram_ai_leads_source_idx"
  ON "telegram_ai_leads"("source");
CREATE INDEX IF NOT EXISTS "telegram_ai_leads_updatedAt_idx"
  ON "telegram_ai_leads"("updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_ai_leads_workspaceId_fkey'
  ) THEN
    ALTER TABLE "telegram_ai_leads"
      ADD CONSTRAINT "telegram_ai_leads_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
