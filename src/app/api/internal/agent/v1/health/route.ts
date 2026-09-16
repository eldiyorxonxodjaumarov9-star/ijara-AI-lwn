import { NextRequest } from "next/server";

import { verifyAgentAccessToken } from "@/lib/api-server/agent-gateway/auth";
import {
  isAiEmployeesEnvEnabled,
  isGatewayConfigured,
} from "@/lib/api-server/agent-gateway/config";
import { getOrCreateAgentSettings } from "@/lib/api-server/agent-gateway/settings";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { isTelegramBotConfigured } from "@/lib/api-server/telegram-bot";
import { ok } from "@/lib/api-server/http";

/**
 * GET /api/internal/agent/v1/health
 * Unauthenticated: minimal. Bearer agent token: detailed (no secrets).
 */
export async function GET(req: NextRequest) {
  const envEnabled = isAiEmployeesEnvEnabled();
  const configured = isGatewayConfigured();

  const header = req.headers.get("authorization");
  const hasBearer = Boolean(header?.startsWith("Bearer "));
  let detailed = false;
  if (hasBearer && header) {
    const verified = verifyAgentAccessToken(header.slice(7));
    detailed = verified.ok;
  }

  if (!detailed) {
    return ok({ ok: envEnabled && configured });
  }

  let databaseOk = false;
  if (isDatabaseConfigured()) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseOk = true;
    } catch {
      databaseOk = false;
    }
  }

  const settings = databaseOk ? await getOrCreateAgentSettings() : null;

  const [lastSuccess, lastFailed] = databaseOk
    ? await Promise.all([
        prisma.agentRun.findFirst({
          where: { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          select: {
            id: true,
            agentType: true,
            completedAt: true,
            model: true,
          },
        }),
        prisma.agentRun.findFirst({
          where: { status: "FAILED" },
          orderBy: { completedAt: "desc" },
          select: {
            id: true,
            agentType: true,
            completedAt: true,
            errorCode: true,
          },
        }),
      ])
    : [null, null];

  return ok({
    status: envEnabled && configured && databaseOk ? "ok" : "degraded",
    service: "arenda-ai-agent-gateway",
    aiEmployeesEnabled: envEnabled,
    gatewayConfigured: configured,
    databaseReachable: databaseOk,
    killSwitch: {
      envEnabled,
      masterEnabled: settings?.masterEnabled ?? false,
    },
    telegram: {
      botConfigured: isTelegramBotConfigured(),
      reportsEnabled: settings?.telegramReportsEnabled ?? false,
      dryRunDefault: settings?.dryRunDefault ?? true,
    },
    agents: settings
      ? {
          manager: settings.managerEnabled,
          payment: settings.paymentEnabled,
          analyst: settings.analystEnabled,
        }
      : null,
    schedule: settings
      ? {
          timezone: settings.timezone,
          dailyReportHour: settings.dailyReportHour,
        }
      : null,
    lastSuccessfulRun: lastSuccess,
    lastFailedRun: lastFailed,
  });
}
