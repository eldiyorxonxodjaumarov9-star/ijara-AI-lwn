import type { WorkspaceContext } from "./workspace";
import {
  hasFeature as hasPaidFeature,
  PLAN_FEATURES,
  resolveAccessPlan,
  type AccessPlan,
  type PaidFeature,
} from "@/lib/plan-features";

export type Plan = "FREE" | "PRO" | "PREMIUM";
export type Quota = "properties" | "tenants" | "employees";

/** Catalog features (quotas UI) + paid gates. */
export type Feature =
  | "telegram"
  | "smartLocks"
  | "advancedReports"
  | "aiFinanceOptimization"
  | "aiEmployees"
  | "roomComparison"
  | "expenses"
  | "tasks"
  | "maintenance";

export type PlanDefinition = {
  id: Plan;
  price: number;
  limits: Record<Quota, number | null>;
  features: Record<Feature, boolean>;
  highlights: string[];
  cta: string;
  /** Product access tier shown to users (DEMO | PRO). */
  accessPlan: AccessPlan;
};

type CatalogOnlyFeature = Exclude<Feature, PaidFeature | "advancedReports">;

function withPaid(
  accessPlan: AccessPlan,
  rest: Record<CatalogOnlyFeature, boolean>
): PlanDefinition["features"] {
  const paid = PLAN_FEATURES[accessPlan];
  return {
    ...rest,
    smartLocks: paid.smartLocks,
    aiFinanceOptimization: paid.aiFinanceOptimization,
    aiEmployees: paid.aiEmployees,
    roomComparison: paid.roomComparison,
    // Keep advancedReports aligned with AI finance optimization
    advancedReports: paid.aiFinanceOptimization,
  };
}

// Catalog for pricing UI. Paid feature flags come from PLAN_FEATURES (DEMO vs PRO).
export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    id: "FREE",
    accessPlan: "DEMO",
    price: 0,
    limits: { properties: 3, tenants: 3, employees: 1 },
    features: withPaid("DEMO", {
      // Free integrations (Telegram posting, etc.) stay available on DEMO
      telegram: true,
      expenses: true,
      tasks: true,
      maintenance: true,
    }),
    highlights: [
      "3 tagacha xona",
      "3 tagacha arendator",
      "1 xodim",
      "Shartnomalar",
      "To‘lovlar va qarzdorlik",
      "Asosiy dashboard va hisobotlar",
      "Telegram va bepul integratsiyalar",
    ],
    cta: "Bepul boshlash",
  },
  PRO: {
    id: "PRO",
    accessPlan: "PRO",
    price: 149000,
    limits: { properties: 30, tenants: 300, employees: 10 },
    features: withPaid("PRO", {
      telegram: true,
      expenses: true,
      tasks: true,
      maintenance: true,
    }),
    highlights: [
      "30 tagacha xona",
      "300 tagacha arendator",
      "10 tagacha xodim",
      "TTLock / Smart Lock",
      "AI moliyaviy tahlil",
      "AI xodimlar",
      "Telegram eslatmalari",
    ],
    cta: "Pro tarifini tanlash",
  },
  PREMIUM: {
    id: "PREMIUM",
    accessPlan: "PRO",
    price: 299000,
    limits: { properties: null, tenants: null, employees: null },
    features: withPaid("PRO", {
      telegram: true,
      expenses: true,
      tasks: true,
      maintenance: true,
    }),
    highlights: [
      "Cheklanmagan xonalar, arendatorlar va xodimlar",
      "Barcha Pro imkoniyatlari",
      "TTLock / smart lock",
      "AI moliyaviy tahlil va xodimlar",
      "Priority support",
    ],
    cta: "Premium tarifini tanlash",
  },
};

export function normalizePlan(value: string | null | undefined): Plan | null {
  const plan = value?.toUpperCase();
  if (plan === "FREE" || plan === "DEMO") return "FREE";
  if (plan === "PRO" || plan === "PAID") return "PRO";
  if (plan === "PREMIUM") return "PREMIUM";
  return null;
}

export function getPlanLimits(plan: Plan) {
  return PLANS[plan].limits;
}

/**
 * Resolve entitlements for a workspace.
 * DEMO / null / "demo" / FREE → DEMO paid features OFF.
 * PRO / PREMIUM / internal → PRO paid features ON.
 */
export function planEntitlements(
  ctx: Pick<WorkspaceContext, "isInternal" | "hasAccess" | "subscription">
): PlanDefinition {
  if (ctx.isInternal) return PLANS.PREMIUM;

  const access = resolveAccessPlan(ctx.subscription?.plan, {
    isInternal: ctx.isInternal,
  });
  if (access === "PRO") {
    const catalog = normalizePlan(ctx.subscription?.plan);
    return catalog === "PRO" ? PLANS.PRO : PLANS.PREMIUM;
  }
  return PLANS.FREE;
}

export function canUseFeature(
  ctx: Pick<WorkspaceContext, "isInternal" | "hasAccess" | "subscription">,
  feature: Feature
) {
  if (ctx.isInternal) return true;
  if (!ctx.hasAccess) return false;
  return planEntitlements(ctx).features[feature];
}

/** Central helper — prefer this over hardcoding plan === "DEMO". */
export function hasFeature(
  ctx: Pick<WorkspaceContext, "isInternal" | "hasAccess" | "subscription">,
  feature: PaidFeature
) {
  if (ctx.isInternal) return true;
  if (!ctx.hasAccess) return false;
  return hasPaidFeature(ctx.subscription?.plan, feature, {
    isInternal: ctx.isInternal,
  });
}

export class PlanError extends Error {
  constructor(
    message: string,
    readonly code = "PLAN_UPGRADE_REQUIRED",
    readonly status = 403
  ) {
    super(message);
  }
}

export function assertPlanFeature(
  ctx: Pick<WorkspaceContext, "isInternal" | "hasAccess" | "subscription">,
  feature: Feature
) {
  if (canUseFeature(ctx, feature)) return;
  throw new PlanError(
    "Bu funksiya Pro tarifida mavjud. Tarifni yangilash.",
    "PLAN_UPGRADE_REQUIRED",
    403
  );
}

export function assertPlanLimit(
  ctx: Pick<WorkspaceContext, "isInternal" | "hasAccess" | "subscription">,
  resource: Quota,
  count: number
) {
  if (ctx.isInternal) return;
  if (!ctx.hasAccess) {
    throw new PlanError("Ijara AI tarifini tanlang", "SUBSCRIPTION_REQUIRED", 402);
  }
  const limit = planEntitlements(ctx).limits[resource];
  if (limit === null || count < limit) return;
  const label = { properties: "xona", tenants: "arendator", employees: "xodim" }[
    resource
  ];
  const plan = normalizePlan(ctx.subscription?.plan) ?? "FREE";
  const next = plan === "FREE" ? "Pro" : "Premium";
  throw new PlanError(
    `${plan} tarifida ${limit} tagacha ${label} qo‘shish mumkin. Ko‘proq ${label} uchun ${next} tarifiga o‘ting.`,
    "PLAN_LIMIT_REACHED"
  );
}

export function featureForApiPath(path: string): Feature | null {
  // Smart Lock / TTLock only — not general room/property CRUD
  if (
    path.startsWith("/api/integrations/ttlock") ||
    path.startsWith("/api/ttlock/") ||
    path.startsWith("/api/lwn-rooms/")
  ) {
    // All /api/lwn-rooms/* routes are lock settings / access / remote control
    return "smartLocks";
  }
  if (
    path.startsWith("/api/telegram") ||
    path.startsWith("/api/notifications/payment-reminders")
  ) {
    return "telegram";
  }
  if (path.startsWith("/api/reports/monthly-comparison")) {
    return "aiFinanceOptimization";
  }
  if (
    path === "/api/ai-employees" ||
    path.startsWith("/api/ai-employees/")
  ) {
    return "aiEmployees";
  }
  if (
    path.startsWith("/api/room-comparison") ||
    path.startsWith("/api/ai-inspection")
  ) {
    return "roomComparison";
  }
  if (path === "/api/expenses" || path.startsWith("/api/expenses/")) {
    return "expenses";
  }
  if (path === "/api/tasks" || path.startsWith("/api/tasks/")) {
    return "tasks";
  }
  if (path === "/api/maintenance" || path.startsWith("/api/maintenance/")) {
    return "maintenance";
  }
  return null;
}

export { PLAN_FEATURES, resolveAccessPlan };
export type { AccessPlan, PaidFeature };
