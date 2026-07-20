import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { checkoutTenant } from "@/lib/api-server/tenant-checkout";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  try {
    const archive = await checkoutTenant(id);
    return ok(archive);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Chiqish jarayoni xatosi";
    return fail(message, 400);
  }
}
