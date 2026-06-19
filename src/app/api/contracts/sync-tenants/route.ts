import { NextRequest } from "next/server";

import { syncContractsFromTenants } from "@/lib/api-server/contract-sync";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

export async function PUT(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const synced = await syncContractsFromTenants();
    return ok({ synced: synced.length, data: synced });
  } catch {
    return fail("Sinxronlash xatosi", 500);
  }
}
