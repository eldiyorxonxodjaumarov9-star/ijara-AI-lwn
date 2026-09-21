import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Role, User } from "@prisma/client";
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api-server/http";
import { prisma } from "@/lib/api-server/prisma";

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  /** Active workspace; omitted in legacy tokens — resolved server-side on each request. */
  workspaceId?: string;
}

function secret(key: "access" | "refresh") {
  const value =
    key === "access"
      ? process.env.JWT_ACCESS_SECRET
      : process.env.JWT_REFRESH_SECRET;
  if (!value) throw new Error("JWT secret sozlanmagan");
  return value;
}

export function sanitizeUser(user: User) {
  const {
    password: _p,
    refreshTokenHash: _r,
    resetToken: _t,
    resetTokenExp: _e,
    ...rest
  } = user;
  void _p;
  void _r;
  void _t;
  void _e;
  return rest;
}

function parseExpiresIn(
  raw: string | undefined,
  fallback: string
): jwt.SignOptions["expiresIn"] {
  const value = raw?.trim();
  if (!value) return fallback as jwt.SignOptions["expiresIn"];
  // Accept numeric seconds or timespan like 15m / 7d / 1h
  if (/^\d+$/.test(value) || /^\d+[smhdw]$/i.test(value)) {
    return value as jwt.SignOptions["expiresIn"];
  }
  return fallback as jwt.SignOptions["expiresIn"];
}

export async function signTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, secret("access"), {
    expiresIn: parseExpiresIn(process.env.JWT_ACCESS_EXPIRES, "15m"),
  });
  const refreshToken = jwt.sign(payload, secret("refresh"), {
    expiresIn: parseExpiresIn(process.env.JWT_REFRESH_EXPIRES, "7d"),
  });
  return { accessToken, refreshToken };
}

export async function persistRefreshToken(
  userId: string,
  refreshToken: string
) {
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash },
  });
}

export async function requireUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { error: fail("Autentifikatsiya talab qilinadi", 401) };
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, secret("access")) as JwtPayload;
    const scoped = payload as JwtPayload & { purpose?: string; aud?: string };
    if (scoped.purpose === "bluetooth-bridge" &&
        !["context", "credential", "result"].some((action) => req.nextUrl.pathname === `/api/ttlock/bluetooth-sync/${action}`)) {
      return { error: fail("Bluetooth token faqat scoped bridge amallari uchun", 403) };
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return { error: fail("Foydalanuvchi topilmadi", 401) };
    }
    const { checkRequestFeature } = await import("./plan-service");
    const featureError = await checkRequestFeature(user, req.nextUrl.pathname);
    if (featureError) return { error: featureError };
    return { user };
  } catch {
    return { error: fail("Token yaroqsiz", 401) };
  }
}
