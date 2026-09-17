import { NextRequest } from "next/server";

import { authenticateWithEmailOtp } from "@/lib/api-server/auth/email-otp-auth";
import {
  checkOtpVerifyRateLimit,
  normalizeAuthEmail,
} from "@/lib/api-server/email/otp";
import { fail, ok } from "@/lib/api-server/http";
import { clientIp } from "@/lib/api-server/http/client-ip";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { emailOtpVerifySchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("Email va kod kerak", 400);
    }

    const parsed = emailOtpVerifySchema.safeParse(json);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Ma'lumot noto‘g‘ri", 400);
    }

    const email = normalizeAuthEmail(parsed.data.email);
    if (!email) {
      return fail("To‘g‘ri email kiriting", 400);
    }

    const ip = clientIp(req);
    const rl = checkOtpVerifyRateLimit(ip);
    if (!rl.ok) {
      return fail("Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.", 429);
    }

    const result = await authenticateWithEmailOtp(
      email,
      parsed.data.code.trim()
    );

    if (!result.ok) {
      return fail(result.message, result.status, result.code);
    }

    return ok({
      ...result.session,
      isNewUser: result.isNewUser,
    });
  } catch (err) {
    console.error("[auth/email/verify-code]", err);
    return fail("Tasdiqlashda xatolik", 500);
  }
}
