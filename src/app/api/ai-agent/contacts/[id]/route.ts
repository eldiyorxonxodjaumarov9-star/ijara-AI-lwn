import { NextRequest } from "next/server";

import { requireAiAgentContentAdmin } from "@/lib/api-server/ai-agent-content/auth";
import {
  aiAgentContactSchema,
  normalizeContactInput,
} from "@/lib/api-server/ai-agent-content/schemas";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const row = await prisma.aiAgentContact.findFirst({
    where: { id, workspaceId: gate.workspaceId },
  });
  if (!row) return fail("Topilmadi", 404, "NOT_FOUND");
  return ok(row);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const existing = await prisma.aiAgentContact.findFirst({
    where: { id, workspaceId: gate.workspaceId },
  });
  if (!existing) return fail("Topilmadi", 404, "NOT_FOUND");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }
  const parsed = aiAgentContactSchema.partial().safeParse(json);
  if (!parsed.success) return fail("Validation xatosi", 400, "VALIDATION_ERROR");

  const data = normalizeContactInput({
    name: parsed.data.name ?? existing.name,
    role: parsed.data.role !== undefined ? parsed.data.role : existing.role,
    phone: parsed.data.phone !== undefined ? parsed.data.phone : existing.phone,
    telegramUsername:
      parsed.data.telegramUsername !== undefined
        ? parsed.data.telegramUsername
        : existing.telegramUsername,
    note: parsed.data.note !== undefined ? parsed.data.note : existing.note,
    active: parsed.data.active ?? existing.active,
  });

  const row = await prisma.aiAgentContact.update({ where: { id }, data });
  return ok(row);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const existing = await prisma.aiAgentContact.findFirst({
    where: { id, workspaceId: gate.workspaceId },
  });
  if (!existing) return fail("Topilmadi", 404, "NOT_FOUND");
  await prisma.aiAgentContact.delete({ where: { id } });
  return ok({ id, deleted: true });
}
