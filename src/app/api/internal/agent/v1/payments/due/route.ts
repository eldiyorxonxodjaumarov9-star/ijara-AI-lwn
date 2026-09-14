import { NextRequest } from "next/server";

import { writeAgentActionAudit } from "@/lib/api-server/agent-gateway/audit";
import { buildDailySnapshot } from "@/lib/api-server/agent-gateway/daily-snapshot";
import { requireAgentAuth } from "@/lib/api-server/agent-gateway/require-agent";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

/** GET /api/internal/agent/v1/payments/due */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501, "DB_NOT_CONFIGURED");
  }

  const auth = await requireAgentAuth(req, ["payments:read"]);
  if ("error" in auth) return auth.error;

  const snapshot = await buildDailySnapshot();
  const items = snapshot.payments.items.filter(
    (i) => i.daysLeft === 0 && !i.hasDebt
  );
  const runId = req.headers.get("x-run-id")?.trim() || undefined;

  await writeAgentActionAudit({
    runId,
    agentType: "PAYMENT",
    action: "payments.due.read",
    riskLevel: "LOW",
    requiredScope: "payments:read",
    input: { traceId: auth.ctx.traceId },
    output: { count: items.length },
    status: "SUCCEEDED",
  });

  return ok({
    date: snapshot.date,
    timezone: snapshot.timezone,
    dueTodayCount: snapshot.payments.dueTodayCount,
    items,
  });
}
