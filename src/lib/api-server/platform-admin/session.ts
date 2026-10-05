import { createHmac } from "node:crypto";
import jwt from "jsonwebtoken";

export const PLATFORM_ADMIN_COOKIE = "ijara_platform_admin_session";
export const PLATFORM_ADMIN_SESSION_TYPE = "PLATFORM_ADMIN";
export const PLATFORM_ADMIN_SESSION_TTL_SEC = 8 * 60 * 60;

const AUDIENCE = "ijara-platform-admin";
const ISSUER = "ijara-ai";

export interface PlatformAdminSessionPayload {
  platformAdminId: string;
  type: typeof PLATFORM_ADMIN_SESSION_TYPE;
}

/**
 * Dedicated key so workspace access tokens and admin sessions can never verify
 * against each other, even when only JWT_ACCESS_SECRET is configured.
 */
function sessionKey(): string {
  const dedicated = process.env.PLATFORM_ADMIN_SESSION_SECRET?.trim();
  if (dedicated) return dedicated;
  const base = process.env.JWT_ACCESS_SECRET;
  if (!base) throw new Error("Platform admin session secret sozlanmagan");
  return createHmac("sha256", base).update("ijara-platform-admin-session:v1").digest("hex");
}

export function signPlatformAdminSession(platformAdminId: string): string {
  const payload: PlatformAdminSessionPayload = {
    platformAdminId,
    type: PLATFORM_ADMIN_SESSION_TYPE,
  };
  return jwt.sign(payload, sessionKey(), {
    algorithm: "HS256",
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: PLATFORM_ADMIN_SESSION_TTL_SEC,
  });
}

export function verifyPlatformAdminSession(
  token: string | undefined | null
): PlatformAdminSessionPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, sessionKey(), {
      algorithms: ["HS256"],
      audience: AUDIENCE,
      issuer: ISSUER,
    });
    if (typeof decoded !== "object" || decoded === null) return null;
    const { platformAdminId, type } = decoded as Partial<PlatformAdminSessionPayload>;
    if (type !== PLATFORM_ADMIN_SESSION_TYPE || typeof platformAdminId !== "string" || !platformAdminId) {
      return null;
    }
    return { platformAdminId, type };
  } catch {
    return null;
  }
}

export function platformAdminCookieOptions(maxAge = PLATFORM_ADMIN_SESSION_TTL_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
