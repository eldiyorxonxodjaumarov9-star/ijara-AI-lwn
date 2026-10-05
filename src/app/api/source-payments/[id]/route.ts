import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  deleteSourcePayment,
  requireSourcePaymentWorkspace,
  sourcePaymentErrorResponse,
  updateSourcePayment,
} from "@/lib/api-server/source-payments";
import { parseSourcePaymentUpdate } from "@/lib/source-payments";

type Ctx = { params: Promise<{ id: string }> };

async function update(req: NextRequest, ctx: Ctx, method: "PATCH" | "PUT") {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireSourcePaymentWorkspace(req, method);
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Noto'g'ri so'rov", 400);
  }
  const parsed = parseSourcePaymentUpdate(body);
  if (!parsed.ok) return fail(parsed.error, 400, "VALIDATION_ERROR");
  const workspaceId = guard.ctx.workspace.id;

  try {
    const updated = await prisma.$transaction(
      (tx) => updateSourcePayment(tx, workspaceId, guard.sourceType, id, parsed.value),
      { timeout: 15_000 }
    );
    return ok(updated);
  } catch (err) {
    return sourcePaymentErrorResponse(err) ?? fail("Yangilash xatosi", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return update(req, ctx, "PATCH");
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return update(req, ctx, "PUT");
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const guard = await requireSourcePaymentWorkspace(req, "DELETE");
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const workspaceId = guard.ctx.workspace.id;
  try {
    const deleted = await prisma.$transaction(
      (tx) => deleteSourcePayment(tx, workspaceId, guard.sourceType, id),
      { timeout: 15_000 }
    );
    return ok(deleted);
  } catch (err) {
    return sourcePaymentErrorResponse(err) ?? fail("O‘chirish xatosi", 500);
  }
}
