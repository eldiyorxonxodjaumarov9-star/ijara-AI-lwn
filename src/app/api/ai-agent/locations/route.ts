import { NextRequest } from "next/server";

import { requireAiAgentContentAdmin } from "@/lib/api-server/ai-agent-content/auth";
import {
  aiAgentLocationSchema,
  normalizeLocationInput,
} from "@/lib/api-server/ai-agent-content/schemas";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const { page, limit, skip, search } = parsePagination(url);
  const activeParam = url.searchParams.get("active");
  const where: Record<string, unknown> = { ...gate.ws };
  if (activeParam === "1") where.active = true;
  if (activeParam === "0") where.active = false;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { landmark: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.aiAgentLocation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.aiAgentLocation.count({ where }),
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
  const parsed = aiAgentLocationSchema.safeParse(json);
  if (!parsed.success) return fail("Validation xatosi", 400, "VALIDATION_ERROR");

  try {
    const row = await prisma.aiAgentLocation.create({
      data: {
        workspaceId: gate.workspaceId,
        ...normalizeLocationInput(parsed.data),
      },
    });
    return ok(row, 201);
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_MAP_URL") {
      return fail("mapUrl noto‘g‘ri", 400, "VALIDATION_ERROR");
    }
    throw e;
  }
}
