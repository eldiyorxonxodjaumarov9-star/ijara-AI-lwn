import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

import { checkRateLimit } from "@/lib/api-server/contract-draft/rate-limit";
import { fail, ok } from "@/lib/api-server/http";
import { clientIp } from "@/lib/api-server/http/client-ip";
import {
  ensurePlatformAdminBootstrap,
  normalizePlatformAdminEmail,
} from "@/lib/api-server/platform-admin/bootstrap";
import { toPublicPlatformAdmin } from "@/lib/api-server/platform-admin/guard";
import {
  PLATFORM_ADMIN_COOKIE,
  platformAdminCookieOptions,
  signPlatformAdminSession,
} from "@/lib/api-server/platform-admin/session";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

const INVALID_CREDENTIALS = "Email yoki parol noto‘g‘ri";
const RATE_WINDOW_MS = 15 * 60 * 1000;
/** Compared against when the email is unknown so response timing stays uniform. */
const DUMMY_HASH = "$2b$12$XPw0p4kPRFw1/NpXsB5IHOOBQYv6ir.ndq8tvoUeZTDlqbWZtyBgC";

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail("Email va parol kerak", 400);
  }

  const email = normalizePlatformAdminEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || email.length > 254 || password.length > 200) {
    return fail("Email va parol kerak", 400);
  }

  const ipLimit = checkRateLimit(`platform-admin-login:ip:${clientIp(req)}`, 20, RATE_WINDOW_MS);
  const emailLimit = checkRateLimit(`platform-admin-login:email:${email}`, 8, RATE_WINDOW_MS);
  if (!ipLimit.ok || !emailLimit.ok) {
    const retryAfterSec = Math.max(
      ipLimit.ok ? 0 : ipLimit.retryAfterSec,
      emailLimit.ok ? 0 : emailLimit.retryAfterSec
    );
    const res = fail("Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.", 429);
    res.headers.set("Retry-After", String(retryAfterSec));
    return res;
  }

  try {
    await ensurePlatformAdminBootstrap();

    const admin = await prisma.platformAdmin.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !valid || !admin.isActive) {
      return fail(INVALID_CREDENTIALS, 401);
    }

    const updated = await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const res = ok({ admin: toPublicPlatformAdmin(updated) });
    res.cookies.set(PLATFORM_ADMIN_COOKIE, signPlatformAdminSession(admin.id), platformAdminCookieOptions());
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("[super-admin/login] unexpected error", (err as Error)?.message ?? "unknown");
    return fail("Kirish vaqtida server xatosi yuz berdi.", 500);
  }
}
