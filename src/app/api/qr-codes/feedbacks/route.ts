import { NextRequest } from "next/server";

import { listFeedbacks } from "@/lib/api-server/qr-feedback/service";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";
import type { CleanlinessFeedbackStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "qr-codes", "GET");
  if (auth.error) return auth.error;
  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const url = new URL(req.url);
  const result = await listFeedbacks({
    workspaceId: wsCtx.workspace.id,
    qrCodeId: url.searchParams.get("qrCodeId"),
    status: (url.searchParams.get("status") as CleanlinessFeedbackStatus) || null,
    ratingValue: url.searchParams.get("rating")
      ? Number(url.searchParams.get("rating"))
      : null,
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    page: Number(url.searchParams.get("page") || "1"),
    limit: Number(url.searchParams.get("limit") || "20"),
  });
  return ok(result);
}
