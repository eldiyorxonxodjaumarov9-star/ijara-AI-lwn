import type { AgentRun, AgentType } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAiEmployeesAccess, canAiEmployees } from "@/lib/api-server/ai-agents/access";
import { AI_AGENT_KINDS, AI_AGENTS } from "@/lib/api-server/ai-agents/agents";
import { deepSeekStatus } from "@/lib/api-server/ai-agents/deepseek";
import { DEEPSEEK_PROVIDER, errorMessageFor } from "@/lib/api-server/ai-agents/run-agent";
import {
  getWorkspaceAgentSettings,
  updateWorkspaceAgentSettings,
} from "@/lib/api-server/agent-gateway/settings";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";

function tashkentDayStart(now = new Date()) {
  const p = getTashkentDateParts(now);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, -5, 0, 0));
}

function tashkentMonthStart(now = new Date()) {
  const p = getTashkentDateParts(now);
  return new Date(Date.UTC(p.year, p.month - 1, 1, -5, 0, 0));
}

function nextRunDate(hour: number, now = new Date()) {
  const parts = getTashkentDateParts(now);
  const tashkentHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "numeric", hour12: false }).format(now)
  );
  const day = tashkentHour >= hour ? getTashkentDateParts(new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1))) : parts;
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

function runView(run: AgentRun | null) {
  if (!run) return null;
  const meta = (run.metadata ?? {}) as Record<string, unknown>;
  return {
    id: run.id,
    status: run.status,
    triggerType: run.triggerType,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    model: run.model,
    dryRun: meta.dryRun === true,
    dataAsOf: typeof meta.dataAsOf === "string" ? meta.dataAsOf : null,
    toolsUsed: Array.isArray(meta.toolsUsed) ? meta.toolsUsed : [],
    report: run.status === "COMPLETED" && typeof meta.report === "string" ? meta.report : null,
    errorCode: run.errorCode,
    errorMessage: run.status === "FAILED" ? (run.errorSummary ?? errorMessageFor(run.errorCode ?? "")) : null,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
  };
}

const AGENT_TYPES: AgentType[] = [...AI_AGENT_KINDS];

/** GET /api/ai-employees — current workspace only. */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const access = await requireAiEmployeesAccess(req, "view");
  if (access.error) return access.error;
  const { workspaceId, user } = access;

  const settings = await getWorkspaceAgentSettings(workspaceId);
  const dayStart = tashkentDayStart();
  const monthStart = tashkentMonthStart();
  const agentRuns = { workspaceId, modelProvider: DEEPSEEK_PROVIDER, agentType: { in: AGENT_TYPES } };
  const withUsage = { inputTokens: { not: null } };

  const [runsToday, runsMonth, failedToday, tokensToday, tokensMonth, usageRunsToday, usageRunsMonth, latest, lastDaily, audits] =
    await Promise.all([
      prisma.agentRun.count({ where: { ...agentRuns, createdAt: { gte: dayStart } } }),
      prisma.agentRun.count({ where: { ...agentRuns, createdAt: { gte: monthStart } } }),
      prisma.agentRun.count({ where: { ...agentRuns, status: "FAILED", createdAt: { gte: dayStart } } }),
      prisma.agentRun.aggregate({
        where: { ...agentRuns, createdAt: { gte: dayStart } },
        _sum: { inputTokens: true, outputTokens: true },
      }),
      prisma.agentRun.aggregate({
        where: { ...agentRuns, createdAt: { gte: monthStart } },
        _sum: { inputTokens: true, outputTokens: true },
      }),
      prisma.agentRun.count({ where: { ...agentRuns, ...withUsage, createdAt: { gte: dayStart } } }),
      prisma.agentRun.count({ where: { ...agentRuns, ...withUsage, createdAt: { gte: monthStart } } }),
      Promise.all(
        AI_AGENT_KINDS.map((agent) =>
          prisma.agentRun.findFirst({
            where: { workspaceId, modelProvider: DEEPSEEK_PROVIDER, agentType: agent },
            orderBy: { createdAt: "desc" },
          })
        )
      ),
      prisma.agentRun.findFirst({
        where: { workspaceId, modelProvider: DEEPSEEK_PROVIDER, agentType: "SYSTEM" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.agentActionAudit.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, agentType: true, action: true, status: true, errorCode: true, createdAt: true, riskLevel: true },
      }),
    ]);

  const provider = deepSeekStatus();
  const tokens = (agg: typeof tokensToday, runsWithUsage: number) =>
    runsWithUsage > 0
      ? { input: agg._sum.inputTokens ?? 0, output: agg._sum.outputTokens ?? 0, runsWithUsage }
      : { input: null, output: null, runsWithUsage: 0 };

  return ok({
    provider: {
      name: "DeepSeek",
      configured: provider.configured,
      model: provider.configured ? provider.model : null,
      missing: provider.configured ? [] : provider.missing,
      mode: "read-only",
    },
    permissions: {
      canRun: canAiEmployees(user.role, "run"),
      canEditSettings: canAiEmployees(user.role, "settings"),
    },
    settings: {
      masterEnabled: settings.masterEnabled,
      managerEnabled: settings.managerEnabled,
      paymentEnabled: settings.paymentEnabled,
      analystEnabled: settings.analystEnabled,
      telegramReportsEnabled: settings.telegramReportsEnabled,
      dryRunDefault: settings.dryRunDefault,
      dailyReportHour: settings.dailyReportHour,
      timezone: settings.timezone,
    },
    stats: {
      runsToday,
      runsMonth,
      failedToday,
      tokensToday: tokens(tokensToday, usageRunsToday),
      tokensMonth: tokens(tokensMonth, usageRunsMonth),
    },
    agents: AI_AGENT_KINDS.map((agent, i) => ({
      agent,
      label: AI_AGENTS[agent].label,
      enabled: settings[AI_AGENTS[agent].settingKey],
      lastRun: runView(latest[i]),
    })),
    lastDailyReport: runView(lastDaily),
    nextScheduledRun: {
      timezone: settings.timezone,
      hour: settings.dailyReportHour,
      date: nextRunDate(settings.dailyReportHour),
    },
    audits,
  });
}

const patchSchema = z
  .object({
    masterEnabled: z.boolean().optional(),
    managerEnabled: z.boolean().optional(),
    paymentEnabled: z.boolean().optional(),
    analystEnabled: z.boolean().optional(),
    telegramReportsEnabled: z.boolean().optional(),
    dryRunDefault: z.boolean().optional(),
    dailyReportHour: z.number().int().min(0).max(23).optional(),
  })
  .strict();

/** PATCH /api/ai-employees — settings of the caller's workspace (admin only). */
export async function PATCH(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const access = await requireAiEmployeesAccess(req, "settings");
  if (access.error) return access.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400);
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return fail("Validation xatosi", 400);

  const settings = await updateWorkspaceAgentSettings(access.workspaceId, parsed.data, access.user.id);
  return ok({ settings });
}
