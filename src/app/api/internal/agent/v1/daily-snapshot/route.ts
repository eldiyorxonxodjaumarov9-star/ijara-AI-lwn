import { NextRequest } from "next/server";

import { writeAgentActionAudit } from "@/lib/api-server/agent-gateway/audit";
import { buildDailySnapshot } from "@/lib/api-server/agent-gateway/daily-snapshot";
import { requireAgentAuth } from "@/lib/api-server/agent-gateway/require-agent";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

/**
 * GET /api/internal/agent/v1/daily-snapshot
 * Server-side deterministic snapshot for Manager/Payment/Analyst.
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501, "DB_NOT_CONFIGURED");
  }

  const auth = await requireAgentAuth(req, [
    "payments:read",
    "debts:read",
    "analytics:read",
    "expenses:read",
    "rooms:read",
  ]);
  if ("error" in auth) return auth.error;

  const started = Date.now();
  const snapshot = await buildDailySnapshot();
  const runId = req.headers.get("x-run-id")?.trim() || undefined;

  await writeAgentActionAudit({
    runId,
    agentType: "SYSTEM",
    action: "daily_snapshot.read",
    riskLevel: "LOW",
    requiredScope: "analytics:read",
    input: { traceId: auth.ctx.traceId },
    output: {
      date: snapshot.date,
      dueTodayCount: snapshot.payments.dueTodayCount,
      overdueCount: snapshot.payments.overdueCount,
      totalDebt: snapshot.payments.totalDebt,
    },
    status: "SUCCEEDED",
    durationMs: Date.now() - started,
  });

  return ok(snapshot);
}
