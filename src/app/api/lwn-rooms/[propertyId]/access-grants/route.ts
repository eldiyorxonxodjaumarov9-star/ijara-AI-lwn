import { NextRequest } from "next/server";

import { findLwnPropertyOrFail } from "@/lib/api-server/lwn-room-lock";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import {
  createRoomAccessGrantPlan,
  listRoomAccessGrantsPublic,
} from "@/lib/api-server/ttlock/access-sync";

type Ctx = { params: Promise<{ propertyId: string }> };

function failFromErr(err: unknown) {
  if (err instanceof TtlockError) {
    return fail(err.message, err.httpStatus, err.code);
  }
  return fail("Kirish huquqini saqlab bo'lmadi", 500);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { propertyId } = await ctx.params;
  const found = await findLwnPropertyOrFail(propertyId);
  if ("error" in found && found.error) return found.error;

  try {
    const rows = await listRoomAccessGrantsPublic(propertyId);
    return ok(rows);
  } catch (err) {
    return failFromErr(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { propertyId } = await ctx.params;
  const found = await findLwnPropertyOrFail(propertyId);
  if ("error" in found && found.error) return found.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const tenantId = String(body.tenantId ?? "").trim();
    if (!tenantId) return fail("Arendator tanlanmagan", 400);

    const result = await createRoomAccessGrantPlan({
      user: auth.user,
      propertyId,
      tenantId,
      permissionType: String(body.permissionType ?? "PIN"),
      validFromRaw: body.validFrom,
      validToRaw: body.validTo,
      notes: body.notes == null ? null : String(body.notes),
      autoSync: body.autoSync !== false,
    });

    return ok(result, 201);
  } catch (err) {
    return failFromErr(err);
  }
}
