import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

import {
  persistRefreshToken,
  sanitizeUser,
  signTokens,
} from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  ensureWorkspaceBootstrap,
  resolveUserWorkspaceContext,
  toPublicSubscriptionView,
} from "@/lib/api-server/workspace";
import { normalizeEmployeePhone } from "@/lib/employee-units";

const INVALID_CREDENTIALS = "Email yoki parol noto‘g‘ri";

function resolveIdentifier(body: {
  identifier?: string;
  email?: string;
  phone?: string;
}): string {
  return (
    body.identifier?.trim() ||
    body.email?.trim() ||
    body.phone?.trim() ||
    ""
  );
}

async function findUserByIdentifier(raw: string) {
  if (raw.includes("@")) {
    return prisma.user.findUnique({
      where: { email: raw.trim().toLowerCase() },
    });
  }

  const normalized = normalizeEmployeePhone(raw);
  if (!normalized) return null;

  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
  });

  return (
    users.find((user) => normalizeEmployeePhone(user.phone) === normalized) ??
    null
  );
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  try {
    let body: {
      identifier?: string;
      email?: string;
      phone?: string;
      password?: string;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("Login va parol kerak", 400);
    }

    const identifier = resolveIdentifier(body);
    const password = body.password ?? "";
    if (!identifier || !password) {
      return fail("Login va parol kerak", 400);
    }

    const user = await findUserByIdentifier(identifier);
    if (!user || !user.isActive) {
      return fail(INVALID_CREDENTIALS, 401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return fail(INVALID_CREDENTIALS, 401);
    }

    await ensureWorkspaceBootstrap();
    const ctx = await resolveUserWorkspaceContext(user);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      workspaceId: ctx.workspace.id,
    };
    const tokens = await signTokens(payload);
    await persistRefreshToken(user.id, tokens.refreshToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return ok({
      user: sanitizeUser(user),
      workspace: toPublicSubscriptionView(ctx),
      ...tokens,
    });
  } catch (err) {
    console.error("[auth/login] unexpected error", err);
    return fail("Kirish vaqtida server xatosi yuz berdi.", 500);
  }
}
