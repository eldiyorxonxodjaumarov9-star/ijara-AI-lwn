-- AI Agent content CMS (scripts, locations, contacts, media)

CREATE TYPE "AiAgentScriptCategory" AS ENUM (
  'GREETING',
  'PRICE_INFO',
  'CONTRACT',
  'VIEWING',
  'PAYMENT',
  'PARKING',
  'INTERNET',
  'GENERAL'
);

CREATE TYPE "AiAgentMediaCategory" AS ENUM (
  'ROOM',
  'OFFICE',
  'BUILDING',
  'ENTRANCE',
  'PARKING',
  'LOCATION',
  'OTHER'
);

CREATE TABLE IF NOT EXISTS "ai_agent_scripts" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "title" TEXT NOT NULL,
  "category" "AiAgentScriptCategory" NOT NULL DEFAULT 'GENERAL',
  "content" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_agent_scripts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_agent_locations" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "title" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "landmark" TEXT,
  "mapUrl" TEXT,
  "workingHours" TEXT,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_agent_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_agent_contacts" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "phone" TEXT,
  "telegramUsername" TEXT,
  "note" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_agent_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_agent_media" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "title" TEXT NOT NULL,
  "category" "AiAgentMediaCategory" NOT NULL DEFAULT 'OTHER',
  "roomId" TEXT,
  "description" TEXT,
  "fileUrl" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_agent_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_agent_scripts_workspaceId_idx" ON "ai_agent_scripts"("workspaceId");
CREATE INDEX IF NOT EXISTS "ai_agent_scripts_category_idx" ON "ai_agent_scripts"("category");
CREATE INDEX IF NOT EXISTS "ai_agent_scripts_active_idx" ON "ai_agent_scripts"("active");

CREATE INDEX IF NOT EXISTS "ai_agent_locations_workspaceId_idx" ON "ai_agent_locations"("workspaceId");
CREATE INDEX IF NOT EXISTS "ai_agent_locations_active_idx" ON "ai_agent_locations"("active");

CREATE INDEX IF NOT EXISTS "ai_agent_contacts_workspaceId_idx" ON "ai_agent_contacts"("workspaceId");
CREATE INDEX IF NOT EXISTS "ai_agent_contacts_active_idx" ON "ai_agent_contacts"("active");

CREATE INDEX IF NOT EXISTS "ai_agent_media_workspaceId_idx" ON "ai_agent_media"("workspaceId");
CREATE INDEX IF NOT EXISTS "ai_agent_media_category_idx" ON "ai_agent_media"("category");
CREATE INDEX IF NOT EXISTS "ai_agent_media_roomId_idx" ON "ai_agent_media"("roomId");
CREATE INDEX IF NOT EXISTS "ai_agent_media_active_idx" ON "ai_agent_media"("active");
CREATE INDEX IF NOT EXISTS "ai_agent_media_sortOrder_idx" ON "ai_agent_media"("sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_scripts_workspaceId_fkey') THEN
    ALTER TABLE "ai_agent_scripts"
      ADD CONSTRAINT "ai_agent_scripts_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_locations_workspaceId_fkey') THEN
    ALTER TABLE "ai_agent_locations"
      ADD CONSTRAINT "ai_agent_locations_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_contacts_workspaceId_fkey') THEN
    ALTER TABLE "ai_agent_contacts"
      ADD CONSTRAINT "ai_agent_contacts_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_media_workspaceId_fkey') THEN
    ALTER TABLE "ai_agent_media"
      ADD CONSTRAINT "ai_agent_media_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_media_roomId_fkey') THEN
    ALTER TABLE "ai_agent_media"
      ADD CONSTRAINT "ai_agent_media_roomId_fkey"
      FOREIGN KEY ("roomId") REFERENCES "properties"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
