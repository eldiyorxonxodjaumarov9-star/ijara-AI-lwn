/**
 * Signed portal (tenant) session — never trust bare tenantId from clients.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api-server/http";

export const PORTAL_TOKEN_HEADER = "authorization";
export const PORTAL_COOKIE = "arenda_portal_token";

export interface PortalJwtPayload {
  typ: "portal";
  sub: string; // tenantId
  iat?: number;
  exp?: number;
}

function portalSecret(): string {
  const value =
    process.env.JWT_PORTAL_SECRET?.trim() ||
    process.env.JWT_ACCESS_SECRET?.trim();
  if (!value) throw new Error("JWT portal/access secret sozlanmagan");
  return value;
}

export function signPortalToken(tenantId: string): string {
  const payload: PortalJwtPayload = { typ: "portal", sub: tenantId };
  const raw = process.env.JWT_PORTAL_EXPIRES?.trim();
  const expiresIn =
    raw && (/^\d+$/.test(raw) || /^\d+[smhdw]$/i.test(raw)) ? raw : "7d";
  return jwt.sign(payload, portalSecret(), {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyPortalToken(token: string): PortalJwtPayload | null {
  try {
    const payload = jwt.verify(token, portalSecret()) as PortalJwtPayload;
    if (payload.typ !== "portal" || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readBearerToken(req: NextRequest): string | null {
  const header = req.headers.get(PORTAL_TOKEN_HEADER);
  if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;
  return null;
}

/**
 * Require portal session. Returns tenantId from signed token.
 * If bodyTenantId is provided, it must match the token subject.
 */
export function requirePortalTenant(
  req: NextRequest,
  bodyTenantId?: string | null
): { tenantId: string } | { error: Response } {
  const token = readBearerToken(req);
  if (!token) {
    return { error: fail("Autentifikatsiya talab qilinadi", 401) };
  }
  const payload = verifyPortalToken(token);
  if (!payload) {
    return { error: fail("Portal sessiyasi yaroqsiz", 401) };
  }
  if (bodyTenantId && bodyTenantId.trim() && bodyTenantId.trim() !== payload.sub) {
    return { error: fail("Ruxsat yo‘q", 403) };
  }
  return { tenantId: payload.sub };
}

/** Password-reset token helpers (hashed at rest). */
export function createPasswordResetRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function timingSafeHashEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
