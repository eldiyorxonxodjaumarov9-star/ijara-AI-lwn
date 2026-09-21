"use client";

import { useAuth } from "@/context/auth-context";
import {
  hasFeature as hasPaidFeature,
  resolveAccessPlan,
  type PaidFeature,
} from "@/lib/plan-features";
import type { WorkspaceSubscriptionView } from "@/types";

export function workspaceHasFeature(
  workspace: WorkspaceSubscriptionView | null | undefined,
  feature: PaidFeature
): boolean {
  if (!workspace) return false;
  if (workspace.isInternal) return true;
  // Prefer server-computed entitlements when present
  const fromEntitlements = workspace.entitlements?.features?.[feature];
  if (typeof fromEntitlements === "boolean") return fromEntitlements;
  return hasPaidFeature(workspace.plan, feature, {
    isInternal: workspace.isInternal,
  });
}

export function usePlanFeatures() {
  const { workspace } = useAuth();
  const accessPlan = resolveAccessPlan(workspace?.plan, {
    isInternal: workspace?.isInternal,
  });

  const can = (feature: PaidFeature) =>
    workspaceHasFeature(workspace, feature);

  return {
    workspace,
    accessPlan,
    isDemo: !workspace?.isInternal && accessPlan === "DEMO",
    isPro: Boolean(workspace?.isInternal) || accessPlan === "PRO",
    hasFeature: can,
    entitlements: workspace?.entitlements ?? null,
  };
}
