import { NextRequest } from "next/server";

import { recordActivity } from "@/lib/api-server/activity-events";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  checkoutTenant,
  parseCheckoutDebtDecision,
  TenantCheckoutError,
} from "@/lib/api-server/tenant-checkout";
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

  const body = (await req.json().catch(() => null)) as { debtDecision?: unknown } | null;
  const debtDecision = parseCheckoutDebtDecision(body?.debtDecision);
  if (!debtDecision) {
    return fail("Qarzdorlik bo'yicha qaror tanlanmagan", 400, "DEBT_DECISION_REQUIRED");
  }

  const { id } = await ctx.params;

  try {
    const result = await checkoutTenant(id, wsCtx.workspace.id, {
      debtDecision,
      actorUserId: auth.user.id,
    });
    await recordActivity([
      {
        workspaceId: wsCtx.workspace.id,
        userId: auth.user.id,
        action: "TENANT_CHECKOUT",
        entityType: "Tenant",
        entityId: id,
      },
      ...result.writeOffs.map((writeOff) => ({
        workspaceId: wsCtx.workspace.id,
        userId: auth.user.id,
        action: "DEBT_WRITE_OFF" as const,
        entityType: "Contract",
        entityId: writeOff.contractId,
      })),
    ]);
    return ok(result);
  } catch (err) {
    if (err instanceof TenantCheckoutError) {
      return fail(err.message, err.status);
    }
    console.error("[tenant-checkout]", err);
    return fail("Chiqish jarayoni xatosi", 500);
  }
}
