import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import type { JwtPayload } from "@/lib/api-server/auth";
import { persistRefreshToken, signTokens } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  try {
    const body = (await req.json()) as { refreshToken?: string };
    if (!body.refreshToken) {
      return fail("Refresh token kerak", 400);
    }

    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) return fail("JWT sozlanmagan", 501);

    let payload: JwtPayload;
    try {
      payload = jwt.verify(body.refreshToken, secret) as JwtPayload;
    } catch {
      return fail("Refresh token yaroqsiz", 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.refreshTokenHash) {
      return fail("Sessiya topilmadi", 401);
    }

    const matches = await bcrypt.compare(
      body.refreshToken,
      user.refreshTokenHash
    );
    if (!matches) {
      return fail("Refresh token mos kelmadi", 401);
    }

    const tokens = await signTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    await persistRefreshToken(user.id, tokens.refreshToken);
    return ok(tokens);
  } catch {
    return fail("Token yangilash xatosi", 500);
  }
}
