/**
 * Safe additive apply of AI Agent content CMS tables on Neon.
 * Never prints DATABASE_URL or secrets.
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";

function readDatabaseUrl(filePath) {
  if (!fs.existsSync(filePath)) return null;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("DATABASE_URL=")) continue;
    let val = trimmed.slice("DATABASE_URL=".length).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    return val;
  }
  return null;
}

const url = readDatabaseUrl(".env.local");
if (!url || !url.includes("neon.tech")) {
  console.log(JSON.stringify({ ok: false, reason: "refusing_non_neon" }));
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

const STATEMENTS = [
  `DO $$ BEGIN
    CREATE TYPE "AiAgentScriptCategory" AS ENUM (
      'GREETING','PRICE_INFO','CONTRACT','VIEWING','PAYMENT','PARKING','INTERNET','GENERAL'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE "AiAgentMediaCategory" AS ENUM (
      'ROOM','OFFICE','BUILDING','ENTRANCE','PARKING','LOCATION','OTHER'
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "ai_agent_scripts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "title" TEXT NOT NULL,
    "category" "AiAgentScriptCategory" NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_agent_scripts_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "ai_agent_locations" (
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
  )`,
  `CREATE TABLE IF NOT EXISTS "ai_agent_contacts" (
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
  )`,
  `CREATE TABLE IF NOT EXISTS "ai_agent_media" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_scripts_workspaceId_idx" ON "ai_agent_scripts"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_scripts_category_idx" ON "ai_agent_scripts"("category")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_scripts_active_idx" ON "ai_agent_scripts"("active")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_locations_workspaceId_idx" ON "ai_agent_locations"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_locations_active_idx" ON "ai_agent_locations"("active")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_contacts_workspaceId_idx" ON "ai_agent_contacts"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_contacts_active_idx" ON "ai_agent_contacts"("active")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_media_workspaceId_idx" ON "ai_agent_media"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_media_category_idx" ON "ai_agent_media"("category")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_media_roomId_idx" ON "ai_agent_media"("roomId")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_media_active_idx" ON "ai_agent_media"("active")`,
  `CREATE INDEX IF NOT EXISTS "ai_agent_media_sortOrder_idx" ON "ai_agent_media"("sortOrder")`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_scripts_workspaceId_fkey') THEN
      ALTER TABLE "ai_agent_scripts" ADD CONSTRAINT "ai_agent_scripts_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_locations_workspaceId_fkey') THEN
      ALTER TABLE "ai_agent_locations" ADD CONSTRAINT "ai_agent_locations_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_contacts_workspaceId_fkey') THEN
      ALTER TABLE "ai_agent_contacts" ADD CONSTRAINT "ai_agent_contacts_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_media_workspaceId_fkey') THEN
      ALTER TABLE "ai_agent_media" ADD CONSTRAINT "ai_agent_media_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_agent_media_roomId_fkey') THEN
      ALTER TABLE "ai_agent_media" ADD CONSTRAINT "ai_agent_media_roomId_fkey"
      FOREIGN KEY ("roomId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
];

try {
  for (const stmt of STATEMENTS) {
    await prisma.$executeRawUnsafe(stmt);
  }
  const check = await prisma.$queryRaw`
    SELECT
      to_regclass('public.ai_agent_scripts') IS NOT NULL AS scripts,
      to_regclass('public.ai_agent_locations') IS NOT NULL AS locations,
      to_regclass('public.ai_agent_contacts') IS NOT NULL AS contacts,
      to_regclass('public.ai_agent_media') IS NOT NULL AS media
  `;
  console.log(
    JSON.stringify({
      ok: true,
      statements: STATEMENTS.length,
      tables: check[0],
      storage: "vercel_blob_existing",
    })
  );
} catch (e) {
  console.log(
    JSON.stringify({
      ok: false,
      errorName: e instanceof Error ? e.name : "Unknown",
      message: e instanceof Error ? e.message.slice(0, 300) : "error",
    })
  );
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
