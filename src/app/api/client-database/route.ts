import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { buildClientDatabaseRows } from "@/lib/api-server/client-database";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const rows = await buildClientDatabaseRows();
    return ok({ items: rows, total: rows.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Klient bazasini yuklash xatosi";
    return fail(message, 500);
  }
}
