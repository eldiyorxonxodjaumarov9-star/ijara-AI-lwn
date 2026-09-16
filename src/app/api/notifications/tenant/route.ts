import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { getTenantNotifications } from "@/lib/api-server/payment-reminders";
import { requirePortalTenant } from "@/lib/api-server/portal-session";

/** Ijarachi portali: o'z xabarlarini olish (signed session) */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const claimedId = body.tenantId ? String(body.tenantId).trim() : null;
    const portal = requirePortalTenant(req, claimedId);
    if ("error" in portal) return portal.error;

    const notifications = await getTenantNotifications(portal.tenantId);
    return ok(notifications);
  } catch {
    return fail("Xatolik yuz berdi", 500);
  }
}
