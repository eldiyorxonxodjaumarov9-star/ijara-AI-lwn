import { NextRequest } from "next/server";

import { requireAiAgentContentAdmin } from "@/lib/api-server/ai-agent-content/auth";
import { aiAgentScriptSchema } from "@/lib/api-server/ai-agent-content/schemas";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

async function findOwned(id: string, workspaceId: string) {
  return prisma.aiAgentScript.findFirst({
    where: { id, workspaceId },
  });
}

/** GET /api/ai-agent/scripts/:id */
export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const row = await findOwned(id, gate.workspaceId);
  if (!row) return fail("Topilmadi", 404, "NOT_FOUND");
  return ok(row);
}

/** PATCH /api/ai-agent/scripts/:id */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const existing = await findOwned(id, gate.workspaceId);
  if (!existing) return fail("Topilmadi", 404, "NOT_FOUND");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }

  const parsed = aiAgentScriptSchema.partial().safeParse(json);
  if (!parsed.success) {
    return fail("Validation xatosi", 400, "VALIDATION_ERROR");
  }

  const row = await prisma.aiAgentScript.update({
    where: { id },
    data: parsed.data,
  });
  return ok(row);
}

/** DELETE /api/ai-agent/scripts/:id */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const existing = await findOwned(id, gate.workspaceId);
  if (!existing) return fail("Topilmadi", 404, "NOT_FOUND");
  await prisma.aiAgentScript.delete({ where: { id } });
  return ok({ id, deleted: true });
}
