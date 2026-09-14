import { NextRequest } from "next/server";

import { writeAgentActionAudit } from "@/lib/api-server/agent-gateway/audit";
import { buildDailySnapshot } from "@/lib/api-server/agent-gateway/daily-snapshot";
import { requireAgentAuth } from "@/lib/api-server/agent-gateway/require-agent";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

/** GET /api/internal/agent/v1/payments/overdue */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501, "DB_NOT_CONFIGURED");
  }

  const auth = await requireAgentAuth(req, ["payments:read", "debts:read"]);
  if ("error" in auth) return auth.error;

  const snapshot = await buildDailySnapshot();
  const items = snapshot.payments.items.filter(
    (i) => i.hasDebt && i.overdueDays > 0
  );
  const runId = req.headers.get("x-run-id")?.trim() || undefined;

  await writeAgentActionAudit({
    runId,
    agentType: "PAYMENT",
    action: "payments.overdue.read",
    riskLevel: "LOW",
    requiredScope: "debts:read",
    input: { traceId: auth.ctx.traceId },
    output: {
      overdueCount: snapshot.payments.overdueCount,
      totalDebt: snapshot.payments.totalDebt,
    },
    status: "SUCCEEDED",
  });

  return ok({
    date: snapshot.date,
    timezone: snapshot.timezone,
    overdueCount: snapshot.payments.overdueCount,
    totalDebt: snapshot.payments.totalDebt,
    items,
  });
}
