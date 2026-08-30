import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { loadRecurringPlan } from "@/lib/api-server/recurring-expenses";

/** Tanlangan oy uchun doimiy xarajatlar reja/hisoboti */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const year = Number(req.nextUrl.searchParams.get("year"));
  const month = Number(req.nextUrl.searchParams.get("month"));
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return fail("year noto'g'ri", 400);
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return fail("month noto'g'ri (1–12)", 400);
  }

  try {
    const plan = await loadRecurringPlan(year, month);
    return ok(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reja xatosi";
    return fail(message, 500);
  }
}
