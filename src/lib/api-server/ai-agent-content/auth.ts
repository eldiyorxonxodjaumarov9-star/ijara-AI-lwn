import type { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail } from "@/lib/api-server/http";
import {
  resolveUserWorkspaceContext,
  workspaceWhere,
} from "@/lib/api-server/workspace";

function isAdminRole(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function requireAiAgentContentAdmin(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return { error: auth.error as Response };
  if (!isAdminRole(auth.user.role)) {
    return { error: fail("Faqat admin", 403, "FORBIDDEN") as Response };
  }

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) {
    return {
      error: fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED") as Response,
    };
  }

  return {
    user: auth.user,
    workspaceId: wsCtx.workspace.id,
    ws: workspaceWhere(wsCtx.workspace.id),
  };
}
