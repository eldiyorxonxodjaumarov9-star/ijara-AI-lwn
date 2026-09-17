import type { User } from "@prisma/client";

import {
  persistRefreshToken,
  sanitizeUser,
  signTokens,
} from "@/lib/api-server/auth";
import { prisma } from "@/lib/api-server/prisma";
import {
  resolveUserWorkspaceContext,
  toPublicSubscriptionView,
} from "@/lib/api-server/workspace";

/** Issue JWT session after successful authentication (OTP or password). */
export async function issueAuthSession(user: User) {
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
  return {
    user: sanitizeUser(user),
    workspace: toPublicSubscriptionView(ctx),
    ...tokens,
  };
}
