import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

import {
  persistRefreshToken,
  sanitizeUser,
  signTokens,
} from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return fail("Email va parol kerak", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return fail("Email yoki parol noto'g'ri", 401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return fail("Email yoki parol noto'g'ri", 401);
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const tokens = await signTokens(payload);
    await persistRefreshToken(user.id, tokens.refreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return ok({ user: sanitizeUser(user), ...tokens });
  } catch {
    return fail("Kirish xatosi", 500);
  }
}
