import { NextRequest } from "next/server";
import { z } from "zod";
import type { TelegramAiLeadStatus } from "@prisma/client";

import { writeAgentActionAudit } from "@/lib/api-server/agent-gateway/audit";
import { authorizeLwnAgentRequest } from "@/lib/api-server/agent-gateway/lwn-agent-auth";
import { upsertTelegramAiLead } from "@/lib/api-server/agent-gateway/telegram-ai-lead";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

const statusEnum = z.enum([
  "NEW",
  "QUALIFYING",
  "QUALIFIED",
  "VIEWING_REQUESTED",
  "HANDOFF",
  "CLOSED",
  "LOST",
]);

const bodySchema = z.object({
  telegramUserId: z.string().trim().min(1).max(64),
  telegramUsername: z.string().trim().max(128).nullable().optional(),
  displayName: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  desiredArea: z.number().finite().positive().nullable().optional(),
  businessType: z.string().trim().max(200).nullable().optional(),
  peopleCount: z.number().int().positive().nullable().optional(),
  moveInDate: z.string().trim().max(120).nullable().optional(),
  budget: z.number().finite().nonnegative().nullable().optional(),
  interestedRoomIds: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  conversationSummary: z.string().trim().max(4000).nullable().optional(),
  status: statusEnum.nullable().optional(),
});

/**
 * POST /api/internal/agent/v1/leads/upsert
 * Auth: same shared token as rooms available endpoint.
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501, "DB_NOT_CONFIGURED");
  }

  const auth = await authorizeLwnAgentRequest(req, ["rooms:read"]);
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation xatosi", 400, "VALIDATION_ERROR");
  }

  const started = Date.now();
  try {
    const lead = await upsertTelegramAiLead({
      ...parsed.data,
      status: (parsed.data.status ?? null) as TelegramAiLeadStatus | null,
    });

    await writeAgentActionAudit({
      runId: req.headers.get("x-run-id")?.trim() || undefined,
      agentType: "SYSTEM",
      action: "leads.upsert",
      riskLevel: "LOW",
      requiredScope: "rooms:read",
      input: {
        traceId: auth.traceId,
        telegramUserId: parsed.data.telegramUserId,
      },
      output: { id: lead.id, status: lead.status },
      status: "SUCCEEDED",
      durationMs: Date.now() - started,
    });

    return ok({
      id: lead.id,
      telegramUserId: lead.telegramUserId,
      status: lead.status,
      phone: lead.phone,
      desiredArea: lead.desiredArea,
      businessType: lead.businessType,
      peopleCount: lead.peopleCount,
      moveInDate: lead.moveInDate,
      budget: lead.budget,
      interestedRoomIds: lead.interestedRoomIds,
      source: lead.source,
      updatedAt: lead.updatedAt.toISOString(),
      createdAt: lead.createdAt.toISOString(),
    });
  } catch (error: unknown) {
    await writeAgentActionAudit({
      runId: req.headers.get("x-run-id")?.trim() || undefined,
      agentType: "SYSTEM",
      action: "leads.upsert",
      riskLevel: "LOW",
      requiredScope: "rooms:read",
      input: { traceId: auth.traceId },
      output: {
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      status: "FAILED",
      durationMs: Date.now() - started,
    });
    return fail("Lead saqlanmadi", 500, "LEAD_UPSERT_FAILED");
  }
}
