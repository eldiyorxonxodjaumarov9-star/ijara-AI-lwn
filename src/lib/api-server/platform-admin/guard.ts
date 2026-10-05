import type { PlatformAdmin } from "@prisma/client";
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

import { PLATFORM_ADMIN_COOKIE, verifyPlatformAdminSession } from "./session";

export interface PublicPlatformAdmin {
  id: string;
  name: string;
  email: string;
  lastLoginAt: Date | null;
}

export function toPublicPlatformAdmin(admin: PlatformAdmin): PublicPlatformAdmin {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    lastLoginAt: admin.lastLoginAt,
  };
}

export async function resolvePlatformAdminSession(
  token: string | undefined | null
): Promise<PlatformAdmin | null> {
  const session = verifyPlatformAdminSession(token);
  if (!session || !isDatabaseConfigured()) return null;
  const admin = await prisma.platformAdmin.findUnique({
    where: { id: session.platformAdminId },
  });
  if (!admin || !admin.isActive) return null;
  return admin;
}

/** Server-side guard for every protected `/api/super-admin/*` handler. */
export async function requirePlatformAdmin(
  req: NextRequest
): Promise<{ admin: PlatformAdmin; error?: undefined } | { admin?: undefined; error: Response }> {
  try {
    const admin = await resolvePlatformAdminSession(req.cookies.get(PLATFORM_ADMIN_COOKIE)?.value);
    if (!admin) return { error: fail("Autentifikatsiya talab qilinadi", 401) };
    return { admin };
  } catch {
    return { error: fail("Autentifikatsiya talab qilinadi", 401) };
  }
}
