import { NextRequest } from "next/server";

import { recordActivity } from "@/lib/api-server/activity-events";
import { fail, ok } from "@/lib/api-server/http";
import {
  addManualDebtPayment,
  manualDebtErrorResponse,
  requireManualDebtWorkspace,
} from "@/lib/api-server/manual-debts";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { parseManualDebtPayment } from "@/lib/manual-debts";
import { tashkentToday } from "@/lib/vehicle-rentals";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireManualDebtWorkspace(req, "POST");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = parseManualDebtPayment(body, tashkentToday());
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");

  try {
    const updated = await prisma.$transaction(
      (tx) => addManualDebtPayment(tx, guard.workspaceId, id, guard.user.id, parsed.data),
      { timeout: 15_000 }
    );
    await recordActivity({
      workspaceId: guard.workspaceId,
      userId: guard.user.id,
      action: "DEBT_PAYMENT",
      entityType: "ManualDebt",
      entityId: id,
    });
    return ok(updated, 201);
  } catch (err) {
    return manualDebtErrorResponse(err) ?? fail("To‘lovni saqlash xatosi", 500);
  }
}
