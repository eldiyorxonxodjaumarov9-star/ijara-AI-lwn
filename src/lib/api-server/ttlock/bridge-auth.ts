import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-server/auth";
import { prisma } from "@/lib/api-server/prisma";
import { findLwnPropertyOrFail } from "@/lib/api-server/lwn-room-lock";
import { fail } from "@/lib/api-server/http";

export const BRIDGE_AUDIENCE = "ijara-ttlock-bluetooth";

export function bridgeTransportError(req: NextRequest) {
  // Behind a reverse proxy, configure it to overwrite X-Forwarded-Proto.
  if (req.nextUrl.protocol !== "https:" && req.headers.get("x-forwarded-proto") !== "https") {
    return fail("Bluetooth bridge requires TLS", 403);
  }
  return null;
}

export async function requireBridgeUser(req: NextRequest) {
  const transportError = bridgeTransportError(req);
  if (transportError) return { error: transportError };
  const auth = await requireUser(req);
  if (auth.error) return auth;
  try {
    const claims = jwt.verify(req.headers.get("authorization")!.slice(7), process.env.JWT_ACCESS_SECRET!, {
      audience: BRIDGE_AUDIENCE, algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    if (claims.purpose !== "bluetooth-bridge" || typeof claims.propertyId !== "string") throw new Error();
    const found = await findLwnPropertyOrFail(claims.propertyId, auth.user);
    if ("error" in found && found.error) return { error: found.error };
    const token = req.headers.get("x-ttlock-bluetooth-session-token")?.trim();
    if (!token) return { error: fail("Bluetooth session required", 401) };
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT s."id" FROM "ttlock_bluetooth_sync_sessions" s
       JOIN "room_lock_settings" r ON r."propertyId" = s."propertyId" AND r."ttlockCachedLockId" = s."ttlockCachedLockId"
       JOIN "ttlock_cached_locks" l ON l."id" = s."ttlockCachedLockId" AND l."isActive" = true
       JOIN "ttlock_connections" c ON c."id" = l."connectionId" AND c."ownerUserId" = s."ownerUserId"
       WHERE s."tokenHash" = $1 AND s."ownerUserId" = $2 AND s."propertyId" = $3
       AND s."expiresAt" > NOW() AND s."status" IN ('CREATED', 'SYNCING')`,
      createHash("sha256").update(token).digest("hex"), auth.user.id, claims.propertyId,
    );
    if (!rows.length) return { error: fail("Bluetooth session expired or out of scope", 409) };
    return { user: auth.user, error: undefined };
  } catch {
    return { error: fail("Authenticated Bluetooth bridge token required", 401) };
  }
}

export function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "no-store, private, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
