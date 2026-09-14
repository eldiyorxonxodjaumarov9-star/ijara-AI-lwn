import { NextRequest } from "next/server";
import { z } from "zod";

import { patchAgentRun } from "@/lib/api-server/agent-gateway/audit";
import { requireAgentAuth } from "@/lib/api-server/agent-gateway/require-agent";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

const patchSchema = z.object({
  status: z
    .enum([
      "PENDING",
      "RUNNING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "SKIPPED",
    ])
    .optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  modelProvider: z.string().max(64).optional(),
  model: z.string().max(128).optional(),
  modelVersion: z.string().max(64).optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  estimatedCost: z.number().nonnegative().nullable().optional(),
  errorCode: z.string().max(64).optional(),
  errorSummary: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/internal/agent/v1/runs/:id */
export async function PATCH(req: NextRequest, context: Ctx) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501, "DB_NOT_CONFIGURED");
  }

  const auth = await requireAgentAuth(req, ["agent:runs:create"]);
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const existing = await prisma.agentRun.findUnique({ where: { id } });
  if (!existing) {
    return fail("Run topilmadi", 404, "RUN_NOT_FOUND");
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation xatosi", 400, "VALIDATION_ERROR");
  }

  const run = await patchAgentRun(id, {
    status: parsed.data.status,
    startedAt: parsed.data.startedAt
      ? new Date(parsed.data.startedAt)
      : undefined,
    completedAt: parsed.data.completedAt
      ? new Date(parsed.data.completedAt)
      : undefined,
    modelProvider: parsed.data.modelProvider,
    model: parsed.data.model,
    modelVersion: parsed.data.modelVersion,
    inputTokens: parsed.data.inputTokens,
    outputTokens: parsed.data.outputTokens,
    estimatedCost: parsed.data.estimatedCost,
    errorCode: parsed.data.errorCode,
    errorSummary: parsed.data.errorSummary,
    metadata: parsed.data.metadata
      ? (parsed.data.metadata as object)
      : undefined,
  });

  return ok({ run });
}
