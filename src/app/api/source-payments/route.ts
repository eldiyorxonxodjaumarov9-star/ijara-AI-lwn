import { NextRequest } from "next/server";

import { recordActivity } from "@/lib/api-server/activity-events";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  createSourcePayment,
  listSourcePayments,
  requireSourcePaymentWorkspace,
  sourcePaymentErrorResponse,
} from "@/lib/api-server/source-payments";
import { parseSourcePaymentInput } from "@/lib/source-payments";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireSourcePaymentWorkspace(req, "GET");
  if (guard.error) return guard.error;
  return ok(await listSourcePayments(prisma, guard.ctx.workspace.id, guard.sourceType));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireSourcePaymentWorkspace(req, "POST");
  if (guard.error) return guard.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed = parseSourcePaymentInput(body);
  if (!parsed.ok) return fail(parsed.error, 400, "VALIDATION_ERROR");
  const workspaceId = guard.ctx.workspace.id;

  try {
    const created = await prisma.$transaction(
      (tx) => createSourcePayment(tx, workspaceId, guard.sourceType, parsed.value),
      { timeout: 15_000 }
    );
    await recordActivity({
      workspaceId,
      userId: guard.user.id,
      action: "SOURCE_PAYMENT_CREATE",
      entityType: guard.sourceType === "BOOKING" ? "Booking" : "VehicleRental",
      entityId: parsed.value.sourceId,
    });
    return ok(created, 201);
  } catch (err) {
    return sourcePaymentErrorResponse(err) ?? fail("Saqlash xatosi", 500);
  }
}
