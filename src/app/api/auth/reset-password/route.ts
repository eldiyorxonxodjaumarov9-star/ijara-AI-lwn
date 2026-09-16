import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { hashPasswordResetToken } from "@/lib/api-server/portal-session";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

/** Single-use password reset via hashed token. */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  try {
    let body: { token?: string; password?: string; newPassword?: string };
    try {
      body = (await req.json()) as {
        token?: string;
        password?: string;
        newPassword?: string;
      };
    } catch {
      return fail("Token va yangi parol kerak", 400);
    }

    const token = body.token?.trim();
    const password = body.password ?? body.newPassword ?? "";
    if (!token || !password) {
      return fail("Token va yangi parol kerak", 400);
    }
    if (password.length < 6) {
      return fail("Parol kamida 6 ta belgi bo'lishi kerak", 400);
    }

    const hashed = hashPasswordResetToken(token);
    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashed,
        resetTokenExp: { gt: new Date() },
      },
    });
    if (!user) {
      return fail("Token yaroqsiz yoki muddati o'tgan", 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(password, 10),
        resetToken: null,
        resetTokenExp: null,
        refreshTokenHash: null,
      },
    });

    return ok({ message: "Parol muvaffaqiyatli yangilandi" });
  } catch {
    return fail("Parolni yangilash xatosi", 500);
  }
}
