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

/**
 * Public registration — always EMPLOYEE.
 * Privileged roles (SUPER_ADMIN/ADMIN/MANAGER) cannot be self-assigned.
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  // Production: disable open registration unless explicitly enabled.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PUBLIC_REGISTER !== "true"
  ) {
    return fail("Ochiq ro‘yxatdan o‘tish o‘chirilgan", 403);
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      role?: string;
    };
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password || !body.fullName) {
      return fail("Majburiy maydonlar to'ldirilmagan", 400);
    }
    if (String(body.password).length < 6) {
      return fail("Parol kamida 6 ta belgi bo‘lishi kerak", 400);
    }

    // Ignore any client-supplied role (QA-001).
    void body.role;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return fail("Bu email allaqachon ro'yxatdan o'tgan", 409);
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(body.password, 10),
        fullName: body.fullName.trim(),
        phone: body.phone?.trim() || undefined,
        role: Role.EMPLOYEE,
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
