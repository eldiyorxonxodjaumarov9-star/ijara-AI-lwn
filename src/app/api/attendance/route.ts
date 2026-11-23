import { NextRequest } from "next/server";

import {
  getAttendanceDashboardStats,
  listAttendanceCheckIns,
  listUnverifiedAttendanceProfiles,
} from "@/lib/api-server/attendance-bot/dashboard";
import { tashkentWorkDate } from "@/lib/api-server/attendance-bot/service";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  resolveUserWorkspaceContext,
} from "@/lib/api-server/workspace";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "attendance", "GET");
  if (auth.error) return auth.error;

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED");
  }
  const workspaceId = wsCtx.workspace.id;
  const url = new URL(req.url);

  const view = url.searchParams.get("view") || "list";
  const workDate = url.searchParams.get("workDate") || tashkentWorkDate();

  if (view === "stats") {
    const stats = await getAttendanceDashboardStats(workspaceId, workDate);
    return ok({ stats });
  }

  if (view === "unverified") {
    const profiles = await listUnverifiedAttendanceProfiles(workspaceId);
    return ok({ profiles });
  }

  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "20");
  const result = await listAttendanceCheckIns({
    workspaceId,
    workDate: url.searchParams.get("workDate"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    employeeId: url.searchParams.get("employeeId"),
    search: url.searchParams.get("search"),
    presence: (url.searchParams.get("presence") as "present" | "absent" | null) || null,
    verification:
      (url.searchParams.get("verification") as
        | "VERIFIED"
        | "UNVERIFIED"
        | "REJECTED"
        | null) || null,
    taskFilter:
      (url.searchParams.get("taskFilter") as "done" | "open" | null) || null,
    page,
    limit,
  });

  const stats = await getAttendanceDashboardStats(workspaceId, workDate);
  return ok({ ...result, stats });
}
