import { NextRequest } from "next/server";

import {
  ensureWorkspaceQrCodes,
  getQrDashboardStats,
  getQrPublicOriginInfo,
  listQrCodes,
  mapQrForAdmin,
} from "@/lib/api-server/qr-feedback/service";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "qr-codes", "GET");
  if (auth.error) return auth.error;
  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const workspaceId = wsCtx.workspace.id;
  const codes = await listQrCodes(workspaceId);
  const stats = await getQrDashboardStats(workspaceId);
  const publicOrigin = getQrPublicOriginInfo();
  return ok({
    stats,
    codes: codes.map(mapQrForAdmin),
    publicOrigin,
  });
}

/** Ensure 32 QR slots exist without rotating existing tokens. */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "qr-codes", "POST");
  if (auth.error) return auth.error;
  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "ensure") {
    return fail("action=ensure majburiy", 400);
  }
  const codes = await ensureWorkspaceQrCodes(wsCtx.workspace.id);
  const stats = await getQrDashboardStats(wsCtx.workspace.id);
  const publicOrigin = getQrPublicOriginInfo();
  return ok({
    stats,
    codes: codes.map(mapQrForAdmin),
    createdOrExisting: codes.length,
    publicOrigin,
  });
}
