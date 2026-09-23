import { NextRequest } from "next/server";

import { writeAgentActionAudit } from "@/lib/api-server/agent-gateway/audit";
import { authorizeLwnAgentRequest } from "@/lib/api-server/agent-gateway/lwn-agent-auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { LWN_BUILDING } from "@/lib/constants";

/**
 * GET /api/internal/agent/v1/rooms/available
 *
 * Returns AVAILABLE LWN rooms from existing Property table (no duplicate inventory).
 * Auth: Agent Gateway Bearer (rooms:read) OR static LWN_TELEGRAM_AGENT_TOKEN.
 *
 * Query: minArea, maxArea, peopleCount (optional soft filters).
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501, "DB_NOT_CONFIGURED");
  }

  const auth = await authorizeLwnAgentRequest(req, ["rooms:read"]);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const minArea = parseOptionalNumber(url.searchParams.get("minArea"));
  const maxArea = parseOptionalNumber(url.searchParams.get("maxArea"));
  const peopleCount = parseOptionalNumber(url.searchParams.get("peopleCount"));

  const started = Date.now();
  const areaFilter: { gte?: number; lte?: number } = {};
  if (minArea !== null) areaFilter.gte = minArea;
  if (maxArea !== null) areaFilter.lte = maxArea;

  const rows = await prisma.property.findMany({
    where: {
      status: "AVAILABLE",
      OR: [{ building: LWN_BUILDING }, { district: LWN_BUILDING }],
      ...(Object.keys(areaFilter).length > 0 ? { area: areaFilter } : {}),
    },
    orderBy: [{ area: "asc" }, { title: "asc" }],
    take: 50,
  });

  // peopleCount: Property has no capacity field; do not invent. Soft-ignore.
  void peopleCount;

  const rooms = rows.map((row) => ({
    id: row.id,
    name: row.title,
    number: row.title,
    area: row.area,
    price: row.rentPrice > 0 ? row.rentPrice : null,
    floor: null as number | null,
    status: "AVAILABLE" as const,
    capacity: null as number | null,
    availableFrom: null as string | null,
    building: row.building,
    address: row.address,
  }));

  await writeAgentActionAudit({
    runId: req.headers.get("x-run-id")?.trim() || undefined,
    agentType: "SYSTEM",
    action: "rooms.available.read",
    riskLevel: "LOW",
    requiredScope: "rooms:read",
    input: {
      traceId: auth.traceId,
      minArea,
      maxArea,
      peopleCount,
    },
    output: { count: rooms.length },
    status: "SUCCEEDED",
    durationMs: Date.now() - started,
  });

  return ok({ rooms, count: rooms.length, source: "ijara_properties" });
}

function parseOptionalNumber(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
