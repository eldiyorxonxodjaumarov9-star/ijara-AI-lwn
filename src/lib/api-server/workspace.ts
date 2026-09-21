import type {
  SubscriptionStatus,
  User,
  Workspace,
  WorkspaceMemberRole,
  WorkspaceSubscription,
} from "@prisma/client";
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api-server/http";
import { prisma } from "@/lib/api-server/prisma";

import { planEntitlements } from "./plans";

export const INTERNAL_WORKSPACE_SLUG = "internal-ijara-ai";

export type WorkspaceContext = {
  workspace: Workspace;
  membershipRole: WorkspaceMemberRole | null;
  subscription: WorkspaceSubscription | null;
  isInternal: boolean;
  /** True when user may use product APIs (demo active or ACTIVE or internal). */
  hasAccess: boolean;
  accessReason:
    | "internal"
    | "active"
    | "demo"
    | "demo_expired"
    | "past_due"
    | "canceled"
    | "none";
  demoEndsAt: Date | null;
};

export function getDemoTrialDays(): number {
  const raw = process.env.DEMO_TRIAL_DAYS?.trim();
  const n = raw ? Number(raw) : 14;
  if (!Number.isFinite(n) || n < 1 || n > 365) return 14;
  return Math.floor(n);
}

export function isInternalUser(user: Pick<User, "role" | "isInternalAccount" | "email">): boolean {
  if (user.isInternalAccount) return true;
  if (user.role === "SUPER_ADMIN") return true;
  const envEmail = process.env.INTERNAL_ACCOUNT_EMAIL?.trim().toLowerCase();
  if (envEmail && user.email.trim().toLowerCase() === envEmail) return true;
  return false;
}

export function evaluateSubscriptionAccess(opts: {
  isInternal: boolean;
  subscription: WorkspaceSubscription | null;
  now?: Date;
}): Pick<WorkspaceContext, "hasAccess" | "accessReason" | "demoEndsAt"> {
  const now = opts.now ?? new Date();
  if (opts.isInternal) {
    return { hasAccess: true, accessReason: "internal", demoEndsAt: null };
  }
  const sub = opts.subscription;
  if (!sub) {
    return { hasAccess: false, accessReason: "none", demoEndsAt: null };
  }
  if (sub.status === "ACTIVE") {
    return {
      hasAccess: true,
      accessReason: "active",
      demoEndsAt: sub.demoEndsAt,
    };
  }
  if (sub.status === "DEMO") {
    const ends = sub.demoEndsAt;
    if (ends && ends.getTime() < now.getTime()) {
      return { hasAccess: false, accessReason: "demo_expired", demoEndsAt: ends };
    }
    return { hasAccess: true, accessReason: "demo", demoEndsAt: ends };
  }
  if (sub.status === "PAST_DUE") {
    return {
      hasAccess: false,
      accessReason: "past_due",
      demoEndsAt: sub.demoEndsAt,
    };
  }
  return {
    hasAccess: false,
    accessReason: "canceled",
    demoEndsAt: sub.demoEndsAt,
  };
}

/**
 * Idempotent: create internal workspace, mark SUPER_ADMIN users internal,
 * backfill null workspaceId on business tables. Never deletes data.
 */
export async function ensureWorkspaceBootstrap(): Promise<Workspace> {
  let workspace = await prisma.workspace.findFirst({
    where: { isInternal: true },
  });
  if (!workspace) {
    workspace = await prisma.workspace.findFirst({
      where: { slug: INTERNAL_WORKSPACE_SLUG },
    });
  }
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Ijara AI (Internal)",
        slug: INTERNAL_WORKSPACE_SLUG,
        isInternal: true,
        subscription: {
          create: {
            status: "ACTIVE",
            plan: "internal",
            startedAt: new Date(),
            currentPeriodStart: new Date(),
          },
        },
      },
    });
  } else if (!workspace.isInternal) {
    workspace = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { isInternal: true },
    });
  }

  const wsId = workspace.id;

  // Mark platform admins
  await prisma.user.updateMany({
    where: {
      OR: [
        { role: "SUPER_ADMIN" },
        ...(process.env.INTERNAL_ACCOUNT_EMAIL
          ? [{ email: process.env.INTERNAL_ACCOUNT_EMAIL.trim().toLowerCase() }]
          : []),
      ],
      isInternalAccount: false,
    },
    data: { isInternalAccount: true },
  });

  // Ensure memberships for internal users + legacy EMPLOYEE staff (pre-SaaS).
  // Do NOT auto-attach Role.ADMIN — those are SaaS workspace owners.
  const legacyUsers = await prisma.user.findMany({
    where: {
      OR: [
        { isInternalAccount: true },
        { role: "SUPER_ADMIN" },
        { role: "EMPLOYEE" },
      ],
      workspaceMemberships: { none: {} },
    },
    select: { id: true, role: true },
  });
  for (const u of legacyUsers) {
    await prisma.workspaceMembership.create({
      data: {
        workspaceId: wsId,
        userId: u.id,
        role: u.role === "EMPLOYEE" ? "EMPLOYEE" : "OWNER",
      },
    });
  }

  // Ensure subscription row for internal workspace
  const sub = await prisma.workspaceSubscription.findUnique({
    where: { workspaceId: wsId },
  });
  if (!sub) {
    await prisma.workspaceSubscription.create({
      data: {
        workspaceId: wsId,
        status: "ACTIVE",
        plan: "internal",
        startedAt: new Date(),
      },
    });
  }

  // Link singleton company profile
  const company = await prisma.company.findFirst();
  if (company && !company.workspaceId) {
    await prisma.company.update({
      where: { id: company.id },
      data: { workspaceId: wsId },
    });
  }

  // Backfill business rows (null workspaceId only)
  await Promise.all([
    prisma.property.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.tenant.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.contract.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.payment.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.expense.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.maintenance.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.employee.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.partnerCompany.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.client.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.contactLead.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.workTask.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
    prisma.notification.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    }),
  ]);

  return workspace;
}

export async function createDemoWorkspaceForUser(opts: {
  userId: string;
  workspaceName: string;
}): Promise<{ workspace: Workspace; subscription: WorkspaceSubscription }> {
  const days = getDemoTrialDays();
  const now = new Date();
  const demoEndsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const workspace = await prisma.workspace.create({
    data: {
      name: opts.workspaceName.slice(0, 120) || "Mening workspace",
      isInternal: false,
      memberships: {
        create: {
          userId: opts.userId,
          role: "OWNER",
        },
      },
      subscription: {
        create: {
          status: "DEMO",
          plan: "demo",
          startedAt: now,
          demoStartedAt: now,
          demoEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: demoEndsAt,
        },
      },
      companyProfile: {
        create: {
          name: opts.workspaceName.slice(0, 120) || "Ijara AI",
        },
      },
    },
    include: { subscription: true },
  });

  return {
    workspace,
    subscription: workspace.subscription!,
  };
}

export async function resolveUserWorkspaceContext(
  user: User
): Promise<WorkspaceContext> {
  await ensureWorkspaceBootstrap();

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id },
    include: {
      workspace: { include: { subscription: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    // Legacy single-tenant staff (EMPLOYEE / SUPER_ADMIN / internal) → internal workspace.
    // New SaaS owners are Role.ADMIN and get a DEMO workspace (register creates membership;
    // this path is recovery only).
    const attachToInternal =
      isInternalUser(user) || user.role === "EMPLOYEE" || user.role === "SUPER_ADMIN";

    if (attachToInternal) {
      const internal = await prisma.workspace.findFirstOrThrow({
        where: { isInternal: true },
        include: { subscription: true },
      });
      const memberRole =
        user.role === "EMPLOYEE" ? "EMPLOYEE" : ("OWNER" as const);
      await prisma.workspaceMembership.create({
        data: {
          workspaceId: internal.id,
          userId: user.id,
          role: memberRole,
        },
      });
      const access = evaluateSubscriptionAccess({
        isInternal: true,
        subscription: internal.subscription,
      });
      return {
        workspace: internal,
        membershipRole: memberRole,
        subscription: internal.subscription,
        isInternal: true,
        ...access,
      };
    }

    const created = await createDemoWorkspaceForUser({
      userId: user.id,
      workspaceName: `${user.fullName} workspace`,
    });
    const access = evaluateSubscriptionAccess({
      isInternal: false,
      subscription: created.subscription,
    });
    return {
      workspace: created.workspace,
      membershipRole: "OWNER",
      subscription: created.subscription,
      isInternal: false,
      ...access,
    };
  }

  const isInternal =
    membership.workspace.isInternal || isInternalUser(user);
  const access = evaluateSubscriptionAccess({
    isInternal,
    subscription: membership.workspace.subscription,
  });
  return {
    workspace: membership.workspace,
    membershipRole: membership.role,
    subscription: membership.workspace.subscription,
    isInternal,
    ...access,
  };
}

/** Auth + workspace context. Optionally enforce subscription for product APIs. */
export async function requireWorkspace(
  req: NextRequest,
  opts: { requireSubscription?: boolean } = {}
) {
  const { requireUser } = await import("@/lib/api-server/auth");
  const auth = await requireUser(req);
  if (auth.error) return auth;

  const ctx = await resolveUserWorkspaceContext(auth.user);
  if (opts.requireSubscription !== false && !ctx.hasAccess) {
    return {
      error: fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED"),
    };
  }
  return { user: auth.user, workspace: ctx };
}

export function workspaceWhere(workspaceId: string) {
  return { workspaceId };
}

/** False when record is missing or belongs to another workspace (use 404). */
export function isRecordInWorkspace<T extends { workspaceId?: string | null }>(
  record: T | null | undefined,
  workspaceId: string
): record is T {
  if (!record) return false;
  // Null workspaceId is not owned by the caller (avoids IDOR before/during backfill).
  return record.workspaceId === workspaceId;
}

export type PublicSubscriptionView = {
  status: SubscriptionStatus;
  plan: string | null;
  demoEndsAt: string | null;
  currentPeriodEnd: string | null;
  hasAccess: boolean;
  accessReason: WorkspaceContext["accessReason"];
  isInternal: boolean;
  workspaceId: string;
  workspaceName: string;
  trialDays: number;
  currentPeriodStart: string | null;
  entitlements: ReturnType<typeof planEntitlements>;
};

export function toPublicSubscriptionView(
  ctx: WorkspaceContext
): PublicSubscriptionView {
  return {
    status: ctx.subscription?.status ?? "CANCELED",
    plan: ctx.subscription?.plan ?? null,
    demoEndsAt: ctx.subscription?.demoEndsAt?.toISOString() ?? null,
    currentPeriodEnd: ctx.subscription?.currentPeriodEnd?.toISOString() ?? null,
    hasAccess: ctx.hasAccess,
    accessReason: ctx.accessReason,
    isInternal: ctx.isInternal,
    workspaceId: ctx.workspace.id,
    workspaceName: ctx.workspace.name,
    trialDays: getDemoTrialDays(),
    currentPeriodStart: ctx.subscription?.currentPeriodStart?.toISOString() ?? null,
    entitlements: planEntitlements(ctx),
  };
}
