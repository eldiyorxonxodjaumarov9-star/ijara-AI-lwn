import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import {
  cancelManualDebt,
  manualDebtErrorResponse,
  requireManualDebtWorkspace,
} from "@/lib/api-server/manual-debts";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireManualDebtWorkspace(req, "POST");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

  try {
    const cancelled = await prisma.$transaction(
      (tx) => cancelManualDebt(tx, guard.workspaceId, id, guard.user.id, reason),
      { timeout: 15_000 }
    );
    return ok(cancelled);
  } catch (err) {
    return manualDebtErrorResponse(err) ?? fail("Bekor qilish xatosi", 500);
  }
}
