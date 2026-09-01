import { NextRequest } from "next/server";

import { findLwnPropertyOrFail } from "@/lib/api-server/lwn-room-lock";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import { revokeAccessGrant } from "@/lib/api-server/ttlock/access-sync";

type Ctx = { params: Promise<{ propertyId: string; grantId: string }> };

function failFromErr(err: unknown) {
  if (err instanceof TtlockError) {
    return fail(err.message, err.httpStatus, err.code);
  }
  return fail("Yangilash xatosi", 500);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { propertyId, grantId } = await ctx.params;
  const found = await findLwnPropertyOrFail(propertyId);
  if ("error" in found && found.error) return found.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const statusRaw =
      body.status != null ? String(body.status).toLowerCase() : "";

    if (statusRaw === "cancelled" || statusRaw === "CANCELLED".toLowerCase()) {
      const result = await revokeAccessGrant({
        user: auth.user,
        propertyId,
        grantId,
      });
      return ok(result);
    }

    return fail("Faqat bekor qilish qo‘llab-quvvatlanadi", 400);
  } catch (err) {
    return failFromErr(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { propertyId, grantId } = await ctx.params;
  const found = await findLwnPropertyOrFail(propertyId);
  if ("error" in found && found.error) return found.error;

  const existing = await prisma.roomAccessGrant.findFirst({
    where: { id: grantId, propertyId },
  });
  if (!existing) return fail("Kirish huquqi topilmadi", 404);

  const cred = await prisma.ttlockAccessCredential.findUnique({
    where: { roomAccessGrantId: grantId },
  });
  if (cred?.externalAccessId && cred.syncStatus !== "REVOKED") {
    return fail(
      "Avval TTLock’dagi kirish huquqini bekor qiling",
      409,
      "TTLOCK_LOCK_HAS_ACTIVE_ACCESS"
    );
  }

  try {
    await prisma.roomAccessGrant.delete({ where: { id: grantId } });
    return ok({ message: "O'chirildi" });
  } catch {
    return fail("O'chirish xatosi", 500);
  }
}
