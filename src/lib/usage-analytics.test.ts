import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACTIVITY_ACTIONS,
  computeUsageAnalytics,
  dataFeaturesFor,
  eligibleUsageFeatures,
  industryUsageFeatures,
  normalizePercentages,
  parseUsagePeriod,
  periodLabel,
  usagePeriodDays,
  usagePeriodStart,
  usageSubtitle,
  WORK_SHARE_LABELS,
  type ActivityGroupRow,
  type UsagePlanFeature,
} from "@/lib/usage-analytics";

const allPlan = () => true;
const row = (actionType: keyof typeof ACTIVITY_ACTIONS, count: number): ActivityGroupRow => ({
  actionType,
  actorType: ACTIVITY_ACTIONS[actionType].actor,
  featureKey: ACTIVITY_ACTIONS[actionType].feature,
  count,
});
const compute = (
  industry: string,
  rows: ActivityGroupRow[],
  isPlanAvailable: (f: UsagePlanFeature) => boolean = allPlan,
  dataFeatureKeys: string[] = []
) =>
  computeUsageAnalytics({
    period: "30d",
    industry,
    rows,
    eventFeatureKeys: rows.map((r) => r.featureKey),
    dataFeatureKeys,
    isPlanAvailable,
  });

describe("usage analytics: periods", () => {
  it("accepts only 7d / 30d / 90d, defaults to 30d", () => {
    assert.equal(parseUsagePeriod(null), "30d");
    assert.equal(parseUsagePeriod(""), "30d");
    assert.equal(parseUsagePeriod("7d"), "7d");
    assert.equal(parseUsagePeriod("90d"), "90d");
    assert.equal(parseUsagePeriod("365d"), null);
    assert.equal(parseUsagePeriod("2026-01-01"), null);
  });

  for (const [period, days] of [["7d", 7], ["30d", 30], ["90d", 90]] as const) {
    it(`${period} window starts exactly ${days} days back`, () => {
      const now = new Date("2026-10-06T12:00:00Z");
      assert.equal(usagePeriodDays(period), days);
      assert.equal(now.getTime() - usagePeriodStart(period, now).getTime(), days * 86_400_000);
      assert.equal(
        computeUsageAnalytics({
          period,
          industry: "OFFICE_RENTAL",
          rows: [],
          eventFeatureKeys: [],
          dataFeatureKeys: [],
          isPlanAvailable: allPlan,
        }).periodDays,
        days
      );
    });
  }
});

describe("usage analytics: work share", () => {
  it("zero events: no 0/0, all zero, collecting", () => {
    const res = compute("HOTEL_HOSTEL", []);
    assert.equal(res.collecting, true);
    assert.equal(res.workShare.total, 0);
    for (const k of ["human", "ai", "automation"] as const) {
      assert.deepEqual(res.workShare[k], { count: 0, percentage: 0 });
    }
    assert.equal(res.platformUsage.percentage, 0);
    assert.equal(res.breakdown.length, 0);
  });

  it("human / AI / automation percentages come from real counts and sum to 100", () => {
    const res = compute("OFFICE_RENTAL", [
      row("PAYMENT_CREATE", 5),
      row("TENANT_CREATE", 1),
      row("AI_CUSTOMER_RESPONSE", 2),
      row("DEBT_REMINDER_SENT", 1),
    ]);
    assert.equal(res.workShare.human.count, 6);
    assert.equal(res.workShare.ai.count, 2);
    assert.equal(res.workShare.automation.count, 1);
    assert.equal(res.workShare.human.percentage, 67);
    assert.equal(res.workShare.ai.percentage, 22);
    assert.equal(res.workShare.automation.percentage, 11);
    assert.equal(res.workShare.human.percentage + res.workShare.ai.percentage + res.workShare.automation.percentage, 100);
  });

  it("largest-remainder rounding always sums to 100", () => {
    for (const counts of [[1, 1, 1], [2, 1, 0], [7, 3, 3], [1, 0, 0], [999, 1, 1], [0, 0, 5]]) {
      const pct = normalizePercentages(counts);
      assert.equal(pct.reduce((a, b) => a + b, 0), 100, `counts=${counts}`);
    }
    assert.deepEqual(normalizePercentages([0, 0, 0]), [0, 0, 0]);
  });

  it("automation never lands in the AI bucket", () => {
    const res = compute("OFFICE_RENTAL", [row("DEBT_REMINDER_SENT", 4), row("SCHEDULED_REPORT_SENT", 1)]);
    assert.equal(res.workShare.ai.count, 0);
    assert.equal(res.workShare.automation.count, 5);
    assert.equal(res.workShare.automation.percentage, 100);
  });

  it("report views count for adoption but never as work", () => {
    const res = compute("OFFICE_RENTAL", [row("REPORT_VIEW", 3)]);
    assert.equal(res.workShare.total, 0);
    assert.equal(res.features.find((f) => f.key === "reports")?.used, true);
    assert.equal(res.breakdown.length, 0);
  });

  it("every action has exactly one actor; AI actions are only real AI emitters", () => {
    const ai = Object.entries(ACTIVITY_ACTIONS).filter(([, d]) => d.actor === "AI").map(([k]) => k).sort();
    assert.deepEqual(ai, [
      "AI_CUSTOMER_RESPONSE",
      "AI_EMPLOYEE_ACTION",
      "AI_FINANCE_ANALYSIS",
      "AI_RECOMMENDATION",
      "AI_REPORT_GENERATION",
    ]);
    assert.equal(ACTIVITY_ACTIONS.DEBT_REMINDER_SENT.actor, "AUTOMATION");
    assert.equal(ACTIVITY_ACTIONS.SCHEDULED_REPORT_SENT.actor, "AUTOMATION");
  });
});

describe("usage analytics: feature adoption", () => {
  it("used feature is counted once regardless of event volume", () => {
    const res = compute("OFFICE_RENTAL", [row("PAYMENT_CREATE", 40), row("CONTRACT_CREATE", 1), row("CONTRACT_UPDATE", 9)]);
    assert.equal(res.platformUsage.usedFeatures, 2);
    assert.equal(res.platformUsage.eligibleFeatures, 8);
    assert.equal(res.platformUsage.percentage, 25);
    assert.equal(res.features.find((f) => f.key === "payments")?.source, "events");
  });

  it("old real records count as used with zero events (all-time adoption)", () => {
    const res = compute("OFFICE_RENTAL", [], allPlan, ["properties", "tenants", "contracts", "payments"]);
    assert.equal(res.platformUsage.scope, "ALL_TIME");
    assert.equal(res.platformUsage.usedFeatures, 4);
    assert.equal(res.platformUsage.percentage, 50);
    assert.equal(res.collecting, false);
    assert.equal(res.workShare.total, 0);
    for (const key of ["properties", "tenants", "contracts", "payments"]) {
      assert.equal(res.features.find((f) => f.key === key)?.source, "data", key);
    }
  });

  it("an event with no current row still counts as used", () => {
    const res = computeUsageAnalytics({
      period: "7d",
      industry: "OFFICE_RENTAL",
      rows: [],
      eventFeatureKeys: ["expenses"],
      dataFeatureKeys: [],
      isPlanAvailable: allPlan,
    });
    assert.equal(res.features.find((f) => f.key === "expenses")?.used, true);
    assert.equal(res.platformUsage.usedFeatures, 1);
  });

  it("reports are used only via events, never from data keys", () => {
    const res = compute("OFFICE_RENTAL", [], allPlan, ["properties"]);
    assert.equal(res.features.find((f) => f.key === "reports")?.used, false);
  });

  it("event + data on the same feature is counted once with source 'both'", () => {
    const res = compute("OFFICE_RENTAL", [row("PAYMENT_CREATE", 2)], allPlan, ["payments"]);
    assert.equal(res.platformUsage.usedFeatures, 1);
    assert.equal(res.features.find((f) => f.key === "payments")?.source, "both");
  });

  it("period selector changes actor counts but never platform usage %", () => {
    const allTime = { eventFeatureKeys: ["payments", "ai_customer_chat"], dataFeatureKeys: ["properties", "tenants"] };
    const byPeriod = {
      "7d": [row("PAYMENT_CREATE", 1)],
      "30d": [row("PAYMENT_CREATE", 4), row("AI_CUSTOMER_RESPONSE", 2)],
      "90d": [row("PAYMENT_CREATE", 9), row("AI_CUSTOMER_RESPONSE", 5), row("DEBT_REMINDER_SENT", 3)],
    } as const;
    const results = (["7d", "30d", "90d"] as const).map((period) =>
      computeUsageAnalytics({ period, industry: "OFFICE_RENTAL", rows: [...byPeriod[period]], ...allTime, isPlanAvailable: allPlan })
    );
    assert.deepEqual(results.map((r) => r.platformUsage), Array(3).fill({ scope: "ALL_TIME", usedFeatures: 3, eligibleFeatures: 8, percentage: 38 }));
    assert.deepEqual(results.map((r) => [r.workShare.human.count, r.workShare.ai.count, r.workShare.automation.count]), [
      [1, 0, 0],
      [4, 2, 0],
      [9, 5, 3],
    ]);
  });

  it("dataFeaturesFor queries only DB-detectable keys of the industry", () => {
    assert.deepEqual(dataFeaturesFor("OFFICE_RENTAL", allPlan), [
      "properties", "tenants", "contracts", "payments", "debts", "expenses", "tasks",
    ]);
    assert.deepEqual(dataFeaturesFor("HOTEL_HOSTEL", allPlan), [
      "properties", "tenants", "bookings", "payments", "debts", "expenses", "tasks",
    ]);
    assert.deepEqual(dataFeaturesFor("CAR_RENTAL", allPlan), [
      "tenants", "contracts", "vehicles", "vehicle_rentals", "payments", "expenses", "tasks",
    ]);
    assert.ok(!dataFeaturesFor("OFFICE_RENTAL", (f) => f !== "tasks").includes("tasks"));
  });

  it("plan-disabled features leave the denominator", () => {
    const noTasks = (f: UsagePlanFeature) => f !== "tasks";
    const res = compute("OFFICE_RENTAL", [row("PAYMENT_CREATE", 1)], noTasks);
    assert.equal(res.platformUsage.eligibleFeatures, 7);
    assert.ok(!res.features.some((f) => f.key === "tasks"));
    assert.equal(res.platformUsage.percentage, 14);
  });

  it("coming-soon features leave the denominator", () => {
    const features = [...industryUsageFeatures("OFFICE_RENTAL"), { key: "x", label: "X", featureKeys: [], comingSoon: true }];
    assert.equal(eligibleUsageFeatures(features, allPlan).length, 8);
  });

  it("HOTEL config: rooms, guests, bookings, payments, debts, expenses, reports, tasks", () => {
    const res = compute("HOTEL_HOSTEL", [row("BOOKING_CREATE", 1), row("TENANT_CREATE", 1)]);
    assert.deepEqual(res.features.map((f) => f.label), [
      "Xonalar", "Mehmonlar", "Bronlar", "To‘lovlar", "Qarzdorlik", "Xarajatlar", "Hisobotlar", "Vazifalar",
    ]);
    assert.ok(!res.features.some((f) => f.key === "contracts"));
    assert.equal(res.platformUsage.usedFeatures, 2);
  });

  it("CAR config: vehicles, customers, rentals (incl. contracts), payments, expenses, reports, tasks", () => {
    const res = compute("CAR_RENTAL", [row("CONTRACT_CREATE", 1), row("VEHICLE_CREATE", 2)]);
    assert.deepEqual(res.features.map((f) => f.key), [
      "vehicles", "tenants", "vehicle_rentals", "payments", "expenses", "reports", "tasks",
    ]);
    assert.equal(res.features.find((f) => f.key === "vehicle_rentals")?.used, true);
    assert.ok(!res.features.some((f) => f.key === "properties" || f.key === "debts"));
    assert.equal(res.platformUsage.usedFeatures, 2);
    assert.equal(res.platformUsage.eligibleFeatures, 7);
  });

  it("OFFICE config: rooms, tenants, contracts, payments, debts, expenses, tasks, reports", () => {
    const res = compute("OFFICE_RENTAL", []);
    assert.deepEqual(res.features.map((f) => f.key), [
      "properties", "tenants", "contracts", "payments", "debts", "expenses", "tasks", "reports",
    ]);
    assert.ok(res.features.every((f) => !f.used));
  });

  it("unknown industry falls back to the generic lease config", () => {
    assert.deepEqual(industryUsageFeatures("HACKED"), industryUsageFeatures("OTHER"));
  });

  it("breakdown groups per feature with per-actor counts", () => {
    const res = compute("OFFICE_RENTAL", [
      row("PAYMENT_CREATE", 3),
      row("AI_CUSTOMER_RESPONSE", 2),
      row("DEBT_REMINDER_SENT", 1),
      row("MANUAL_DEBT_CREATE", 1),
    ]);
    const byKey = Object.fromEntries(res.breakdown.map((b) => [b.featureKey, b]));
    assert.deepEqual(
      { h: byKey.payments.human, a: byKey.payments.ai, m: byKey.payments.automation },
      { h: 3, a: 0, m: 0 }
    );
    assert.equal(byKey.ai_customer_chat.ai, 2);
    assert.equal(byKey.reminders.automation, 1);
    assert.equal(byKey.debts.human, 1);
  });
});

describe("usage analytics: labels", () => {
  it("work share labels and subtitle", () => {
    assert.deepEqual(WORK_SHARE_LABELS, { human: "👤 Odam", ai: "🤖 AI", automation: "⚙️ Avtomatika" });
    assert.equal(
      usageSubtitle({ platformUsage: { scope: "ALL_TIME", usedFeatures: 6, eligibleFeatures: 8, percentage: 75 } }),
      "Barcha vaqt bo‘yicha 8 ta asosiy funksiyadan 6 tasi ishlatilgan"
    );
    assert.equal(periodLabel(30), "Oxirgi 30 kun");
  });
});
