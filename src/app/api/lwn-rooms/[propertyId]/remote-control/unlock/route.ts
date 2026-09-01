import { NextRequest } from "next/server";

import { findLwnPropertyOrFail } from "@/lib/api-server/lwn-room-lock";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import { executeRemoteUnlock } from "@/lib/api-server/ttlock/remote-control";

type Ctx = { params: Promise<{ propertyId: string }> };

function readIdempotencyKey(req: NextRequest, body: unknown): string | null {
  const header = req.headers.get("Idempotency-Key")?.trim();
  if (header) return header.slice(0, 128);
  if (body && typeof body === "object" && "idempotencyKey" in body) {
    const v = String((body as { idempotencyKey?: unknown }).idempotencyKey ?? "").trim();
    return v ? v.slice(0, 128) : null;
  }
  return null;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { propertyId } = await ctx.params;
  const found = await findLwnPropertyOrFail(propertyId);
  if ("error" in found && found.error) return found.error;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const idempotencyKey = readIdempotencyKey(req, body);
  if (!idempotencyKey) {
    return fail("Idempotency-Key talab qilinadi", 400);
  }

  try {
    const result = await executeRemoteUnlock({
      user: auth.user,
      propertyId,
      idempotencyKey,
    });
    return ok(result);
  } catch (err) {
    if (err instanceof TtlockError) {
      return fail(err.message, err.httpStatus, err.code);
    }
    return fail("Qulfni ochib bo‘lmadi", 500);
  }
}
