import { NextRequest } from "next/server";

import { requireBridgeUser, noStore } from "@/lib/api-server/ttlock/bridge-auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import { deliverBluetoothCredential } from "@/lib/api-server/ttlock/bluetooth-sync";

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
    const response = ok(
      await deliverBluetoothCredential({ user: auth.user, sessionToken, entryId })
    );
    response.headers.set("Cache-Control", "no-store, no-cache, max-age=0");
    response.headers.set("Pragma", "no-cache");
    return response;
  } catch (err) {
    if (err instanceof TtlockError) return noStore(fail(err.message, err.httpStatus, err.code));
    return fail("Bluetooth credential berib bo‘lmadi", 500);
  }
}
export async function POST(req: NextRequest) {
  return noStore(await handlePost(req));
}
