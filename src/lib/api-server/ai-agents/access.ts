import type { Role, User } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail } from "@/lib/api-server/http";
import { prisma } from "@/lib/api-server/prisma";
import { loadWorkspaceUsageAnalytics } from "@/lib/api-server/usage-analytics-server";
import {
  evaluateSubscriptionAccess,
  resolveUserWorkspaceContext,
  type WorkspaceContext,
} from "@/lib/api-server/workspace";

/**
 * AI Employees policy (server authority):
 * - SUPER_ADMIN / ADMIN: view, run, change settings
 * - MANAGER: view and run (agents are read-only)
 * - EMPLOYEE: no access
 */
export type AiEmployeesAction = "view" | "run" | "settings";

const POLICY: Record<AiEmployeesAction, readonly Role[]> = {
  view: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  run: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  settings: ["SUPER_ADMIN", "ADMIN"],
};

export function canAiEmployees(role: Role, action: AiEmployeesAction) {
  return POLICY[action].includes(role);
}

type Ok = { user: User; wsCtx: WorkspaceContext; workspaceId: string; error?: undefined };
type Err = { error: NextResponse; user?: undefined; wsCtx?: undefined; workspaceId?: undefined };

export async function requireAiEmployeesAccess(req: NextRequest, action: AiEmployeesAction): Promise<Ok | Err> {
  const auth = await requireUser(req);
  if (auth.error) return { error: auth.error };
  if (!canAiEmployees(auth.user.role, action)) return { error: fail("Ruxsat yo‘q", 403, "FORBIDDEN") };
  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  if (!wsCtx.hasAccess) return { error: fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED") };
  return { user: auth.user, wsCtx, workspaceId: wsCtx.workspace.id };
}

export function usageLoaderFor(wsCtx: Pick<WorkspaceContext, "workspace" | "isInternal" | "hasAccess" | "subscription">) {
  return () => loadWorkspaceUsageAnalytics(wsCtx, "30d");
}

/** Workspace context for the cron, which has no user session. */
export async function workspaceContextForCron(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { subscription: true },
  });
  if (!workspace) return null;
  const { subscription, ...ws } = workspace;
  const access = evaluateSubscriptionAccess({ isInternal: ws.isInternal, subscription });
  return { workspace: ws, isInternal: ws.isInternal, subscription, ...access };
}
