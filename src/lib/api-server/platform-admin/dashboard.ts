import type { Prisma } from "@prisma/client";

import { normalizePlan } from "@/lib/api-server/plans";
import { prisma } from "@/lib/api-server/prisma";
import { isRentalIndustry } from "@/lib/rental-industry";
import {
  addDays,
  SUPER_ADMIN_INDUSTRIES,
  tashkentDateKey,
  tashkentDayStart,
  tashkentLastDays,
  type DashboardPlan,
  type PlatformDashboardData,
} from "@/lib/super-admin-dashboard";

export const RECENT_REGISTRATIONS_LIMIT = 10;
const TREND_DAYS = 7;

/** Customer data only: internal/platform workspaces and accounts are excluded. */
const customerWorkspace = { isInternal: false } satisfies Prisma.WorkspaceWhereInput;
const customerUser = {
  isInternalAccount: false,
  role: { not: "SUPER_ADMIN" },
} satisfies Prisma.UserWhereInput;
/** A registration is a self-signup: a customer user who owns a customer workspace. */
const registeredOwner = {
  ...customerUser,
  workspaceMemberships: { some: { role: "OWNER", workspace: customerWorkspace } },
} satisfies Prisma.UserWhereInput;

export async function loadPlatformDashboard(now: Date = new Date()): Promise<PlatformDashboardData> {
  const todayStart = tashkentDayStart(now);
  const weekStart = addDays(todayStart, -(TREND_DAYS - 1));

  const [
    totalUsers,
    totalWorkspaces,
    workspacesCreatedToday,
    workspacesCreatedLast7Days,
    planGroups,
    activeWorkspaces,
    activeSubscriptions,
    industryGroups,
    weekRegistrations,
    recent,
  ] = await Promise.all([
    prisma.user.count({ where: customerUser }),
    prisma.workspace.count({ where: customerWorkspace }),
    prisma.workspace.count({ where: { ...customerWorkspace, createdAt: { gte: todayStart } } }),
    prisma.workspace.count({ where: { ...customerWorkspace, createdAt: { gte: weekStart } } }),
    prisma.workspaceSubscription.groupBy({
      by: ["plan"],
      where: { workspace: customerWorkspace },
      _count: { _all: true },
    }),
    // Mirrors evaluateSubscriptionAccess: ACTIVE, or DEMO that has not expired.
    prisma.workspaceSubscription.count({
      where: {
        workspace: customerWorkspace,
        OR: [
          { status: "ACTIVE" },
          { status: "DEMO", OR: [{ demoEndsAt: null }, { demoEndsAt: { gte: now } }] },
        ],
      },
    }),
    prisma.workspaceSubscription.count({ where: { workspace: customerWorkspace, status: "ACTIVE" } }),
    prisma.workspace.groupBy({
      by: ["industry"],
      where: customerWorkspace,
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { ...registeredOwner, createdAt: { gte: weekStart } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: registeredOwner,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: RECENT_REGISTRATIONS_LIMIT,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        createdAt: true,
        workspaceMemberships: {
          where: { role: "OWNER", workspace: customerWorkspace },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            workspace: {
              select: { name: true, industry: true, subscription: { select: { plan: true } } },
            },
          },
        },
      },
    }),
  ]);

  const planCounts: Record<DashboardPlan, number> = { FREE: 0, PRO: 0, PREMIUM: 0 };
  for (const group of planGroups) {
    const plan = normalizePlan(group.plan);
    if (plan === "PRO" || plan === "PREMIUM") planCounts[plan] += group._count._all;
  }
  // Every workspace without a paid plan (FREE/DEMO/unknown/no subscription) counts once as FREE.
  planCounts.FREE = Math.max(0, totalWorkspaces - planCounts.PRO - planCounts.PREMIUM);

  const industryCounts = new Map(industryGroups.map((g) => [g.industry, g._count._all]));

  const trendDays = tashkentLastDays(now, TREND_DAYS);
  const trendCounts = new Map(trendDays.map((d) => [d, 0]));
  for (const { createdAt } of weekRegistrations) {
    const key = tashkentDateKey(createdAt);
    if (trendCounts.has(key)) trendCounts.set(key, trendCounts.get(key)! + 1);
  }
  const todayKey = tashkentDateKey(now);

  return {
    generatedAt: now.toISOString(),
    timezone: "Asia/Tashkent",
    kpis: {
      totalUsers,
      totalWorkspaces,
      todayRegistrations: trendCounts.get(todayKey) ?? 0,
      last7DaysRegistrations: [...trendCounts.values()].reduce((a, b) => a + b, 0),
      demoWorkspaces: planCounts.FREE,
      proWorkspaces: planCounts.PRO,
      premiumWorkspaces: planCounts.PREMIUM,
      activeWorkspaces,
    },
    planBreakdown: (["FREE", "PRO", "PREMIUM"] as const).map((plan) => ({ plan, count: planCounts[plan] })),
    industryBreakdown: SUPER_ADMIN_INDUSTRIES.map((industry) => ({
      industry,
      count: industryCounts.get(industry) ?? 0,
    })),
    registrationTrend: trendDays.map((date) => ({ date, count: trendCounts.get(date) ?? 0 })),
    workspaceActivity: { workspacesCreatedToday, workspacesCreatedLast7Days, activeSubscriptions },
    recentRegistrations: recent.map((user) => {
      const workspace = user.workspaceMemberships[0]?.workspace ?? null;
      const subscription = workspace?.subscription ?? null;
      return {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        business: workspace?.name ?? null,
        industry: workspace && isRentalIndustry(workspace.industry) ? workspace.industry : null,
        plan: subscription ? (normalizePlan(subscription.plan) ?? "FREE") : null,
        registeredAt: user.createdAt.toISOString(),
      };
    }),
  };
}
