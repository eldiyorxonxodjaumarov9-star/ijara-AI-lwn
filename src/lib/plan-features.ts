/**
 * Client + server safe plan feature catalog.
 * Single source of truth for DEMO vs PRO paid-feature gating.
 *
 * Paid only:
 * - smartLocks (TTLock / PIN / Bluetooth / gateway / access rights)
 * - aiFinanceOptimization
 * - aiEmployees
 * - roomComparison
 *
 * Core rental (rooms, tenants, contracts, basic reports, etc.) stays available on DEMO.
 */

export type AccessPlan = "DEMO" | "PRO";

export type PaidFeature =
  | "smartLocks"
  | "aiFinanceOptimization"
  | "aiEmployees"
  | "roomComparison";

export const PLAN_FEATURES: Record<AccessPlan, Record<PaidFeature, boolean>> = {
  DEMO: {
    smartLocks: false,
    aiFinanceOptimization: false,
    aiEmployees: false,
    roomComparison: false,
  },
  PRO: {
    smartLocks: true,
    aiFinanceOptimization: true,
    aiEmployees: true,
    roomComparison: true,
  },
};

/** Map stored subscription.plan (and aliases) → access plan. */
export function resolveAccessPlan(
  plan: string | null | undefined,
  opts?: { isInternal?: boolean }
): AccessPlan {
  if (opts?.isInternal) return "PRO";
  const normalized = plan?.trim().toUpperCase() ?? "";
  if (
    normalized === "PRO" ||
    normalized === "PREMIUM" ||
    normalized === "PAID" ||
    normalized === "INTERNAL"
  ) {
    return "PRO";
  }
  // FREE, DEMO, demo, null, unknown → DEMO
  return "DEMO";
}

export function hasFeature(
  plan: AccessPlan | string | null | undefined,
  feature: PaidFeature,
  opts?: { isInternal?: boolean }
): boolean {
  const accessPlan =
    plan === "DEMO" || plan === "PRO"
      ? plan
      : resolveAccessPlan(typeof plan === "string" ? plan : null, opts);
  if (opts?.isInternal) return true;
  return PLAN_FEATURES[accessPlan][feature];
}

/**
 * Full-page routes that require a paid feature.
 * Do NOT put core rental pages here (/lwn-rooms, /properties, /settings, …).
 */
export const PAID_ROUTE_FEATURES: ReadonlyArray<{
  prefix: string;
  feature: PaidFeature;
}> = [
  { prefix: "/ai-employees", feature: "aiEmployees" },
  { prefix: "/room-comparison", feature: "roomComparison" },
  { prefix: "/ai-inspection", feature: "roomComparison" },
];

export function featureForPagePath(pathname: string): PaidFeature | null {
  for (const entry of PAID_ROUTE_FEATURES) {
    if (
      pathname === entry.prefix ||
      pathname.startsWith(`${entry.prefix}/`)
    ) {
      return entry.feature;
    }
  }
  return null;
}

/**
 * Settings tabs are not wholly paid. Only specific panels (e.g. TTLock)
 * are gated inside the page — never block the whole integrations tab.
 */
export function settingsTabRequiresFeature(
  tab: string | null | undefined
): PaidFeature | null {
  void tab;
  return null;
}
