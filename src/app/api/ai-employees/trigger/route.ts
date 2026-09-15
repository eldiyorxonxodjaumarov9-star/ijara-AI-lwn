import { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-server/auth";
import {
  createAgentRun,
  patchAgentRun,
  writeAgentActionAudit,
} from "@/lib/api-server/agent-gateway/audit";
import {
  buildDailySnapshot,
  dailyReportIdempotencyKey,
} from "@/lib/api-server/agent-gateway/daily-snapshot";
import { buildDefaultRecommendations } from "@/lib/api-server/agent-gateway/report-format";
import { getOrCreateAgentSettings } from "@/lib/api-server/agent-gateway/settings";
import { deliverDailyManagerTelegram } from "@/lib/api-server/agent-gateway/telegram-notify";
import {
  isAiEmployeesEnvEnabled,
  isGatewayConfigured,
} from "@/lib/api-server/agent-gateway/config";
import { checkAgentRateLimit } from "@/lib/api-server/agent-gateway/rate-limit";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

function assertAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

const bodySchema = z.object({
  mode: z.enum(["test", "daily"]).default("test"),
  dryRun: z.boolean().optional(),
});

/**
 * POST /api/ai-employees/trigger
 * Admin manual trigger — default dry-run, audited, rate-limited.
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!assertAdmin(auth.user.role)) {
    return fail("Faqat admin", 403);
  }

  if (!isAiEmployeesEnvEnabled()) {
    return fail("AI Employees o‘chirilgan (env)", 503, "AI_EMPLOYEES_DISABLED");
  }
  if (!isGatewayConfigured()) {
    return fail("Agent Gateway sozlanmagan", 503, "GATEWAY_NOT_CONFIGURED");
  }

  const limited = checkAgentRateLimit(`admin-trigger:${auth.user.id}`);
  if (!limited.ok) {
    return fail("Rate limit", 429, "RATE_LIMITED");
  }

  let json: unknown = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      json = await req.json();
    }
  } catch {
    return fail("JSON body yaroqsiz", 400);
  }

  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return fail("Validation xatosi", 400);
  }

  const settings = await getOrCreateAgentSettings();
  if (!settings.masterEnabled && parsed.data.mode === "daily") {
    return fail("Master o‘chirilgan", 503, "MASTER_DISABLED");
  }

  const dryRun =
    parsed.data.dryRun ??
    settings.dryRunDefault ??
    true;

  const snapshot = await buildDailySnapshot();
  const idempotencyKey =
    parsed.data.mode === "daily"
      ? dailyReportIdempotencyKey(snapshot.date)
      : `test-manager-report:${snapshot.date}:${auth.user.id}:${Date.now()}`;

  const { run, duplicate } = await createAgentRun({
    agentType: "MANAGER",
    triggerType: parsed.data.mode === "test" ? "TEST" : "MANUAL",
    triggerRef: `admin:${auth.user.id}`,
    idempotencyKey:
      parsed.data.mode === "daily" ? idempotencyKey : undefined,
    metadata: { dryRun, mode: parsed.data.mode },
  });

  if (duplicate && parsed.data.mode === "daily") {
    return ok({
      status: "already_processed",
      run,
      dryRun: true,
      snapshotSummary: {
        date: snapshot.date,
        dueTodayCount: snapshot.payments.dueTodayCount,
        overdueCount: snapshot.payments.overdueCount,
        totalDebt: snapshot.payments.totalDebt,
      },
    });
  }

  await patchAgentRun(run.id, {
    status: "RUNNING",
    startedAt: new Date(),
  });

  const recommendations = buildDefaultRecommendations(snapshot);
  const delivery = await deliverDailyManagerTelegram(
    {
      type: "DAILY_MANAGER_REPORT",
      reportDate: snapshot.date,
      runId: run.id,
      idempotencyKey:
        parsed.data.mode === "daily"
          ? idempotencyKey
          : `${idempotencyKey}:tg`,
      dryRun,
      recommendations,
      report: {
        dueTodayCount: snapshot.payments.dueTodayCount,
        overdueCount: snapshot.payments.overdueCount,
        totalDebt: snapshot.payments.totalDebt,
        vacantRooms: snapshot.occupancy.vacant,
        recommendations,
      },
    },
    snapshot
  );

  await writeAgentActionAudit({
    runId: run.id,
    agentType: "MANAGER",
    action: "admin.trigger",
    riskLevel: "LOW",
    input: { mode: parsed.data.mode, dryRun, userId: auth.user.id },
    output: { deliveryStatus: delivery.status },
    status: "SUCCEEDED",
  });

  await patchAgentRun(run.id, {
    status: "COMPLETED",
    completedAt: new Date(),
    metadata: {
      dryRun,
      mode: parsed.data.mode,
      deliveryStatus: delivery.status,
    },
  });

  return ok({
    status: "completed",
    runId: run.id,
    dryRun,
    delivery,
    snapshotSummary: {
      date: snapshot.date,
      dueTodayCount: snapshot.payments.dueTodayCount,
      overdueCount: snapshot.payments.overdueCount,
      totalDebt: snapshot.payments.totalDebt,
      vacantRooms: snapshot.occupancy.vacant,
      comparison: snapshot.comparison,
      expenseHighlights: snapshot.expenseHighlights.slice(0, 3),
    },
    recommendations,
    preview: "preview" in delivery ? delivery.preview : undefined,
  });
}
