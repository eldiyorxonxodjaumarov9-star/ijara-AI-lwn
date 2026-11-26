import { NextRequest } from "next/server";
import type { RobotRentApplicationStatus, RobotRentApplicationType } from "@prisma/client";

import { listRobotRentApplications } from "@/lib/api-server/robotrent/applications";
import { serializeAdminApplication } from "@/lib/api-server/robotrent/serializers";
import { fail, ok } from "@/lib/api-server/http";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

const TYPES = new Set<RobotRentApplicationType>([
  "CUSTOMER",
  "DISTRIBUTOR",
  "MANUFACTURER",
]);
const STATUSES = new Set<RobotRentApplicationStatus>([
  "RECEIVED",
  "SITE_INSPECTION",
  "TRIAL_OFFER",
  "MONTHLY_RENTAL",
  "REJECTED",
]);

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "robotrent", "GET");
  if (auth.error) return auth.error;

  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const typeRaw = req.nextUrl.searchParams.get("type");
  const statusRaw = req.nextUrl.searchParams.get("status");
  const type = typeRaw && TYPES.has(typeRaw as RobotRentApplicationType)
    ? (typeRaw as RobotRentApplicationType)
    : undefined;
  const status =
    statusRaw && STATUSES.has(statusRaw as RobotRentApplicationStatus)
      ? (statusRaw as RobotRentApplicationStatus)
      : undefined;

  const rows = await listRobotRentApplications({ q, type, status });
  return ok(rows.map(serializeAdminApplication));
}