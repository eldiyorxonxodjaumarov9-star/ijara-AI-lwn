import type { AgentRun, AgentType } from "@prisma/client";

import type { ActivityAction } from "@/lib/usage-analytics";

const AI_RUN_ACTIONS: Record<AgentType, ActivityAction> = {
  MANAGER: "AI_REPORT_GENERATION",
  ANALYST: "AI_FINANCE_ANALYSIS",
  PAYMENT: "AI_RECOMMENDATION",
  SYSTEM: "AI_EMPLOYEE_ACTION",
};

/**
 * Counts as AI work only on the first transition to COMPLETED of a non-test
 * run that actually reports a model; rule-based runs never set one.
 */
export function completedAiRunAction(
  existing: Pick<AgentRun, "status" | "triggerType" | "agentType" | "model" | "modelProvider">,
  patch: { status?: string; model?: string; modelProvider?: string }
): ActivityAction | null {
  if (patch.status !== "COMPLETED" || existing.status === "COMPLETED") return null;
  if (existing.triggerType === "TEST") return null;
  const model = patch.model ?? existing.model ?? patch.modelProvider ?? existing.modelProvider;
  if (!model?.trim()) return null;
  return AI_RUN_ACTIONS[existing.agentType] ?? null;
}
