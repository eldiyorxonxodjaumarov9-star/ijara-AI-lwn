import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { getPortalDataForTenant } from "@/lib/api-server/portal-data";
import { requirePortalTenant } from "@/lib/api-server/portal-session";

/** Ijarachi portali: signed sessiondan tenantId olinadi (IDOR himoya) */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const claimedId = body.tenantId ? String(body.tenantId).trim() : null;
    const portal = requirePortalTenant(req, claimedId);
    if ("error" in portal) return portal.error;

    const data = await getPortalDataForTenant(portal.tenantId);
    if (!data) return fail("Ma'lumot topilmadi", 404);

    return ok(data);
  } catch {
    return fail("Xatolik yuz berdi", 500);
  }
}
