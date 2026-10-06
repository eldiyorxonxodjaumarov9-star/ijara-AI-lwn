import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { loadWorkspaceUsageAnalytics } from "@/lib/api-server/usage-analytics-server";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";
import { parseUsagePeriod } from "@/lib/usage-analytics";

/**
 * GET /api/dashboard/usage-analytics?period=7d|30d|90d — workspace from session only.
 * Platform usage is all-time (events + real records); `period` scopes only the
 * Human / AI / Automation share and breakdown.
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const period = parseUsagePeriod(req.nextUrl.searchParams.get("period"));
  if (!period) return fail("Davr noto‘g‘ri (7d, 30d yoki 90d)", 400, "INVALID_PERIOD");

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  return ok(await loadWorkspaceUsageAnalytics(wsCtx, period));
}
