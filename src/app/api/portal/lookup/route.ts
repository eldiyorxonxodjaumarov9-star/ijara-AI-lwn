import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { resolveTenantByCredentials } from "@/lib/api-server/portal-data";

/** Ijarachi kirish: login + parol tekshiruvi (auth talab qilinmaydi) */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const login = String(body.login ?? "").trim();
    const password = String(body.password ?? "");
    if (!login || !password) {
      return fail("Login va parol talab qilinadi", 400);
    }

    const tenant = await resolveTenantByCredentials(login, password);
    if (!tenant) return fail("Login yoki parol noto'g'ri", 404);

    return ok(tenant);
  } catch {
    return fail("Xatolik yuz berdi", 500);
  }
}
