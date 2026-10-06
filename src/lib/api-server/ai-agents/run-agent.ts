import type { AgentSettings, Prisma } from "@prisma/client";

import { recordActivity } from "@/lib/api-server/activity-events";
import { createAgentRun, patchAgentRun, writeAgentActionAudit } from "@/lib/api-server/agent-gateway/audit";
import { prisma } from "@/lib/api-server/prisma";
import { sendTelegramMessage } from "@/lib/api-server/telegram-bot";
import { workspaceAdminTelegramChats } from "@/lib/api-server/telegram-admin";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";

import {
  AI_AGENTS,
  buildAgentMessages,
  enforceGrounding,
  formatDataAsOf,
  parseAgentAnalysis,
  renderAgentReport,
  type AgentAnalysis,
  type AiAgentKind,
} from "./agents";
import { deepSeekChat, DeepSeekError, readDeepSeekConfig, type DeepSeekUsage } from "./deepseek";
import { runAgentTools, type ToolDb } from "./tools";

export const DEEPSEEK_PROVIDER = "deepseek";
export type AgentRunTrigger = "MANUAL" | "TEST" | "SCHEDULE";

export type AgentRunDeps = {
  db?: ToolDb;
  chat?: typeof deepSeekChat;
  now?: () => Date;
};

export type AgentRunSuccess = {
  ok: true;
  runId: string;
  agent: AiAgentKind;
  report: string;
  analysis: AgentAnalysis;
  dataAsOf: string;
  toolsUsed: string[];
  model: string;
  usage: DeepSeekUsage | null;
  countedAsAiWork: boolean;
};

export type AgentRunFailure = {
  ok: false;
  runId: string | null;
  agent: AiAgentKind;
  errorCode: string;
  message: string;
};

export type AgentRunOutcome = AgentRunSuccess | AgentRunFailure;

const REPORT_MAX = 12_000;

export function errorMessageFor(code: string) {
  switch (code) {
    case "DEEPSEEK_NOT_CONFIGURED":
      return "DeepSeek ulanmagan";
    case "DEEPSEEK_AUTH_FAILED":
      return "DeepSeek API kaliti rad etildi";
    case "DEEPSEEK_BAD_RESPONSE":
      return "DeepSeek javobi yaroqsiz";
    case "TOOL_ERROR":
      return "Ma’lumotlarni o‘qishda xato";
    default:
      return "DeepSeek vaqtincha mavjud emas";
  }
}

/** AI work = successful, real (not dry-run), non-test run. */
export function countsAsAiWork(trigger: AgentRunTrigger, dryRun: boolean) {
  return trigger !== "TEST" && !dryRun;
}

/**
 * One read-only agent run: fresh tool data for this workspace → DeepSeek →
 * validated, number-grounded report. Never writes business data.
 */
export async function runAiAgent(
  input: {
    workspaceId: string;
    agent: AiAgentKind;
    trigger: AgentRunTrigger;
    dryRun: boolean;
    userId?: string | null;
    parentRunId?: string;
    loadUsageAnalytics: () => Promise<unknown>;
  },
  deps: AgentRunDeps = {}
): Promise<AgentRunOutcome> {
  const config = readDeepSeekConfig();
  if (!config) {
    return { ok: false, runId: null, agent: input.agent, errorCode: "DEEPSEEK_NOT_CONFIGURED", message: "DeepSeek ulanmagan" };
  }
  const chat = deps.chat ?? deepSeekChat;
  const now = (deps.now ?? (() => new Date()))();
  const def = AI_AGENTS[input.agent];
  const baseMeta = { dryRun: input.dryRun, trigger: input.trigger, parentRunId: input.parentRunId ?? null };

  const { run } = await createAgentRun({
    workspaceId: input.workspaceId,
    agentType: input.agent,
    triggerType: input.trigger,
    triggerRef: input.userId ? `user:${input.userId}` : "cron",
    metadata: baseMeta,
  });
  await patchAgentRun(run.id, {
    status: "RUNNING",
    startedAt: now,
    modelProvider: DEEPSEEK_PROVIDER,
    model: config.model,
  });

  const fail = async (errorCode: string, extra: Record<string, unknown> = {}): Promise<AgentRunFailure> => {
    const message = errorMessageFor(errorCode);
    await patchAgentRun(run.id, {
      status: "FAILED",
      completedAt: new Date(),
      errorCode,
      errorSummary: message,
      metadata: { ...baseMeta, ...extra } as Prisma.InputJsonValue,
    });
    await writeAgentActionAudit({
      workspaceId: input.workspaceId,
      runId: run.id,
      agentType: input.agent,
      action: "ai_agent.run",
      input: { trigger: input.trigger, dryRun: input.dryRun },
      output: { errorCode },
      status: "FAILED",
      errorCode,
    });
    return { ok: false, runId: run.id, agent: input.agent, errorCode, message };
  };

  let tools: Awaited<ReturnType<typeof runAgentTools>>;
  try {
    tools = await runAgentTools(def.tools, {
      db: deps.db ?? prisma,
      workspaceId: input.workspaceId,
      now,
      loadUsageAnalytics: input.loadUsageAnalytics,
    });
  } catch (err) {
    console.error("[ai-agents] tool error", { agent: input.agent, error: err instanceof Error ? err.message : "unknown" });
    return fail("TOOL_ERROR");
  }

  const context = {
    dataAsOf: tools.dataAsOf,
    dataAsOfLocal: formatDataAsOf(tools.dataAsOf),
    timezone: "Asia/Tashkent",
    tools: tools.data,
  };

  let completion: Awaited<ReturnType<typeof deepSeekChat>>;
  try {
    completion = await chat({ messages: buildAgentMessages(input.agent, context), jsonMode: true, temperature: 0.2 });
  } catch (err) {
    const code = err instanceof DeepSeekError ? err.code : "DEEPSEEK_UNAVAILABLE";
    return fail(code, { httpStatus: err instanceof DeepSeekError ? err.httpStatus : null });
  }

  const parsed = parseAgentAnalysis(completion.content);
  if (!parsed) return fail("DEEPSEEK_BAD_RESPONSE", { responseId: completion.responseId });
  const { analysis, dropped } = enforceGrounding(parsed, context);
  const report = renderAgentReport({ agent: input.agent, data: tools.data, analysis, dataAsOf: tools.dataAsOf });
  const counted = countsAsAiWork(input.trigger, input.dryRun);

  await patchAgentRun(run.id, {
    status: "COMPLETED",
    completedAt: new Date(),
    model: completion.model,
    ...(completion.usage
      ? { inputTokens: completion.usage.inputTokens, outputTokens: completion.usage.outputTokens }
      : {}),
    metadata: {
      ...baseMeta,
      dataAsOf: tools.dataAsOf,
      toolsUsed: tools.toolsUsed,
      report: report.slice(0, REPORT_MAX),
      analysis,
      droppedUngrounded: dropped,
      responseId: completion.responseId,
      attempts: completion.attempts,
      usageReported: completion.usage !== null,
      countedAsAiWork: counted,
    } as Prisma.InputJsonValue,
  });
  await writeAgentActionAudit({
    workspaceId: input.workspaceId,
    runId: run.id,
    agentType: input.agent,
    action: "ai_agent.run",
    input: { trigger: input.trigger, dryRun: input.dryRun, tools: tools.toolsUsed.length },
    output: { status: "COMPLETED", droppedUngrounded: dropped },
    status: "SUCCEEDED",
  });
  if (counted) {
    await recordActivity({
      workspaceId: input.workspaceId,
      action: def.activity,
      entityType: "AgentRun",
      entityId: run.id,
      metadata: { agent: input.agent, trigger: input.trigger },
    });
  }

  return {
    ok: true,
    runId: run.id,
    agent: input.agent,
    report,
    analysis,
    dataAsOf: tools.dataAsOf,
    toolsUsed: tools.toolsUsed,
    model: completion.model,
    usage: completion.usage,
    countedAsAiWork: counted,
  };
}

/* ------------------------------ daily report ------------------------------ */

export function enabledAgents(settings: Pick<AgentSettings, "managerEnabled" | "paymentEnabled" | "analystEnabled">) {
  return (Object.keys(AI_AGENTS) as AiAgentKind[]).filter((k) => settings[AI_AGENTS[k].settingKey]);
}

function tashkentDate(now: Date) {
  const p = getTashkentDateParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function dailyReportKey(workspaceId: string, date: string) {
  return `deepseek-daily:${workspaceId}:${date}`;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function chunkTelegram(text: string, max = 3900): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if (cur && cur.length + line.length + 1 > max) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n${line}` : line.slice(0, max);
  }
  if (cur) out.push(cur);
  return out;
}

export type DailyDelivery =
  | { status: "dry_run"; reason: "dry_run" | "telegram_disabled" | "test" }
  | { status: "sent"; recipients: number }
  | { status: "failed"; errorCode: "NO_ADMIN_DEVICE" | "TELEGRAM_SEND_FAILED" };

export type DailyReportOutcome =
  | { status: "already_processed"; runId: string }
  | {
      status: "completed" | "failed";
      runId: string;
      report: string | null;
      agents: AgentRunOutcome[];
      delivery: DailyDelivery | null;
      dataAsOf: string | null;
    };

/**
 * Manager + Payment + Analyst on fresh data, combined into one report.
 * Telegram only when not dry-run, reports enabled and not a test run.
 */
export async function runDailyReport(
  input: {
    workspaceId: string;
    trigger: AgentRunTrigger;
    dryRun: boolean;
    userId?: string | null;
    settings: Pick<
      AgentSettings,
      "managerEnabled" | "paymentEnabled" | "analystEnabled" | "telegramReportsEnabled"
    >;
    loadUsageAnalytics: () => Promise<unknown>;
  },
  deps: AgentRunDeps & { send?: typeof sendTelegramMessage; recipients?: typeof workspaceAdminTelegramChats } = {}
): Promise<DailyReportOutcome> {
  const now = (deps.now ?? (() => new Date()))();
  const date = tashkentDate(now);
  const { run, duplicate } = await createAgentRun({
    workspaceId: input.workspaceId,
    agentType: "SYSTEM",
    triggerType: input.trigger,
    triggerRef: input.userId ? `user:${input.userId}` : "cron",
    idempotencyKey: input.trigger === "SCHEDULE" ? dailyReportKey(input.workspaceId, date) : undefined,
    metadata: { dryRun: input.dryRun, kind: "daily_report", date },
  });
  if (duplicate) return { status: "already_processed", runId: run.id };
  await patchAgentRun(run.id, { status: "RUNNING", startedAt: now, modelProvider: DEEPSEEK_PROVIDER });

  const agents = enabledAgents(input.settings);
  const outcomes = await Promise.all(
    agents.map((agent) =>
      runAiAgent(
        {
          workspaceId: input.workspaceId,
          agent,
          trigger: input.trigger,
          dryRun: input.dryRun,
          userId: input.userId,
          parentRunId: run.id,
          loadUsageAnalytics: input.loadUsageAnalytics,
        },
        deps
      )
    )
  );
  const succeeded = outcomes.filter((o): o is AgentRunSuccess => o.ok);

  if (succeeded.length === 0) {
    const errorCode = outcomes.find((o): o is AgentRunFailure => !o.ok)?.errorCode ?? "NO_AGENTS_ENABLED";
    await patchAgentRun(run.id, {
      status: "FAILED",
      completedAt: new Date(),
      errorCode,
      errorSummary: errorMessageFor(errorCode),
      metadata: { dryRun: input.dryRun, kind: "daily_report", date, agents: outcomes.map((o) => ({ agent: o.agent, ok: o.ok })) },
    });
    return { status: "failed", runId: run.id, report: null, agents: outcomes, delivery: null, dataAsOf: null };
  }

  const dataAsOf = succeeded.map((o) => o.dataAsOf).sort()[0];
  const report = [
    "🏢 IJARA AI — KUNLIK HISOBOT (DeepSeek)",
    `📅 ${date}`,
    "",
    ...outcomes.flatMap((o) => (o.ok ? [o.report, ""] : [`❌ ${AI_AGENTS[o.agent].label} Agent: ${o.message}`, ""])),
  ]
    .join("\n")
    .trim();

  let delivery: DailyDelivery;
  if (input.trigger === "TEST") delivery = { status: "dry_run", reason: "test" };
  else if (input.dryRun) delivery = { status: "dry_run", reason: "dry_run" };
  else if (!input.settings.telegramReportsEnabled) delivery = { status: "dry_run", reason: "telegram_disabled" };
  else {
    const chats = await (deps.recipients ?? workspaceAdminTelegramChats)(input.workspaceId);
    if (chats.length === 0) delivery = { status: "failed", errorCode: "NO_ADMIN_DEVICE" };
    else {
      const send = deps.send ?? sendTelegramMessage;
      let sent = 0;
      for (const chatId of chats) {
        try {
          let okAll = true;
          for (const part of chunkTelegram(escapeHtml(report))) okAll = (await send(chatId, part)) && okAll;
          if (okAll) sent += 1;
        } catch {
          // counted as not sent
        }
      }
      delivery = sent > 0 ? { status: "sent", recipients: sent } : { status: "failed", errorCode: "TELEGRAM_SEND_FAILED" };
    }
  }

  await patchAgentRun(run.id, {
    status: "COMPLETED",
    completedAt: new Date(),
    metadata: {
      dryRun: input.dryRun,
      kind: "daily_report",
      date,
      dataAsOf,
      report: report.slice(0, REPORT_MAX),
      agents: outcomes.map((o) => ({ agent: o.agent, ok: o.ok, runId: o.runId })),
      delivery,
    } as Prisma.InputJsonValue,
  });
  await writeAgentActionAudit({
    workspaceId: input.workspaceId,
    runId: run.id,
    agentType: "SYSTEM",
    action: "ai_agent.daily_report",
    input: { trigger: input.trigger, dryRun: input.dryRun, agents: agents.length },
    output: { delivery: delivery.status },
    status: "SUCCEEDED",
  });
  if (delivery.status === "sent" && input.trigger === "SCHEDULE") {
    await recordActivity({
      workspaceId: input.workspaceId,
      action: "SCHEDULED_REPORT_SENT",
      entityType: "AgentRun",
      entityId: run.id,
      metadata: { report: "AI_DAILY_REPORT", recipients: delivery.recipients },
    });
  }

  return { status: "completed", runId: run.id, report, agents: outcomes, delivery, dataAsOf };
}
