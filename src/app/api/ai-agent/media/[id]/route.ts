import { NextRequest } from "next/server";

import { requireAiAgentContentAdmin } from "@/lib/api-server/ai-agent-content/auth";
import {
  aiAgentMediaSchema,
  normalizeMediaInput,
} from "@/lib/api-server/ai-agent-content/schemas";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

async function assertRoomInWorkspace(
  roomId: string | null,
  workspaceId: string
): Promise<string | null> {
  if (!roomId) return null;
  const room = await prisma.property.findFirst({
    where: { id: roomId, workspaceId },
    select: { id: true },
  });
  if (!room) throw new Error("ROOM_NOT_FOUND");
  return room.id;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const row = await prisma.aiAgentMedia.findFirst({
    where: { id, workspaceId: gate.workspaceId },
    include: {
      room: { select: { id: true, title: true, building: true } },
    },
  });
  if (!row) return fail("Topilmadi", 404, "NOT_FOUND");
  return ok(row);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const existing = await prisma.aiAgentMedia.findFirst({
    where: { id, workspaceId: gate.workspaceId },
  });
  if (!existing) return fail("Topilmadi", 404, "NOT_FOUND");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }
  const parsed = aiAgentMediaSchema.partial().safeParse(json);
  if (!parsed.success) return fail("Validation xatosi", 400, "VALIDATION_ERROR");

  const data = normalizeMediaInput({
    title: parsed.data.title ?? existing.title,
    category: parsed.data.category ?? existing.category,
    roomId:
      parsed.data.roomId !== undefined ? parsed.data.roomId : existing.roomId,
    description:
      parsed.data.description !== undefined
        ? parsed.data.description
        : existing.description,
    fileUrl: parsed.data.fileUrl ?? existing.fileUrl,
    active: parsed.data.active ?? existing.active,
    sortOrder: parsed.data.sortOrder ?? existing.sortOrder,
  });

  try {
    data.roomId = await assertRoomInWorkspace(data.roomId, gate.workspaceId);
  } catch {
    return fail("Xona topilmadi", 400, "ROOM_NOT_FOUND");
  }

  const row = await prisma.aiAgentMedia.update({
    where: { id },
    data,
    include: {
      room: { select: { id: true, title: true, building: true } },
    },
  });
  return ok(row);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const existing = await prisma.aiAgentMedia.findFirst({
    where: { id, workspaceId: gate.workspaceId },
  });
  if (!existing) return fail("Topilmadi", 404, "NOT_FOUND");
  await prisma.aiAgentMedia.delete({ where: { id } });
  return ok({ id, deleted: true });
}
