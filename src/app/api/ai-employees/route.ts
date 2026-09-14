import { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-server/auth";
import {
  getOrCreateAgentSettings,
  updateAgentSettings,
} from "@/lib/api-server/agent-gateway/settings";
import {
  isAiEmployeesEnvEnabled,
  isGatewayConfigured,
} from "@/lib/api-server/agent-gateway/config";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";

function assertAdmin(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

function startOfTashkentDay(now = new Date()) {
  const p = getTashkentDateParts(now);
  // Approximate UTC instant for Tashkent midnight (UTC+5)
  return new Date(Date.UTC(p.year, p.month - 1, p.day, -5, 0, 0));
}

function startOfTashkentMonth(now = new Date()) {
  const p = getTashkentDateParts(now);
  return new Date(Date.UTC(p.year, p.month - 1, 1, -5, 0, 0));
}

/** GET /api/ai-employees — dashboard status (admin only) */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!assertAdmin(auth.user.role)) {
    return fail("Faqat admin", 403);
  }

  const settings = await getOrCreateAgentSettings();
  const dayStart = startOfTashkentDay();
  const monthStart = startOfTashkentMonth();

  const [
    todayRuns,
    monthRuns,
    failedToday,
    lastSuccess,
    lastFailed,
    recentAudits,
    tokenAggToday,
    tokenAggMonth,
  ] = await Promise.all([
    prisma.agentRun.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.agentRun.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.agentRun.count({
      where: { status: "FAILED", createdAt: { gte: dayStart } },
    }),
    prisma.agentRun.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    }),
    prisma.agentRun.findFirst({
      where: { status: "FAILED" },
      orderBy: { completedAt: "desc" },
    }),
    prisma.agentActionAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        agentType: true,
        action: true,
        status: true,
        errorCode: true,
        createdAt: true,
        riskLevel: true,
      },
    }),
    prisma.agentRun.aggregate({
      where: { createdAt: { gte: dayStart } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.agentRun.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);

  const hour = settings.dailyReportHour;
  const parts = getTashkentDateParts();
  let nextDay = parts.day;
  let nextMonth = parts.month;
  let nextYear = parts.year;
  const tashkentHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tashkent",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
  if (tashkentHour >= hour) {
    const tomorrow = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day + 1)
    );
    const tp = getTashkentDateParts(tomorrow);
    nextDay = tp.day;
    nextMonth = tp.month;
    nextYear = tp.year;
  }

  return ok({
    connection: {
      envEnabled: isAiEmployeesEnvEnabled(),
      gatewayConfigured: isGatewayConfigured(),
      hermesRuntime: "external", // persistent process, not Vercel
    },
    settings,
    stats: {
      runsToday: todayRuns,
      runsMonth: monthRuns,
      failedToday,
      tokensToday: {
        input: tokenAggToday._sum.inputTokens ?? 0,
        output: tokenAggToday._sum.outputTokens ?? 0,
      },
      tokensMonth: {
        input: tokenAggMonth._sum.inputTokens ?? 0,
        output: tokenAggMonth._sum.outputTokens ?? 0,
      },
    },
    lastSuccessfulRun: lastSuccess,
    lastFailedRun: lastFailed,
    nextScheduledRun: {
      timezone: settings.timezone,
      hour,
      date: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`,
    },
    audits: recentAudits,
  });
}

const patchSchema = z.object({
  masterEnabled: z.boolean().optional(),
  managerEnabled: z.boolean().optional(),
  paymentEnabled: z.boolean().optional(),
  analystEnabled: z.boolean().optional(),
  telegramReportsEnabled: z.boolean().optional(),
  dryRunDefault: z.boolean().optional(),
  dailyReportHour: z.number().int().min(0).max(23).optional(),
});

/** PATCH /api/ai-employees — toggle settings (no secrets) */
export async function PATCH(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!assertAdmin(auth.user.role)) {
    return fail("Faqat admin", 403);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation xatosi", 400);
  }

  const settings = await updateAgentSettings(parsed.data, auth.user.id);
  return ok({ settings });
}
