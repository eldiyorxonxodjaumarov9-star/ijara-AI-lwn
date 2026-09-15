import { createHash, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { fail, ok } from "@/lib/api-server/http";

export const runtime = "nodejs";

type SchemaState = {
  agent_type: boolean;
  trigger_type: boolean;
  run_status: boolean;
  action_status: boolean;
  risk_level: boolean;
  runs: boolean;
  audits: boolean;
  settings: boolean;
};

const MIGRATION_STATEMENTS = [
  `CREATE TYPE "AgentType" AS ENUM ('MANAGER', 'PAYMENT', 'ANALYST', 'SYSTEM')`,
  `CREATE TYPE "AgentTriggerType" AS ENUM ('SCHEDULE', 'EVENT', 'MANUAL', 'TEST')`,
  `CREATE TYPE "AgentRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED')`,
  `CREATE TYPE "AgentActionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REJECTED', 'DUPLICATE')`,
  `CREATE TYPE "AgentRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH')`,
  `CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "triggerType" "AgentTriggerType" NOT NULL,
    "triggerRef" TEXT,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "traceId" TEXT,
    "modelProvider" TEXT,
    "model" TEXT,
    "modelVersion" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCost" DECIMAL(18,8),
    "metadata" JSONB,
    "errorCode" TEXT,
    "errorSummary" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX "agent_runs_idempotencyKey_key" ON "agent_runs"("idempotencyKey")`,
  `CREATE INDEX "agent_runs_status_createdAt_idx" ON "agent_runs"("status", "createdAt")`,
  `CREATE INDEX "agent_runs_agentType_createdAt_idx" ON "agent_runs"("agentType", "createdAt")`,
  `CREATE INDEX "agent_runs_traceId_idx" ON "agent_runs"("traceId")`,
  `CREATE TABLE "agent_action_audits" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "agentType" "AgentType" NOT NULL,
    "action" TEXT NOT NULL,
    "riskLevel" "AgentRiskLevel" NOT NULL DEFAULT 'LOW',
    "requiredScope" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "status" "AgentActionStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "idempotencyKey" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_action_audits_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX "agent_action_audits_idempotencyKey_key" ON "agent_action_audits"("idempotencyKey")`,
  `CREATE INDEX "agent_action_audits_runId_createdAt_idx" ON "agent_action_audits"("runId", "createdAt")`,
  `CREATE INDEX "agent_action_audits_action_createdAt_idx" ON "agent_action_audits"("action", "createdAt")`,
  `ALTER TABLE "agent_action_audits"
    ADD CONSTRAINT "agent_action_audits_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "agent_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE`,
  `CREATE TABLE "agent_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "masterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "managerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "analystEnabled" BOOLEAN NOT NULL DEFAULT true,
    "telegramReportsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dryRunDefault" BOOLEAN NOT NULL DEFAULT true,
    "dailyReportHour" INTEGER NOT NULL DEFAULT 8,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_settings_pkey" PRIMARY KEY ("id")
  )`,
  `INSERT INTO "agent_settings" ("id", "masterEnabled", "updatedAt")
    VALUES ('default', false, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING`,
] as const;

function authorized(request: Request) {
  const expected = process.env.AGENT_MIGRATION_SECRET;
  const provided = request.headers.get("x-agent-migration-secret");
  if (!expected || !provided) return false;
  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

async function readState(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRawUnsafe<SchemaState[]>(`
    SELECT
      EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgentType') AS agent_type,
      EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgentTriggerType') AS trigger_type,
      EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgentRunStatus') AS run_status,
      EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgentActionStatus') AS action_status,
      EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgentRiskLevel') AS risk_level,
      to_regclass('public.agent_runs') IS NOT NULL AS runs,
      to_regclass('public.agent_action_audits') IS NOT NULL AS audits,
      to_regclass('public.agent_settings') IS NOT NULL AS settings
  `);
  return rows[0];
}

export async function POST(request: Request) {
  if (!authorized(request)) return fail("Ruxsat yo'q", 403, "FORBIDDEN");

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext('arenda-agent-employees-v1'))"
        );
        const before = await readState(tx);
        const values = Object.values(before);

        if (values.every(Boolean)) {
          return { status: "already_applied" as const, state: before };
        }
        if (values.some(Boolean)) {
          throw new Error("PARTIAL_AGENT_SCHEMA");
        }

        for (const statement of MIGRATION_STATEMENTS) {
          await tx.$executeRawUnsafe(statement);
        }
        const after = await readState(tx);
        if (!Object.values(after).every(Boolean)) {
          throw new Error("AGENT_SCHEMA_VERIFY_FAILED");
        }
        return { status: "applied" as const, state: after };
      },
      { timeout: 30_000 }
    );

    return ok(result);
  } catch (error) {
    const code =
      error instanceof Error && error.message.includes("PARTIAL_AGENT_SCHEMA")
        ? "PARTIAL_AGENT_SCHEMA"
        : "MIGRATION_FAILED";
    return fail("Agent migration bajarilmadi", 500, code);
  }
}
