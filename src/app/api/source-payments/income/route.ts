import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  getSourcePaymentIncome,
  listRecentSourcePayments,
  requireSourcePaymentWorkspace,
} from "@/lib/api-server/source-payments";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireSourcePaymentWorkspace(req, "GET");
  if (guard.error) return guard.error;
  const workspaceId = guard.ctx.workspace.id;
  const [income, recent] = await Promise.all([
    getSourcePaymentIncome(prisma, workspaceId, guard.sourceType),
    listRecentSourcePayments(prisma, workspaceId, guard.sourceType),
  ]);
  return ok({ ...income, recent });
}
