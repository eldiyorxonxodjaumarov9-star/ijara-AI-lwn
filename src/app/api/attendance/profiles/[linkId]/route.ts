import { NextRequest } from "next/server";

import {
  mergeAttendanceProfileAdmin,
  rejectAttendanceProfile,
  verifyAttendanceProfileAsEmployee,
} from "@/lib/api-server/attendance-bot/dashboard";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

type Ctx = { params: Promise<{ linkId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "attendance", "POST");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }

  const { linkId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "verify" | "merge" | "reject";
    fullName?: string;
    targetEmployeeId?: string;
    reason?: string;
  };

  try {
    if (body.action === "verify") {
      const link = await verifyAttendanceProfileAsEmployee({
        workspaceId: wsCtx.workspace.id,
        linkId,
        actorUserId: auth.user.id,
        fullName: body.fullName,
      });
      return ok({ link });
    }
    if (body.action === "merge") {
      if (!body.targetEmployeeId) {
        return fail("targetEmployeeId majburiy", 400);
      }
      const link = await mergeAttendanceProfileAdmin({
        workspaceId: wsCtx.workspace.id,
        linkId,
        targetEmployeeId: body.targetEmployeeId,
        actorUserId: auth.user.id,
      });
      return ok({ link });
    }
    if (body.action === "reject") {
      const link = await rejectAttendanceProfile({
        workspaceId: wsCtx.workspace.id,
        linkId,
        actorUserId: auth.user.id,
        reason: body.reason,
      });
      return ok({ link });
    }
    return fail("Noma’lum action", 400);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status) || 400
        : 400;
    return fail(err instanceof Error ? err.message : "Xatolik", status);
  }
}
