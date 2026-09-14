import type {
  AgentActionStatus,
  AgentRiskLevel,
  AgentRunStatus,
  AgentTriggerType,
  AgentType,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { summarizeForAudit } from "@/lib/api-server/agent-gateway/redact";

export async function createAgentRun(input: {
  agentType: AgentType;
  triggerType: AgentTriggerType;
  triggerRef?: string;
  traceId?: string;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  if (input.idempotencyKey) {
    const existing = await prisma.agentRun.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { run: existing, duplicate: true as const };
    }
  }

  try {
    const run = await prisma.agentRun.create({
      data: {
        agentType: input.agentType,
        triggerType: input.triggerType,
        triggerRef: input.triggerRef,
        traceId: input.traceId,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
        status: "PENDING",
      },
    });
    return { run, duplicate: false as const };
  } catch (err) {
    // Unique race on idempotencyKey
    if (input.idempotencyKey) {
      const existing = await prisma.agentRun.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return { run: existing, duplicate: true as const };
    }
    throw err;
  }
}

export async function patchAgentRun(
  id: string,
  data: {
    status?: AgentRunStatus;
    startedAt?: Date;
    completedAt?: Date;
    modelProvider?: string;
    model?: string;
    modelVersion?: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCost?: number | null;
    metadata?: Prisma.InputJsonValue;
    errorCode?: string;
    errorSummary?: string;
  }
) {
  return prisma.agentRun.update({
    where: { id },
    data: {
      ...data,
      estimatedCost:
        data.estimatedCost === undefined
          ? undefined
          : data.estimatedCost === null
            ? null
            : data.estimatedCost,
    },
  });
}

export async function writeAgentActionAudit(input: {
  runId?: string;
  agentType: AgentType;
  action: string;
  riskLevel?: AgentRiskLevel;
  requiredScope?: string;
  targetType?: string;
  targetId?: string;
  input?: unknown;
  output?: unknown;
  status: AgentActionStatus;
  errorCode?: string;
  idempotencyKey?: string;
  durationMs?: number;
}) {
  if (input.idempotencyKey) {
    const existing = await prisma.agentActionAudit.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { audit: existing, duplicate: true as const };
    }
  }

  try {
    const audit = await prisma.agentActionAudit.create({
      data: {
        runId: input.runId,
        agentType: input.agentType,
        action: input.action,
        riskLevel: input.riskLevel ?? "LOW",
        requiredScope: input.requiredScope,
        targetType: input.targetType,
        targetId: input.targetId,
        inputSummary: summarizeForAudit(input.input),
        outputSummary: summarizeForAudit(input.output),
        status: input.status,
        errorCode: input.errorCode,
        idempotencyKey: input.idempotencyKey,
        durationMs: input.durationMs,
      },
    });
    return { audit, duplicate: false as const };
  } catch (err) {
    if (input.idempotencyKey) {
      const existing = await prisma.agentActionAudit.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return { audit: existing, duplicate: true as const };
    }
    throw err;
  }
}
