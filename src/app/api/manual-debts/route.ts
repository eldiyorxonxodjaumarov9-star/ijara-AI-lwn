import { NextRequest } from "next/server";

import { recordActivity } from "@/lib/api-server/activity-events";
import { fail, ok } from "@/lib/api-server/http";
import {
  createManualDebt,
  listManualDebts,
  manualDebtErrorResponse,
  requireManualDebtWorkspace,
} from "@/lib/api-server/manual-debts";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { parseManualDebtCreate } from "@/lib/manual-debts";

/** ?active=1 — faqat OPEN/PARTIAL va qoldiq > 0. */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireManualDebtWorkspace(req, "GET");
  if (guard.error) return guard.error;
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";
  return ok(await listManualDebts(prisma, guard.workspaceId, { activeOnly }));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireManualDebtWorkspace(req, "POST");
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = parseManualDebtCreate(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");

  try {
    const created = await createManualDebt(prisma, guard.workspaceId, guard.user.id, parsed.data);
    await recordActivity({
      workspaceId: guard.workspaceId,
      userId: guard.user.id,
      action: "MANUAL_DEBT_CREATE",
      entityType: "ManualDebt",
      entityId: created.id,
    });
    return ok(created, 201);
  } catch (err) {
    return manualDebtErrorResponse(err) ?? fail("Saqlash xatosi", 500);
  }
}
