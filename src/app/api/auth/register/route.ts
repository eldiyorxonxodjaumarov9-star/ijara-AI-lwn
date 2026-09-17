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
import {
  createDemoWorkspaceForUser,
  resolveUserWorkspaceContext,
  toPublicSubscriptionView,
} from "@/lib/api-server/workspace";
import { registerSchema } from "@/lib/validations";

function isPublicRegistrationAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.ALLOW_PUBLIC_REGISTER === "true") return true;
  if (process.env.ENABLE_WORKSPACE_SIGNUP === "true") return true;
  return false;
}

/**
 * Workspace signup — always ADMIN (workspace owner).
 * Privileged roles (SUPER_ADMIN) cannot be self-assigned.
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  if (!isPublicRegistrationAllowed()) {
    return fail("Ochiq ro‘yxatdan o‘tish o‘chirilgan", 403);
  }

  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("Noto'g'ri so'rov", 400);
    }

    const parsed = registerSchema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message;
      return fail(first ?? "Ma'lumotlar noto'g'ri", 400);
    }

    const { email, password, company, phone } = parsed.data;
    const fullName = (
      parsed.data.displayName?.trim() ||
      parsed.data.fullName?.trim() ||
      ""
    ).slice(0, 120);

    const normalizedEmail = email.trim().toLowerCase();

    const exists = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (exists) {
      return fail("Bu email allaqachon ro'yxatdan o'tgan", 409);
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10),
        fullName,
        phone: phone?.trim() || undefined,
        role: Role.ADMIN,
      },
    });

    await createDemoWorkspaceForUser({
      userId: user.id,
      workspaceName: company?.trim() || fullName,
    });

    const ctx = await resolveUserWorkspaceContext(user);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      workspaceId: ctx.workspace.id,
    };
    const tokens = await signTokens(payload);
    await persistRefreshToken(user.id, tokens.refreshToken);

    return ok(
      {
        user: sanitizeUser(user),
        workspace: toPublicSubscriptionView(ctx),
        ...tokens,
      },
      201
    );
  } catch (err) {
    console.error("[auth/register] unexpected error", err);
    return fail("Ro'yxatdan o'tish xatosi", 500);
  }
}
