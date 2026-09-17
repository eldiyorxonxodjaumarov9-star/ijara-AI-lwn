import { NextRequest } from "next/server";

import { isEmailSendingConfigured } from "@/lib/api-server/email/config";
import { fail, ok } from "@/lib/api-server/http";
import {
  createPasswordResetRawToken,
  hashPasswordResetToken,
} from "@/lib/api-server/portal-session";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

const GENERIC_MESSAGE =
  "Agar hisob mavjud bo'lsa, parolni tiklash ko'rsatmasi yuborildi";

export { isEmailSendingConfigured };

/** Enumeration-safe password reset request. */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  try {
    let body: { email?: string };
    try {
      body = (await req.json()) as { email?: string };
    } catch {
      return fail("Email kerak", 400);
    }

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return fail("Email kerak", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.isActive) {
      const rawToken = createPasswordResetRawToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: hashPasswordResetToken(rawToken),
          resetTokenExp: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      if (isEmailSendingConfigured()) {
        // Email transport not wired yet — token stored for future delivery.
      } else if (process.env.NODE_ENV !== "production") {
        console.info("[auth/forgot-password] email sending not configured");
      }
    }

    return ok({ message: GENERIC_MESSAGE });
  } catch {
    return fail("So'rov xatosi", 500);
  }
}
