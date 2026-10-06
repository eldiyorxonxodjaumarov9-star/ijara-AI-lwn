import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { planEntitlements } from "@/lib/api-server/plans";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { detectDataFeatures } from "@/lib/api-server/usage-data-features";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";
import {
  computeUsageAnalytics,
  dataFeaturesFor,
  parseUsagePeriod,
  usagePeriodStart,
  type ActivityActor,
  type UsagePlanFeature,
} from "@/lib/usage-analytics";

/**
 * GET /api/dashboard/usage-analytics?period=7d|30d|90d — workspace from session only.
 * Platform usage is all-time (events + real records); `period` scopes only the
 * Human / AI / Automation share and breakdown.
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const period = parseUsagePeriod(req.nextUrl.searchParams.get("period"));
  if (!period) return fail("Davr noto‘g‘ri (7d, 30d yoki 90d)", 400, "INVALID_PERIOD");

  const wsCtx = await resolveUserWorkspaceContext(auth.user);
  const workspace = wsCtx.workspace;
  const workspaceId = workspace.id;
  const plan = planEntitlements(wsCtx);
  const isPlanAvailable = (feature: UsagePlanFeature) => plan.features[feature];

  const [groups, allTimeFeatures, dataFeatures] = await Promise.all([
    prisma.workspaceActivityEvent.groupBy({
      by: ["actionType", "actorType", "featureKey"],
      where: { workspaceId, createdAt: { gte: usagePeriodStart(period) } },
      _count: { _all: true },
    }),
    prisma.workspaceActivityEvent.groupBy({
      by: ["featureKey"],
      where: { workspaceId },
    }),
    detectDataFeatures(workspace, dataFeaturesFor(workspace.industry, isPlanAvailable)),
  ]);

  return ok(
    computeUsageAnalytics({
      period,
      industry: workspace.industry,
      rows: groups.map((g) => ({
        actionType: g.actionType,
        actorType: g.actorType as ActivityActor,
        featureKey: g.featureKey,
        count: g._count._all,
      })),
      eventFeatureKeys: allTimeFeatures.map((g) => g.featureKey),
      dataFeatureKeys: dataFeatures,
      isPlanAvailable,
    })
  );
}
