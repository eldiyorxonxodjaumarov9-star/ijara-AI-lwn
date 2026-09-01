import { NextRequest } from "next/server";

import { findLwnPropertyOrFail } from "@/lib/api-server/lwn-room-lock";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import { syncGrantToTtlock } from "@/lib/api-server/ttlock/access-sync";

type Ctx = { params: Promise<{ propertyId: string; grantId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { propertyId, grantId } = await ctx.params;
  const found = await findLwnPropertyOrFail(propertyId);
  if ("error" in found && found.error) return found.error;

  try {
    const result = await syncGrantToTtlock({
      user: auth.user,
      propertyId,
      grantId,
    });
    return ok(result);
  } catch (err) {
    if (err instanceof TtlockError) {
      return fail(err.message, err.httpStatus, err.code);
    }
    return fail("TTLock’ga yuborib bo‘lmadi", 500);
  }
}
