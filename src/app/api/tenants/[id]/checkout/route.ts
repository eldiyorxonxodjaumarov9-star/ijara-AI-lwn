import { NextRequest } from "next/server";

import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { checkoutTenant, TenantCheckoutError } from "@/lib/api-server/tenant-checkout";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "tenants", "POST");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;

  try {
    const result = await checkoutTenant(id, wsCtx.workspace.id);
    return ok(result);
  } catch (err) {
    if (err instanceof TenantCheckoutError) {
      return fail(err.message, err.status);
    }
    console.error("[tenant-checkout]", err);
    return fail("Chiqish jarayoni xatosi", 500);
  }
}
