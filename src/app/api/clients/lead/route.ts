import { NextRequest } from "next/server";

import { upsertClientLead } from "@/lib/api-server/clients";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

/** Portal kirishida CRM lead yozuvi (autentifikatsiyasiz) */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    if (!fullName || !phone) {
      return fail("Ism va telefon talab qilinadi", 400);
    }

    const client = await upsertClientLead({
      fullName,
      phone,
      tenantId: body.tenantId ? String(body.tenantId) : undefined,
    });
    return ok(client, 201);
  } catch {
    return fail("Saqlash xatosi", 500);
  }
}
