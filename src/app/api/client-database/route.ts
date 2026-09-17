import { NextRequest } from "next/server";

import { requireAnyStaffUser } from "@/lib/api-server/rbac";
import { buildClientDatabaseRows } from "@/lib/api-server/client-database";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireAnyStaffUser(req);
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  try {
    const rows = await buildClientDatabaseRows(wsCtx.workspace.id);
    return ok({ items: rows, total: rows.length });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Klient bazasini yuklash xatosi";
    return fail(message, 500);
  }
}
