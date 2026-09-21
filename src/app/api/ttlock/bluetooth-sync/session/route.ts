import { noStore } from "@/lib/api-server/ttlock/bridge-auth";
import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { findLwnPropertyOrFail } from "@/lib/api-server/lwn-room-lock";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import { createBluetoothSyncSession } from "@/lib/api-server/ttlock/bluetooth-sync";

async function handlePost(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const body = (await req.json()) as Record<string, unknown>;
  const propertyId = String(body.propertyId ?? body.roomId ?? "").trim();
  if (!propertyId) return fail("propertyId talab qilinadi", 400);
  const found = await findLwnPropertyOrFail(propertyId, auth.user);
  if ("error" in found && found.error) return found.error;

  try {
    return noStore(ok(await createBluetoothSyncSession({ user: auth.user, propertyId }), 201));
  } catch (err) {
    if (err instanceof TtlockError) return fail(err.message, err.httpStatus, err.code);
    return fail("Bluetooth sync session yaratib bo‘lmadi", 500);
  }
}
export async function POST(req: NextRequest) {
  return noStore(await handlePost(req));
}
