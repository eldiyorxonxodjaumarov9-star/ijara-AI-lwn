import { z } from "zod";

import { writeAgentActionAudit } from "@/lib/api-server/agent-gateway/audit";
import type { DailySnapshot } from "@/lib/api-server/agent-gateway/daily-snapshot";
import { formatDailyManagerReportUz } from "@/lib/api-server/agent-gateway/report-format";
import { getOrCreateAgentSettings } from "@/lib/api-server/agent-gateway/settings";
import { sendTelegramMessage } from "@/lib/api-server/telegram-bot";
import { prisma } from "@/lib/api-server/prisma";

export const telegramNotifySchema = z.object({
  type: z.literal("DAILY_MANAGER_REPORT"),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  runId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(200),
  dryRun: z.boolean().optional(),
  recommendations: z.array(z.string().max(300)).max(10).optional(),
  report: z.object({
    dueTodayCount: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
    totalDebt: z.number().nonnegative(),
    vacantRooms: z.number().int().nonnegative().optional(),
    recommendations: z.array(z.string().max(300)).max(10).optional(),
  }),
  /** Structured snapshot preferred; Hermes may send summary-only report above */
  snapshot: z.unknown().optional(),
});

export type TelegramNotifyInput = z.infer<typeof telegramNotifySchema>;

/**
 * Safe Telegram delivery:
 * - no arbitrary chatId
 * - no arbitrary raw message
 * - recipient from linked admin devices only
 * - idempotent by key
 */
export async function deliverDailyManagerTelegram(input: TelegramNotifyInput) {
  const settings = await getOrCreateAgentSettings();
  const dryRun =
    input.dryRun ??
    settings.dryRunDefault ??
    !settings.telegramReportsEnabled;

  const existing = await prisma.agentActionAudit.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return {
      status: "already_processed" as const,
      dryRun: true,
      auditId: existing.id,
      delivered: false,
    };
  }

  const snapshot = input.snapshot as DailySnapshot | undefined;
  const text = snapshot
    ? formatDailyManagerReportUz(
        snapshot,
        input.recommendations ?? input.report.recommendations ?? []
      )
    : [
        "🏢 ARENDA AI — KUNLIK HISOBOT",
        `📅 ${input.reportDate}`,
        "",
        "💰 TO‘LOVLAR",
        `• Bugun to‘lashi kerak: ${input.report.dueTodayCount} ta`,
        `• Kechikkan to‘lovlar: ${input.report.overdueCount} ta`,
        `• Jami qarzdorlik: ${input.report.totalDebt} so‘m`,
        input.report.vacantRooms != null
          ? `• Bo‘sh xonalar: ${input.report.vacantRooms} ta`
          : null,
        "",
        "🧠 AI TAVSIYASI",
        ...((input.recommendations ?? input.report.recommendations ?? []).map(
          (r) => `• ${r}`
        ) || ["• Ma’lumotlar asosida tavsiya yo‘q"]),
      ]
        .filter(Boolean)
        .join("\n");

  if (dryRun || !settings.telegramReportsEnabled) {
    const { audit } = await writeAgentActionAudit({
      runId: input.runId,
      agentType: "MANAGER",
      action: "notifications.telegram.daily_report",
      riskLevel: "LOW",
      requiredScope: "notifications:telegram",
      input: { type: input.type, reportDate: input.reportDate, dryRun: true },
      output: { dryRun: true, previewChars: text.length },
      status: "SUCCEEDED",
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: "dry_run" as const,
      dryRun: true,
      auditId: audit.id,
      delivered: false,
      preview: text,
    };
  }

  const devices = await prisma.telegramAdminDevice.findMany({
    take: 5,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  if (devices.length === 0) {
    const { audit } = await writeAgentActionAudit({
      runId: input.runId,
      agentType: "MANAGER",
      action: "notifications.telegram.daily_report",
      riskLevel: "MEDIUM",
      requiredScope: "notifications:telegram",
      input: { type: input.type, reportDate: input.reportDate },
      output: { error: "NO_ADMIN_DEVICE" },
      status: "FAILED",
      errorCode: "NO_ADMIN_DEVICE",
      idempotencyKey: input.idempotencyKey,
    });
    return {
      status: "failed" as const,
      dryRun: false,
      auditId: audit.id,
      delivered: false,
      errorCode: "NO_ADMIN_DEVICE",
    };
  }

  let sent = 0;
  for (const d of devices) {
    const ok = await sendTelegramMessage(d.chatId, text);
    if (ok) sent += 1;
  }

  const { audit } = await writeAgentActionAudit({
    runId: input.runId,
    agentType: "MANAGER",
    action: "notifications.telegram.daily_report",
    riskLevel: "MEDIUM",
    requiredScope: "notifications:telegram",
    input: { type: input.type, reportDate: input.reportDate, recipients: devices.length },
    output: { sent, total: devices.length },
    status: sent > 0 ? "SUCCEEDED" : "FAILED",
    errorCode: sent > 0 ? undefined : "TELEGRAM_SEND_FAILED",
    idempotencyKey: input.idempotencyKey,
  });

  return {
    status: sent > 0 ? ("sent" as const) : ("failed" as const),
    dryRun: false,
    auditId: audit.id,
    delivered: sent > 0,
    sent,
  };
}
