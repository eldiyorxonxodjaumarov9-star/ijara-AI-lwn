import { NextRequest } from "next/server";

import { writeAgentActionAudit } from "@/lib/api-server/agent-gateway/audit";
import { buildDailySnapshot } from "@/lib/api-server/agent-gateway/daily-snapshot";
import { requireAgentAuth } from "@/lib/api-server/agent-gateway/require-agent";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

/** GET /api/internal/agent/v1/analytics/monthly-summary */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501, "DB_NOT_CONFIGURED");
  }

  const auth = await requireAgentAuth(req, [
    "analytics:read",
    "expenses:read",
    "rooms:read",
  ]);
  if ("error" in auth) return auth.error;

  const snapshot = await buildDailySnapshot();
  const runId = req.headers.get("x-run-id")?.trim() || undefined;

  await writeAgentActionAudit({
    runId,
    agentType: "ANALYST",
    action: "analytics.monthly_summary.read",
    riskLevel: "LOW",
    requiredScope: "analytics:read",
    input: { traceId: auth.ctx.traceId },
    output: {
      currentMonth: snapshot.comparison.currentMonth,
      compareToMonth: snapshot.comparison.compareToMonth,
    },
    status: "SUCCEEDED",
  });

  return ok({
    date: snapshot.date,
    timezone: snapshot.timezone,
    occupancy: snapshot.occupancy,
    comparison: snapshot.comparison,
    expenseHighlights: snapshot.expenseHighlights,
  });
}
