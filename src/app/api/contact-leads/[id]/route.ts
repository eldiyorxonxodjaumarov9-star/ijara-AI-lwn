import { NextRequest } from "next/server";

import { requireAnyStaffUser } from "@/lib/api-server/rbac";
import {
  interestToApi,
  mapContactLead,
} from "@/lib/api-server/client-database";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  isRecordInWorkspace,
  resolveUserWorkspaceContext,
} from "@/lib/api-server/workspace";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireAnyStaffUser(req);
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  delete body.workspaceId;

  try {
    const existing = await prisma.contactLead.findUnique({ where: { id } });
    if (!isRecordInWorkspace(existing, wsCtx.workspace.id)) {
      return fail("Topilmadi", 404);
    }

    const updated = await prisma.contactLead.update({
      where: { id },
      data: {
        ...(body.fullName != null
          ? { fullName: String(body.fullName).trim() }
          : {}),
        ...(body.phone != null ? { phone: String(body.phone).trim() } : {}),
        ...(body.interest != null
          ? { interest: interestToApi(String(body.interest)) }
          : {}),
        ...(body.notes !== undefined
          ? { notes: body.notes ? String(body.notes).trim() : null }
          : {}),
        ...(body.source !== undefined
          ? { source: body.source ? String(body.source).trim() : null }
          : {}),
      },
    });
    return ok(mapContactLead(updated));
  } catch {
    return fail("Yangilash xatosi", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireAnyStaffUser(_req);
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { id } = await ctx.params;
  try {
    const existing = await prisma.contactLead.findUnique({ where: { id } });
    if (!isRecordInWorkspace(existing, wsCtx.workspace.id)) {
      return fail("Topilmadi", 404);
    }
    await prisma.contactLead.delete({ where: { id } });
    return ok({ message: "O'chirildi" });
  } catch {
    return fail("O'chirish xatosi", 500);
  }
}
