import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  getPortalDataForTenant,
  normalizePhone,
  resolveTenantByCredentials,
} from "@/lib/api-server/portal-data";

/** Ijarachi portali: shartnoma, to'lovlar va boshqa ma'lumotlar (ism + telefon) */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    const phone = normalizePhone(String(body.phone ?? ""));
    if (!fullName || !phone) {
      return fail("Ism va telefon talab qilinadi", 400);
    }

    const tenant = await resolveTenantByCredentials(fullName, phone);
    if (!tenant) return fail("Ijarachi topilmadi", 404);

    const data = await getPortalDataForTenant(tenant.id);
    if (!data) return fail("Ma'lumot topilmadi", 404);

    return ok(data);
  } catch {
    return fail("Xatolik yuz berdi", 500);
  }
}
