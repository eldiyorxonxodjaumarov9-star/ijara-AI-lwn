import { NextRequest } from "next/server";

import {
  checkOtpSendRateLimit,
  createEmailOtp,
  normalizeAuthEmail,
} from "@/lib/api-server/email/otp";
import {
  EmailSendError,
  isEmailSendingConfigured,
  sendOtpEmail,
} from "@/lib/api-server/email/send";
import { getOtpResendCooldownSec } from "@/lib/api-server/email/config";
import { fail, ok } from "@/lib/api-server/http";
import { clientIp } from "@/lib/api-server/http/client-ip";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import { emailOtpSendSchema } from "@/lib/validations";

const GENERIC_SENT =
  "Agar email to‘g‘ri bo‘lsa, tasdiqlash kodi yuborildi.";

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  if (!isEmailSendingConfigured()) {
    return fail("Email xizmati sozlanmagan", 503, "EMAIL_NOT_CONFIGURED");
  }

  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("Email kerak", 400);
    }

    const parsed = emailOtpSendSchema.safeParse(json);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Email noto‘g‘ri", 400);
    }

    const email = normalizeAuthEmail(parsed.data.email);
    if (!email) {
      return fail("To‘g‘ri email kiriting", 400);
    }

    const ip = clientIp(req);
    const rl = checkOtpSendRateLimit(email, ip);
    if (!rl.ok) {
      return fail(
        rl.reason === "email"
          ? `Kodni qayta yuborish uchun ${rl.retryAfterSec} soniya kuting`
          : "Juda ko‘p so‘rov. Keyinroq urinib ko‘ring.",
        429,
        "RATE_LIMITED"
      );
    }

    const { code } = await createEmailOtp(email);
    await sendOtpEmail({ to: email, code });

    return ok({
      message: GENERIC_SENT,
      retryAfterSec: getOtpResendCooldownSec(),
    });
  } catch (err) {
    if (err instanceof EmailSendError) {
      return fail(err.message, err.statusCode, "EMAIL_SEND_FAILED");
    }
    console.error("[auth/email/send-code]", err);
    return fail("Kod yuborishda xatolik", 500);
  }
}
