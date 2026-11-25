import { NextRequest } from "next/server";

import { updateFeedbackStatus } from "@/lib/api-server/qr-feedback/service";
import { notifyCleanlinessFeedbackTelegram } from "@/lib/api-server/qr-feedback/telegram-notify";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";
import type { CleanlinessFeedbackStatus } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "qr-codes", "PATCH");
  if (auth.error) return auth.error;
  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: CleanlinessFeedbackStatus;
    comment?: string;
    retryTelegram?: boolean;
  };

  const owned = await prisma.cleanlinessFeedback.findFirst({
    where: { id, workspaceId: wsCtx.workspace.id },
    select: { id: true },
  });
  if (!owned) return fail("Fikr topilmadi", 404);

  if (body.retryTelegram) {
    const result = await notifyCleanlinessFeedbackTelegram(id, {
      forceRetry: true,
    });
    return ok({ telegram: result });
  }

  if (!body.status) return fail("status yoki retryTelegram majburiy", 400);
  try {
    const row = await updateFeedbackStatus({
      workspaceId: wsCtx.workspace.id,
      feedbackId: id,
      status: body.status,
      actorUserId: auth.user.id,
      comment: body.comment,
    });
    return ok(row);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status) || 400
        : 400;
    return fail(err instanceof Error ? err.message : "Xatolik", status);
  }
}
