import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAiEmployeesAccess, usageLoaderFor } from "@/lib/api-server/ai-agents/access";
import { AI_AGENT_KINDS, AI_AGENTS } from "@/lib/api-server/ai-agents/agents";
import { readDeepSeekConfig } from "@/lib/api-server/ai-agents/deepseek";
import { runAiAgent, runDailyReport, type AgentRunOutcome } from "@/lib/api-server/ai-agents/run-agent";
import { getWorkspaceAgentSettings } from "@/lib/api-server/agent-gateway/settings";
import { checkAgentRateLimit } from "@/lib/api-server/agent-gateway/rate-limit";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

export const maxDuration = 120;

const bodySchema = z
  .object({
    mode: z.enum(["agent", "test", "daily"]).default("test"),
    agent: z.enum(AI_AGENT_KINDS).optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();

function agentResponse(outcome: AgentRunOutcome) {
  if (outcome.ok) {
    return {
      agent: outcome.agent,
      status: "completed" as const,
      runId: outcome.runId,
      report: outcome.report,
      dataAsOf: outcome.dataAsOf,
      toolsUsed: outcome.toolsUsed,
      model: outcome.model,
      usage: outcome.usage,
      countedAsAiWork: outcome.countedAsAiWork,
    };
  }
  return { agent: outcome.agent, status: "failed" as const, runId: outcome.runId, errorCode: outcome.errorCode, message: outcome.message };
}

/**
 * POST /api/ai-employees/trigger — DeepSeek agents on the caller's workspace.
 * The workspace always comes from the session; the body cannot name one.
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const access = await requireAiEmployeesAccess(req, "run");
  if (access.error) return access.error;
  const { workspaceId, wsCtx, user } = access;

  if (!checkAgentRateLimit(`ai-employees:${user.id}`).ok) return fail("Rate limit", 429, "RATE_LIMITED");

  let json: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) json = JSON.parse(text);
  } catch {
    return fail("JSON body yaroqsiz", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail("Validation xatosi", 400, "VALIDATION_ERROR");
  const { mode } = parsed.data;

  if (!readDeepSeekConfig()) return fail("DeepSeek ulanmagan", 503, "DEEPSEEK_NOT_CONFIGURED");

  const settings = await getWorkspaceAgentSettings(workspaceId);
  const loadUsageAnalytics = usageLoaderFor(wsCtx);

  if (mode === "agent") {
    const agent = parsed.data.agent;
    if (!agent) return fail("Agent tanlanmagan", 400, "AGENT_REQUIRED");
    if (!settings.masterEnabled) return fail("Master o‘chirilgan", 409, "MASTER_DISABLED");
    if (!settings[AI_AGENTS[agent].settingKey]) return fail(`${AI_AGENTS[agent].label} o‘chirilgan`, 409, "AGENT_DISABLED");
    const outcome = await runAiAgent({
      workspaceId,
      agent,
      trigger: "MANUAL",
      dryRun: parsed.data.dryRun ?? settings.dryRunDefault,
      userId: user.id,
      loadUsageAnalytics,
    });
    if (!outcome.ok) return fail(outcome.message, 503, outcome.errorCode);
    return ok({ mode, dryRun: parsed.data.dryRun ?? settings.dryRunDefault, ...agentResponse(outcome) });
  }

  if (mode === "daily" && !settings.masterEnabled) return fail("Master o‘chirilgan", 409, "MASTER_DISABLED");

  const dryRun = mode === "test" ? true : (parsed.data.dryRun ?? settings.dryRunDefault);
  const outcome = await runDailyReport({
    workspaceId,
    trigger: mode === "test" ? "TEST" : "MANUAL",
    dryRun,
    userId: user.id,
    settings,
    loadUsageAnalytics,
  });
  if (outcome.status === "already_processed") return ok({ mode, status: outcome.status, runId: outcome.runId });
  if (outcome.status === "failed") {
    const first = outcome.agents.find((a) => !a.ok);
    return fail(first && !first.ok ? first.message : "Agentlar yoqilmagan", 503, first && !first.ok ? first.errorCode : "NO_AGENTS_ENABLED");
  }
  return ok({
    mode,
    status: outcome.status,
    dryRun,
    runId: outcome.runId,
    report: outcome.report,
    dataAsOf: outcome.dataAsOf,
    delivery: outcome.delivery,
    agents: outcome.agents.map(agentResponse),
  });
}
