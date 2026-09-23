import { NextRequest } from "next/server";

import { requireAiAgentContentAdmin } from "@/lib/api-server/ai-agent-content/auth";
import { aiAgentScriptSchema } from "@/lib/api-server/ai-agent-content/schemas";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

/** GET /api/ai-agent/scripts */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const gate = await requireAiAgentContentAdmin(req);
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const { page, limit, skip, search } = parsePagination(url);
  const category = url.searchParams.get("category")?.trim();
  const activeParam = url.searchParams.get("active");

  const where: Record<string, unknown> = { ...gate.ws };
  if (category) where.category = category;
  if (activeParam === "1") where.active = true;
  if (activeParam === "0") where.active = false;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.aiAgentScript.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.aiAgentScript.count({ where }),
  ]);

  return ok(paginated(data, total, page, limit));
}

/** POST /api/ai-agent/scripts */
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

  const parsed = aiAgentScriptSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation xatosi", 400, "VALIDATION_ERROR");
  }

  const row = await prisma.aiAgentScript.create({
    data: {
      workspaceId: gate.workspaceId,
      title: parsed.data.title,
      category: parsed.data.category,
      content: parsed.data.content,
      active: parsed.data.active ?? true,
    },
  });
  return ok(row, 201);
}
