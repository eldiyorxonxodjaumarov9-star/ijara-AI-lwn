import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import {
  getManualDebt,
  manualDebtErrorResponse,
  requireManualDebtWorkspace,
  updateManualDebt,
} from "@/lib/api-server/manual-debts";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { parseManualDebtUpdate } from "@/lib/manual-debts";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireManualDebtWorkspace(req, "GET");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  try {
    return ok(await getManualDebt(prisma, guard.workspaceId, id));
  } catch (err) {
    return manualDebtErrorResponse(err) ?? fail("Yuklash xatosi", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireManualDebtWorkspace(req, "PATCH");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = parseManualDebtUpdate(body);
  if (parsed.error !== undefined) return fail(parsed.error, 400, "VALIDATION_ERROR");

  try {
    const updated = await prisma.$transaction(
      (tx) => updateManualDebt(tx, guard.workspaceId, id, parsed.data),
      { timeout: 15_000 }
    );
    return ok(updated);
  } catch (err) {
    return manualDebtErrorResponse(err) ?? fail("Yangilash xatosi", 500);
  }
}
