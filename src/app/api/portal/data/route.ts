import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  getPortalDataForTenant,
  resolveTenantById,
} from "@/lib/api-server/portal-data";

/** Ijarachi portali: shartnoma, to'lovlar va boshqa ma'lumotlar (tenantId) */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const tenantId = String(body.tenantId ?? "").trim();
    if (!tenantId) {
      return fail("tenantId talab qilinadi", 400);
    }

    const tenant = await resolveTenantById(tenantId);
    if (!tenant) return fail("Ijarachi topilmadi", 404);

    const data = await getPortalDataForTenant(tenant.id);
    if (!data) return fail("Ma'lumot topilmadi", 404);

    return ok(data);
  } catch {
    return fail("Xatolik yuz berdi", 500);
  }
}
