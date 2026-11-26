import { NextRequest } from "next/server";
import type { RobotRentApplicationStatus } from "@prisma/client";

import {
  adminUpdateRobotRentApplication,
  getRobotRentApplicationById,
} from "@/lib/api-server/robotrent/applications";
import { serializeAdminApplication } from "@/lib/api-server/robotrent/serializers";
import { fail, ok } from "@/lib/api-server/http";
import { requireResourceAccess } from "@/lib/api-server/rbac";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES = new Set<RobotRentApplicationStatus>([
  "RECEIVED",
  "SITE_INSPECTION",
  "TRIAL_OFFER",
  "MONTHLY_RENTAL",
  "REJECTED",
]);

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "robotrent", "GET");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const app = await getRobotRentApplicationById(id);
  if (!app) return fail("Ariza topilmadi", 404);
  return ok(serializeAdminApplication(app));
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireResourceAccess(req, "robotrent", "PATCH");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("Noto‘g‘ri so‘rov", 400);
  }

  const status = String(body.status ?? "") as RobotRentApplicationStatus;
  if (!STATUSES.has(status)) return fail("Status noto‘g‘ri", 400);

  try {
    const updated = await adminUpdateRobotRentApplication({
      applicationId: id,
      status,
      note: typeof body.note === "string" ? body.note : undefined,
      actorUserId: auth.user.id,
      trial:
        body.trial && typeof body.trial === "object"
          ? (body.trial as AdminStatusUpdateTrial)
          : undefined,
      rentalOffer:
        body.rentalOffer && typeof body.rentalOffer === "object"
          ? (body.rentalOffer as AdminStatusUpdateRental)
          : undefined,
    });
    return ok(serializeAdminApplication(updated!));
  } catch (err) {
    const statusCode =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 400;
    return fail(err instanceof Error ? err.message : "Xatolik", statusCode);
  }
}

type AdminStatusUpdateTrial = {
  robotModelId?: string | null;
  trialZone?: string | null;
  startDate?: string | null;
  trialDays?: number | null;
  dailyRate?: number | null;
  dailyCleanedAreaSqm?: number | null;
  costNotes?: string | null;
  reportSummary?: string | null;
};

type AdminStatusUpdateRental = {
  monthlyAmount?: number | null;
  terms?: string | null;
  validUntil?: string | null;
};