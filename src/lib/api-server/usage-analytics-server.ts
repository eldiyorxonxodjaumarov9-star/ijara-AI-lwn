import { planEntitlements } from "@/lib/api-server/plans";
import { prisma } from "@/lib/api-server/prisma";
import { detectDataFeatures } from "@/lib/api-server/usage-data-features";
import type { WorkspaceContext } from "@/lib/api-server/workspace";
import {
  computeUsageAnalytics,
  dataFeaturesFor,
  usagePeriodStart,
  type ActivityActor,
  type UsagePeriod,
  type UsagePlanFeature,
} from "@/lib/usage-analytics";

/** Platform usage (all-time) + Human / AI / Automation share for `period` — one workspace only. */
export async function loadWorkspaceUsageAnalytics(
  wsCtx: Pick<WorkspaceContext, "workspace" | "isInternal" | "hasAccess" | "subscription">,
  period: UsagePeriod
) {
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

  return computeUsageAnalytics({
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
  });
}
