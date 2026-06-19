import { NextRequest } from "next/server";

import { syncPaymentsFromContracts } from "@/lib/api-server/payment-sync";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

export async function PUT(_req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(_req);
  if (auth.error) return auth.error;

  try {
    const synced = await syncPaymentsFromContracts();
    return ok({ synced: synced.length, data: synced });
  } catch {
    return fail("Sinxronlash xatosi", 500);
  }
}
