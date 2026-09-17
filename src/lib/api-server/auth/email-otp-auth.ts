import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { Role } from "@prisma/client";

import { issueAuthSession } from "@/lib/api-server/auth/issue-session";
import { verifyEmailOtpRecord } from "@/lib/api-server/email/otp";
import { prisma } from "@/lib/api-server/prisma";
import {
  createDemoWorkspaceForUser,
  ensureWorkspaceBootstrap,
} from "@/lib/api-server/workspace";

const DEFAULT_NEW_WORKSPACE_NAME = "Yangi ijara biznesi";

function randomPasswordHash(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString("base64url"), 10);
}

function defaultFullNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!local) return "Foydalanuvchi";
  return local.slice(0, 120);
}

export type EmailOtpAuthResult =
  | { ok: true; session: Awaited<ReturnType<typeof issueAuthSession>>; isNewUser: boolean }
  | {
      ok: false;
      message: string;
      status: number;
      code?: string;
    };

/**
 * Verify OTP and authenticate. Creates user + DEMO workspace only after OTP success.
 */
export async function authenticateWithEmailOtp(
  email: string,
  code: string
): Promise<EmailOtpAuthResult> {
  const otpResult = await verifyEmailOtpRecord(email, code);
  if (!otpResult.ok) {
    if (otpResult.reason === "blocked") {
      return {
        ok: false,
        message: "Kod noto‘g‘ri yoki muddati tugagan.",
        status: 429,
        code: "OTP_BLOCKED",
      };
    }
    return {
      ok: false,
      message: "Kod noto‘g‘ri yoki muddati tugagan.",
      status: 401,
      code: "OTP_INVALID",
    };
  }

  await ensureWorkspaceBootstrap();

  let user = await prisma.user.findUnique({ where: { email } });
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    user = await prisma.user.create({
      data: {
        email,
        password: await randomPasswordHash(),
        fullName: defaultFullNameFromEmail(email),
        role: Role.ADMIN,
      },
    });
    await createDemoWorkspaceForUser({
      userId: user.id,
      workspaceName: DEFAULT_NEW_WORKSPACE_NAME,
    });
  } else if (!user.isActive) {
    return {
      ok: false,
      message: "Hisob faol emas",
      status: 403,
      code: "ACCOUNT_INACTIVE",
    };
  }

  const session = await issueAuthSession(user);
  return { ok: true, session, isNewUser };
}
