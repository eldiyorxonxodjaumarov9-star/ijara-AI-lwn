/**
 * Safe additive apply of telegram_ai_leads migration against Neon prod.
 * Never prints DATABASE_URL or secrets. Runs statements one-by-one.
 */
import fs from "fs";
import { PrismaClient } from "@prisma/client";

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

function classifyHost(raw) {
  try {
    const h = new URL(raw).hostname.toLowerCase();
    if (h.includes("neon.tech")) return "cloud-neon";
    if (h === "localhost" || h === "127.0.0.1") return "localhost";
    return "remote";
  } catch {
    return "invalid";
  }
}

const url = readDatabaseUrl(".env.local");
const hostKind = url ? classifyHost(url) : "missing";
const mode = process.argv[2] || "check";

if (hostKind !== "cloud-neon") {
  console.log(JSON.stringify({ ok: false, hostKind, reason: "refusing_non_neon" }));
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function tableState() {
  const rows = await prisma.$queryRaw`
    SELECT
      to_regclass('public.telegram_ai_leads') IS NOT NULL AS table_exists,
      EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'TelegramAiLeadStatus'
      ) AS enum_exists
  `;
  return rows[0];
}

const STATEMENTS = [
  `DO $$ BEGIN
    CREATE TYPE "TelegramAiLeadStatus" AS ENUM (
      'NEW','QUALIFYING','QUALIFIED','VIEWING_REQUESTED','HANDOFF','CLOSED','LOST'
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `CREATE TABLE IF NOT EXISTS "telegram_ai_leads" (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "telegram_ai_leads_telegramUserId_key"
    ON "telegram_ai_leads"("telegramUserId")`,
  `CREATE INDEX IF NOT EXISTS "telegram_ai_leads_workspaceId_idx"
    ON "telegram_ai_leads"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "telegram_ai_leads_status_idx"
    ON "telegram_ai_leads"("status")`,
  `CREATE INDEX IF NOT EXISTS "telegram_ai_leads_source_idx"
    ON "telegram_ai_leads"("source")`,
  `CREATE INDEX IF NOT EXISTS "telegram_ai_leads_updatedAt_idx"
    ON "telegram_ai_leads"("updatedAt")`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'telegram_ai_leads_workspaceId_fkey'
    ) THEN
      ALTER TABLE "telegram_ai_leads"
        ADD CONSTRAINT "telegram_ai_leads_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
];

try {
  if (mode === "check" || mode === "verify") {
    const state = await tableState();
    let columns = [];
    if (state.table_exists) {
      columns = await prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'telegram_ai_leads'
        ORDER BY ordinal_position
      `;
    }
    console.log(
      JSON.stringify({
        mode,
        hostKind,
        productionLikely: true,
        table_exists: Boolean(state.table_exists),
        enum_exists: Boolean(state.enum_exists),
        columns: columns.map((c) => c.column_name),
      })
    );
    process.exit(state.table_exists && state.enum_exists ? 0 : 2);
  }

  if (mode === "apply") {
    const before = await tableState();
    console.log(
      JSON.stringify({
        phase: "before",
        table_exists: Boolean(before.table_exists),
        enum_exists: Boolean(before.enum_exists),
        backup_note: "additive_only_neon_pitr_available",
      })
    );

    let applied = 0;
    for (const stmt of STATEMENTS) {
      await prisma.$executeRawUnsafe(stmt);
      applied += 1;
    }

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "_prisma_migrations" (
          id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
        )
        SELECT
          gen_random_uuid()::text,
          'manual-telegram-ai-leads',
          NOW(),
          '20260923150000_telegram_ai_leads',
          NULL,
          NULL,
          NOW(),
          1
        WHERE NOT EXISTS (
          SELECT 1 FROM "_prisma_migrations"
          WHERE migration_name = '20260923150000_telegram_ai_leads'
        )
      `);
    } catch (e) {
      console.log(
        JSON.stringify({
          phase: "migration_history",
          note: "skipped_or_failed",
          errorName: e instanceof Error ? e.name : "Unknown",
        })
      );
    }

    const after = await tableState();
    console.log(
      JSON.stringify({
        phase: "after",
        statements_applied: applied,
        table_exists: Boolean(after.table_exists),
        enum_exists: Boolean(after.enum_exists),
        ok: Boolean(after.table_exists && after.enum_exists),
      })
    );
    process.exit(after.table_exists && after.enum_exists ? 0 : 1);
  }

  console.log(JSON.stringify({ ok: false, reason: "unknown_mode", mode }));
  process.exit(1);
} catch (e) {
  console.log(
    JSON.stringify({
      ok: false,
      errorName: e instanceof Error ? e.name : "Unknown",
      message: e instanceof Error ? e.message.slice(0, 240) : "error",
    })
  );
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
