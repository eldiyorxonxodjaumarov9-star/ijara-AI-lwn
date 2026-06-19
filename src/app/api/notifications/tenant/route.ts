import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { getTenantNotifications } from "@/lib/api-server/payment-reminders";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

/** Ijarachi portali: o'z xabarlarini olish (ism + telefon) */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    const phone = normalizePhone(String(body.phone ?? ""));
    if (!fullName || !phone) {
      return fail("Ism va telefon talab qilinadi", 400);
    }

    const tenants = await prisma.tenant.findMany();
    const tenant = tenants.find(
      (t) =>
        t.fullName.trim().toLowerCase() === fullName.toLowerCase() &&
        normalizePhone(t.phone) === phone
    );

    if (!tenant) return fail("Ijarachi topilmadi", 404);

    const notifications = await getTenantNotifications(tenant.id);
    return ok(notifications);
  } catch {
    return fail("Xatolik yuz berdi", 500);
  }
}
