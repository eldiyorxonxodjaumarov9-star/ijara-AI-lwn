import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-server/auth";
import { findLwnPropertyOrFail } from "@/lib/api-server/lwn-room-lock";
import { fail, ok } from "@/lib/api-server/http";
import { assertTtlockOwnerRole } from "@/lib/api-server/ttlock/service";
import { BRIDGE_AUDIENCE, bridgeTransportError, noStore } from "@/lib/api-server/ttlock/bridge-auth";

export async function POST(req: NextRequest) {
  const transportError = bridgeTransportError(req);
  if (transportError) return noStore(transportError);
  const auth = await requireUser(req);
  if (auth.error) return noStore(auth.error);
  try {
    assertTtlockOwnerRole(auth.user);
    const { propertyId } = await req.json();
    if (typeof propertyId !== "string" || !propertyId) return noStore(fail("propertyId required", 400));
    const found = await findLwnPropertyOrFail(propertyId, auth.user);
    if ("error" in found && found.error) return noStore(found.error);
    const bridgeToken = jwt.sign({ sub: auth.user.id, purpose: "bluetooth-bridge", propertyId }, process.env.JWT_ACCESS_SECRET!, {
      audience: BRIDGE_AUDIENCE, expiresIn: "10m", algorithm: "HS256",
    });
    return noStore(ok({ bridgeToken }));
  } catch {
    return noStore(fail("Bluetooth bridge authorization failed", 403));
  }
}
