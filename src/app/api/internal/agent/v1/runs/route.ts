import { NextRequest } from "next/server";
import { z } from "zod";

import { createAgentRun } from "@/lib/api-server/agent-gateway/audit";
import { requireAgentAuth } from "@/lib/api-server/agent-gateway/require-agent";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

const createSchema = z.object({
  agentType: z.enum(["MANAGER", "PAYMENT", "ANALYST", "SYSTEM"]),
  triggerType: z.enum(["SCHEDULE", "EVENT", "MANUAL", "TEST"]),
  triggerRef: z.string().max(200).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** POST /api/internal/agent/v1/runs */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501, "DB_NOT_CONFIGURED");
  }

  const auth = await requireAgentAuth(req, ["agent:runs:create"]);
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation xatosi", 400, "VALIDATION_ERROR");
  }

  const { run, duplicate } = await createAgentRun({
    agentType: parsed.data.agentType,
    triggerType: parsed.data.triggerType,
    triggerRef: parsed.data.triggerRef,
    traceId: auth.ctx.traceId,
    idempotencyKey: parsed.data.idempotencyKey,
    metadata: parsed.data.metadata
      ? (parsed.data.metadata as object)
      : undefined,
  });

  return ok(
    {
      run,
      duplicate,
      status: duplicate ? "already_processed" : "created",
    },
    duplicate ? 200 : 201
  );
}
