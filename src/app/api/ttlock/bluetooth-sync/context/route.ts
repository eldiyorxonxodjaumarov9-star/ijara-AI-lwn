import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-server/http";
import { requireBridgeUser, noStore } from "@/lib/api-server/ttlock/bridge-auth";
import { deliverBluetoothLockContext } from "@/lib/api-server/ttlock/bluetooth-sync";
import { TtlockError } from "@/lib/api-server/ttlock/errors";

export async function POST(req: NextRequest) {
  const auth = await requireBridgeUser(req);
  if (auth.error) return noStore(auth.error);
  try {
    return noStore(ok(await deliverBluetoothLockContext({
      user: auth.user, sessionToken: req.headers.get("x-ttlock-bluetooth-session-token")!.trim(),
    })));
  } catch (err) {
    return noStore(err instanceof TtlockError ? fail(err.message, err.httpStatus, err.code) : fail("Lock context unavailable", 502));
  }
}
