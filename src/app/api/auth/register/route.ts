import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
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
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      role?: Role;
    };
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password || !body.fullName) {
      return fail("Majburiy maydonlar to'ldirilmagan", 400);
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return fail("Bu email allaqachon ro'yxatdan o'tgan", 409);
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(body.password, 10),
        fullName: body.fullName,
        phone: body.phone,
        role: body.role ?? Role.MANAGER,
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const tokens = await signTokens(payload);
    await persistRefreshToken(user.id, tokens.refreshToken);

    return ok({ user: sanitizeUser(user), ...tokens }, 201);
  } catch {
    return fail("Ro'yxatdan o'tish xatosi", 500);
  }
}
