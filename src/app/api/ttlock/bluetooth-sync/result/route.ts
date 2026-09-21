import { NextRequest } from "next/server";

import { requireBridgeUser, noStore } from "@/lib/api-server/ttlock/bridge-auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import { recordBluetoothSyncResult } from "@/lib/api-server/ttlock/bluetooth-sync";

async function handlePost(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireBridgeUser(req);
  if (auth.error) return noStore(auth.error);
  const sessionToken = req.headers.get("x-ttlock-bluetooth-session-token")?.trim();
  if (!sessionToken) return fail("Bluetooth sync session token talab qilinadi", 401);
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const entryId = String(body.entryId ?? "").trim();
    if (!entryId) return fail("Bluetooth entryId talab qilinadi", 400);
    const result = await recordBluetoothSyncResult({
      user: auth.user,
      sessionToken,
      entryId,
      success: body.success === true,
      sdkCallbackReceived: body.sdkCallbackReceived === true,
      errorCode: body.errorCode == null ? undefined : String(body.errorCode),
      errorMessage: body.errorMessage == null ? undefined : String(body.errorMessage),
    });
    return noStore(ok(result));
  } catch (err) {
    if (err instanceof TtlockError) return noStore(fail(err.message, err.httpStatus, err.code));
    return fail("Bluetooth sync natijasini saqlab bo‘lmadi", 500);
  }
}
export async function POST(req: NextRequest) {
  return noStore(await handlePost(req));
}
