import { NextRequest } from "next/server";

import { requireAiAgentContentAdmin } from "@/lib/api-server/ai-agent-content/auth";
import {
  aiAgentLocationSchema,
  normalizeLocationInput,
} from "@/lib/api-server/ai-agent-content/schemas";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const row = await prisma.aiAgentLocation.findFirst({
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
  const existing = await prisma.aiAgentLocation.findFirst({
    where: { id, workspaceId: gate.workspaceId },
  });
  if (!existing) return fail("Topilmadi", 404, "NOT_FOUND");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }
  const parsed = aiAgentLocationSchema.partial().safeParse(json);
  if (!parsed.success) return fail("Validation xatosi", 400, "VALIDATION_ERROR");

  try {
    const data = normalizeLocationInput({
      title: parsed.data.title ?? existing.title,
      address: parsed.data.address ?? existing.address,
      landmark:
        parsed.data.landmark !== undefined
          ? parsed.data.landmark
          : existing.landmark,
      mapUrl:
        parsed.data.mapUrl !== undefined ? parsed.data.mapUrl : existing.mapUrl,
      workingHours:
        parsed.data.workingHours !== undefined
          ? parsed.data.workingHours
          : existing.workingHours,
      description:
        parsed.data.description !== undefined
          ? parsed.data.description
          : existing.description,
      active: parsed.data.active ?? existing.active,
    });

    const row = await prisma.aiAgentLocation.update({ where: { id }, data });
    return ok(row);
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_MAP_URL") {
      return fail("mapUrl noto‘g‘ri", 400, "VALIDATION_ERROR");
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const existing = await prisma.aiAgentLocation.findFirst({
    where: { id, workspaceId: gate.workspaceId },
  });
  if (!existing) return fail("Topilmadi", 404, "NOT_FOUND");
  await prisma.aiAgentLocation.delete({ where: { id } });
  return ok({ id, deleted: true });
}
