import { NextRequest } from "next/server";

import { requireAiAgentContentAdmin } from "@/lib/api-server/ai-agent-content/auth";
import {
  aiAgentMediaSchema,
  normalizeMediaInput,
} from "@/lib/api-server/ai-agent-content/schemas";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

async function assertRoomInWorkspace(
  roomId: string | null,
  workspaceId: string
): Promise<string | null> {
  if (!roomId) return null;
  const room = await prisma.property.findFirst({
    where: { id: roomId, workspaceId },
    select: { id: true },
  });
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }
  return room.id;
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const { page, limit, skip, search } = parsePagination(url);
  const category = url.searchParams.get("category")?.trim();
  const roomId = url.searchParams.get("roomId")?.trim();
  const activeParam = url.searchParams.get("active");

  const where: Record<string, unknown> = { ...gate.ws };
  if (category) where.category = category;
  if (roomId) where.roomId = roomId;
  if (activeParam === "1") where.active = true;
  if (activeParam === "0") where.active = false;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.aiAgentMedia.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      include: {
        room: { select: { id: true, title: true, building: true } },
      },
    }),
    prisma.aiAgentMedia.count({ where }),
  ]);
  return ok(paginated(data, total, page, limit));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("JSON body talab qilinadi", 400, "INVALID_JSON");
  }
  const parsed = aiAgentMediaSchema.safeParse(json);
  if (!parsed.success) return fail("Validation xatosi", 400, "VALIDATION_ERROR");

  const data = normalizeMediaInput(parsed.data);
  try {
    data.roomId = await assertRoomInWorkspace(data.roomId, gate.workspaceId);
  } catch {
    return fail("Xona topilmadi", 400, "ROOM_NOT_FOUND");
  }

  const row = await prisma.aiAgentMedia.create({
    data: { workspaceId: gate.workspaceId, ...data },
    include: {
      room: { select: { id: true, title: true, building: true } },
    },
  });
  return ok(row, 201);
}
