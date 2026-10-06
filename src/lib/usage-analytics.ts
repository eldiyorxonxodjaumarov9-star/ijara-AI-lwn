/**
 * Platform usage + work-share analytics. Client and server safe (no Prisma).
 *
 * actorType is always derived from actionType via ACTIVITY_ACTIONS, so a
 * caller can never pick it. Only actions listed here are recordable.
 */
import { isRentalIndustry, type RentalIndustry } from "@/lib/rental-industry";

export type ActivityActor = "HUMAN" | "AI" | "AUTOMATION";

export type ActivityFeatureKey =
  | "properties"
  | "tenants"
  | "contracts"
  | "bookings"
  | "vehicles"
  | "vehicle_rentals"
  | "payments"
  | "debts"
  | "expenses"
  | "tasks"
  | "reports"
  | "ai_customer_chat"
  | "ai_agent"
  | "reminders"
  | "scheduled_reports";

type ActionDef = {
  actor: ActivityActor;
  feature: ActivityFeatureKey;
  /** false = adoption signal only (e.g. viewing a report), never counted as work. */
  work: boolean;
};

export const ACTIVITY_ACTIONS = {
  PROPERTY_CREATE: { actor: "HUMAN", feature: "properties", work: true },
  PROPERTY_UPDATE: { actor: "HUMAN", feature: "properties", work: true },
  TENANT_CREATE: { actor: "HUMAN", feature: "tenants", work: true },
  TENANT_UPDATE: { actor: "HUMAN", feature: "tenants", work: true },
  TENANT_CHECKOUT: { actor: "HUMAN", feature: "tenants", work: true },
  CONTRACT_CREATE: { actor: "HUMAN", feature: "contracts", work: true },
  CONTRACT_UPDATE: { actor: "HUMAN", feature: "contracts", work: true },
  BOOKING_CREATE: { actor: "HUMAN", feature: "bookings", work: true },
  BOOKING_ARRIVAL: { actor: "HUMAN", feature: "bookings", work: true },
  BOOKING_NO_SHOW: { actor: "HUMAN", feature: "bookings", work: true },
  BOOKING_CHECKOUT: { actor: "HUMAN", feature: "bookings", work: true },
  VEHICLE_CREATE: { actor: "HUMAN", feature: "vehicles", work: true },
  VEHICLE_RENTAL_CREATE: { actor: "HUMAN", feature: "vehicle_rentals", work: true },
  PAYMENT_CREATE: { actor: "HUMAN", feature: "payments", work: true },
  SOURCE_PAYMENT_CREATE: { actor: "HUMAN", feature: "payments", work: true },
  MANUAL_DEBT_CREATE: { actor: "HUMAN", feature: "debts", work: true },
  DEBT_PAYMENT: { actor: "HUMAN", feature: "debts", work: true },
  DEBT_WRITE_OFF: { actor: "HUMAN", feature: "debts", work: true },
  EXPENSE_CREATE: { actor: "HUMAN", feature: "expenses", work: true },
  TASK_CREATE: { actor: "HUMAN", feature: "tasks", work: true },
  TASK_COMPLETE: { actor: "HUMAN", feature: "tasks", work: true },
  REPORT_VIEW: { actor: "HUMAN", feature: "reports", work: false },

  AI_CUSTOMER_RESPONSE: { actor: "AI", feature: "ai_customer_chat", work: true },
  AI_REPORT_GENERATION: { actor: "AI", feature: "ai_agent", work: true },
  AI_FINANCE_ANALYSIS: { actor: "AI", feature: "ai_agent", work: true },
  AI_RECOMMENDATION: { actor: "AI", feature: "ai_agent", work: true },
  AI_EMPLOYEE_ACTION: { actor: "AI", feature: "ai_agent", work: true },

  DEBT_REMINDER_SENT: { actor: "AUTOMATION", feature: "reminders", work: true },
  SCHEDULED_REPORT_SENT: { actor: "AUTOMATION", feature: "scheduled_reports", work: true },
} as const satisfies Record<string, ActionDef>;

export type ActivityAction = keyof typeof ACTIVITY_ACTIONS;

export function actionDef(action: string): ActionDef | null {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_ACTIONS, action)
    ? ACTIVITY_ACTIONS[action as ActivityAction]
    : null;
}

export const FEATURE_LABELS: Record<ActivityFeatureKey, string> = {
  properties: "Xonalar",
  tenants: "Ijarachilar",
  contracts: "Shartnomalar",
  bookings: "Bronlar",
  vehicles: "Avtomobillar",
  vehicle_rentals: "Ijaralar",
  payments: "To‘lovlar",
  debts: "Qarzdorlik",
  expenses: "Xarajatlar",
  tasks: "Vazifalar",
  reports: "Hisobotlar",
  ai_customer_chat: "AI mijoz yozishmalari",
  ai_agent: "AI agent",
  reminders: "To‘lov eslatmalari",
  scheduled_reports: "Rejali hisobotlar",
};

// ─── Period ────────────────────────────────────────────────────────────────

export const USAGE_PERIODS = ["7d", "30d", "90d"] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];
export const DEFAULT_USAGE_PERIOD: UsagePeriod = "30d";

const PERIOD_DAYS: Record<UsagePeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** null/empty → default; anything outside the enum → null (caller rejects). */
export function parseUsagePeriod(value: string | null | undefined): UsagePeriod | null {
  if (value == null || value === "") return DEFAULT_USAGE_PERIOD;
  return (USAGE_PERIODS as readonly string[]).includes(value) ? (value as UsagePeriod) : null;
}

export function usagePeriodDays(period: UsagePeriod) {
  return PERIOD_DAYS[period];
}

export function usagePeriodStart(period: UsagePeriod, now: Date = new Date()) {
  return new Date(now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000);
}

// ─── Industry feature configs ──────────────────────────────────────────────

/** Plan catalog flags a feature may depend on (see api-server/plans.ts). */
export type UsagePlanFeature = "expenses" | "tasks" | "advancedReports";

export type AdoptionFeatureDef = {
  key: string;
  label: string;
  /** Any successful event in one of these feature keys marks the feature used. */
  featureKeys: ActivityFeatureKey[];
  planFeature?: UsagePlanFeature;
  comingSoon?: boolean;
};

function f(
  key: ActivityFeatureKey,
  label: string = FEATURE_LABELS[key],
  extra: Partial<AdoptionFeatureDef> = {}
): AdoptionFeatureDef {
  return { key, label, featureKeys: [key], ...extra };
}

const EXPENSES = f("expenses", undefined, { planFeature: "expenses" });
const TASKS = f("tasks", undefined, { planFeature: "tasks" });
const REPORTS = f("reports");
const PAYMENTS = f("payments");
const DEBTS = f("debts");

function leaseConfig(unitLabel: string, tenantLabel = "Ijarachilar"): AdoptionFeatureDef[] {
  return [
    f("properties", unitLabel),
    f("tenants", tenantLabel),
    f("contracts"),
    PAYMENTS,
    DEBTS,
    EXPENSES,
    TASKS,
    REPORTS,
  ];
}

function bookingConfig(unitLabel: string, guestLabel: string): AdoptionFeatureDef[] {
  return [
    f("properties", unitLabel),
    f("tenants", guestLabel),
    f("bookings"),
    PAYMENTS,
    DEBTS,
    EXPENSES,
    REPORTS,
    TASKS,
  ];
}

export const INDUSTRY_USAGE_FEATURES: Record<RentalIndustry, AdoptionFeatureDef[]> = {
  HOTEL_HOSTEL: bookingConfig("Xonalar", "Mehmonlar"),
  VILLA_RENTAL: bookingConfig("Dacha / Villalar", "Mijozlar"),
  CAR_RENTAL: [
    f("vehicles"),
    f("tenants", "Mijozlar"),
    // CAR_RENTAL labels /contracts as "Ijaralar", so both stores count as rentals.
    { key: "vehicle_rentals", label: "Ijaralar", featureKeys: ["vehicle_rentals", "contracts"] },
    PAYMENTS,
    EXPENSES,
    REPORTS,
    TASKS,
  ],
  OFFICE_RENTAL: leaseConfig("Xonalar"),
  APARTMENT_RENTAL: leaseConfig("Obyektlar"),
  RETAIL_RENTAL: leaseConfig("Savdo joylari"),
  WAREHOUSE_RENTAL: leaseConfig("Omborlar"),
  COMMERCIAL_RENTAL: leaseConfig("Obyektlar"),
  OTHER: leaseConfig("Xonalar"),
};

export function industryUsageFeatures(industry: unknown): AdoptionFeatureDef[] {
  return INDUSTRY_USAGE_FEATURES[isRentalIndustry(industry) ? industry : "OTHER"];
}

/** Coming-soon and plan-unavailable features never enter the denominator. */
export function eligibleUsageFeatures(
  features: AdoptionFeatureDef[],
  isPlanAvailable: (feature: UsagePlanFeature) => boolean
) {
  return features.filter(
    (feature) => !feature.comingSoon && (!feature.planFeature || isPlanAvailable(feature.planFeature))
  );
}

// ─── Aggregation ───────────────────────────────────────────────────────────

export type ActivityGroupRow = {
  actionType: string;
  actorType: ActivityActor;
  featureKey: string;
  count: number;
};

export type ShareBucket = { count: number; percentage: number };

export type UsageAnalytics = {
  period: UsagePeriod;
  periodDays: number;
  collecting: boolean;
  platformUsage: { usedFeatures: number; eligibleFeatures: number; percentage: number };
  workShare: {
    total: number;
    human: ShareBucket;
    ai: ShareBucket;
    automation: ShareBucket;
  };
  features: { key: string; label: string; used: boolean; count: number }[];
  breakdown: {
    featureKey: string;
    label: string;
    human: number;
    ai: number;
    automation: number;
    total: number;
  }[];
};

/**
 * Largest-remainder rounding: integer percentages that always sum to exactly
 * 100 when total > 0, and are all 0 when total is 0 (never 0/0).
 */
export function normalizePercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, n) => sum + Math.max(0, n), 0);
  if (total <= 0) return counts.map(() => 0);
  const raw = counts.map((n) => (Math.max(0, n) / total) * 100);
  const floors = raw.map(Math.floor);
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const { index } of order) {
    if (remaining <= 0) break;
    floors[index] += 1;
    remaining -= 1;
  }
  return floors;
}

export function usagePercentage(used: number, eligible: number) {
  if (eligible <= 0) return 0;
  return Math.round((Math.min(used, eligible) / eligible) * 100);
}

function featureLabel(key: string, eligible: AdoptionFeatureDef[]) {
  const own = eligible.find((feature) => feature.featureKeys.length === 1 && feature.key === key);
  if (own) return own.label;
  return (FEATURE_LABELS as Record<string, string>)[key] ?? key;
}

export function computeUsageAnalytics(input: {
  period: UsagePeriod;
  industry: unknown;
  rows: ActivityGroupRow[];
  isPlanAvailable: (feature: UsagePlanFeature) => boolean;
}): UsageAnalytics {
  const eligible = eligibleUsageFeatures(industryUsageFeatures(input.industry), input.isPlanAvailable);

  const byFeatureKey = new Map<string, number>();
  const breakdown = new Map<string, { human: number; ai: number; automation: number }>();
  let human = 0;
  let ai = 0;
  let automation = 0;

  for (const row of input.rows) {
    const count = Math.max(0, Math.trunc(row.count));
    if (count === 0) continue;
    byFeatureKey.set(row.featureKey, (byFeatureKey.get(row.featureKey) ?? 0) + count);

    const def = actionDef(row.actionType);
    if (def && !def.work) continue;
    const bucket = breakdown.get(row.featureKey) ?? { human: 0, ai: 0, automation: 0 };
    if (row.actorType === "HUMAN") {
      human += count;
      bucket.human += count;
    } else if (row.actorType === "AI") {
      ai += count;
      bucket.ai += count;
    } else if (row.actorType === "AUTOMATION") {
      automation += count;
      bucket.automation += count;
    } else {
      continue;
    }
    breakdown.set(row.featureKey, bucket);
  }

  const features = eligible.map((feature) => {
    const count = feature.featureKeys.reduce((sum, key) => sum + (byFeatureKey.get(key) ?? 0), 0);
    return { key: feature.key, label: feature.label, used: count > 0, count };
  });
  const usedFeatures = features.filter((feature) => feature.used).length;

  const total = human + ai + automation;
  const [humanPct, aiPct, automationPct] = normalizePercentages([human, ai, automation]);

  return {
    period: input.period,
    periodDays: usagePeriodDays(input.period),
    collecting: total === 0 && usedFeatures === 0,
    platformUsage: {
      usedFeatures,
      eligibleFeatures: eligible.length,
      percentage: usagePercentage(usedFeatures, eligible.length),
    },
    workShare: {
      total,
      human: { count: human, percentage: humanPct },
      ai: { count: ai, percentage: aiPct },
      automation: { count: automation, percentage: automationPct },
    },
    features,
    breakdown: [...breakdown.entries()]
      .map(([featureKey, b]) => ({
        featureKey,
        label: featureLabel(featureKey, eligible),
        ...b,
        total: b.human + b.ai + b.automation,
      }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
  };
}

export const WORK_SHARE_LABELS = {
  human: "👤 Odam",
  ai: "🤖 AI",
  automation: "⚙️ Avtomatika",
} as const;

export function usageSubtitle(data: Pick<UsageAnalytics, "periodDays" | "platformUsage">) {
  const { usedFeatures, eligibleFeatures } = data.platformUsage;
  return `Oxirgi ${data.periodDays} kunda ${eligibleFeatures} ta asosiy funksiyadan ${usedFeatures} tasi ishlatilgan`;
}
