import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  featureForPagePath,
  hasFeature,
  PLAN_FEATURES,
  resolveAccessPlan,
  settingsTabRequiresFeature,
} from "@/lib/plan-features";
import {
  canUseFeature,
  featureForApiPath,
  planEntitlements,
} from "@/lib/api-server/plans";

describe("plan-features: DEMO vs PRO", () => {
  it("maps demo/free/null to DEMO and pro/premium to PRO", () => {
    assert.equal(resolveAccessPlan(null), "DEMO");
    assert.equal(resolveAccessPlan("demo"), "DEMO");
    assert.equal(resolveAccessPlan("FREE"), "DEMO");
    assert.equal(resolveAccessPlan("PRO"), "PRO");
    assert.equal(resolveAccessPlan("PREMIUM"), "PRO");
    assert.equal(resolveAccessPlan("x", { isInternal: true }), "PRO");
  });

  it("hides paid features on DEMO", () => {
    for (const feature of Object.keys(PLAN_FEATURES.DEMO) as Array<
      keyof typeof PLAN_FEATURES.DEMO
    >) {
      assert.equal(hasFeature("DEMO", feature), false);
      assert.equal(hasFeature("demo", feature), false);
      assert.equal(hasFeature(null, feature), false);
    }
  });

  it("enables paid features on PRO", () => {
    for (const feature of Object.keys(PLAN_FEATURES.PRO) as Array<
      keyof typeof PLAN_FEATURES.PRO
    >) {
      assert.equal(hasFeature("PRO", feature), true);
      assert.equal(hasFeature("PREMIUM", feature), true);
    }
  });
});

describe("route protection: only paid pages blocked", () => {
  it("does not treat core rental pages as paid", () => {
    for (const path of [
      "/dashboard",
      "/lwn-rooms",
      "/lwn-rooms/abc",
      "/tenants",
      "/contracts",
      "/payments",
      "/expenses",
      "/tasks",
      "/reports",
      "/settings",
      "/settings?tab=integrations",
      "/properties",
    ]) {
      assert.equal(featureForPagePath(path.split("?")[0]!), null, path);
    }
  });

  it("blocks only AI / comparison paid routes", () => {
    assert.equal(featureForPagePath("/ai-employees"), "aiEmployees");
    assert.equal(featureForPagePath("/ai-employees/x"), "aiEmployees");
    assert.equal(featureForPagePath("/room-comparison"), "roomComparison");
    assert.equal(featureForPagePath("/ai-inspection"), "roomComparison");
  });

  it("never blocks settings tabs wholesale (integrations stays open)", () => {
    assert.equal(settingsTabRequiresFeature("integrations"), null);
    assert.equal(settingsTabRequiresFeature("posting"), null);
    assert.equal(settingsTabRequiresFeature("profile"), null);
    assert.equal(settingsTabRequiresFeature(null), null);
  });
});

describe("planEntitlements: legacy demo must not get Premium", () => {
  const demoCtx = {
    isInternal: false,
    hasAccess: true,
    subscription: {
      plan: "demo",
      status: "DEMO",
    } as never,
  };

  it("DEMO workspace does not receive smartLocks / AI features", () => {
    const ent = planEntitlements(demoCtx);
    assert.equal(ent.accessPlan, "DEMO");
    assert.equal(ent.features.smartLocks, false);
    assert.equal(ent.features.aiFinanceOptimization, false);
    assert.equal(ent.features.aiEmployees, false);
    assert.equal(ent.features.roomComparison, false);
    assert.equal(canUseFeature(demoCtx, "smartLocks"), false);
    assert.equal(canUseFeature(demoCtx, "aiEmployees"), false);
  });

  it("DEMO keeps core rental + free integrations", () => {
    const ent = planEntitlements(demoCtx);
    assert.equal(ent.features.expenses, true);
    assert.equal(ent.features.tasks, true);
    assert.equal(ent.features.maintenance, true);
    assert.equal(ent.features.telegram, true);
    assert.equal(canUseFeature(demoCtx, "telegram"), true);
    assert.equal(canUseFeature(demoCtx, "expenses"), true);
  });

  it("PRO workspace receives paid features", () => {
    const ctx = {
      isInternal: false,
      hasAccess: true,
      subscription: { plan: "PRO", status: "ACTIVE" } as never,
    };
    const ent = planEntitlements(ctx);
    assert.equal(ent.accessPlan, "PRO");
    assert.equal(ent.features.smartLocks, true);
    assert.equal(ent.features.aiFinanceOptimization, true);
    assert.equal(ent.features.aiEmployees, true);
  });
});

describe("featureForApiPath", () => {
  it("maps TTLock / lock-only LWN APIs to smartLocks", () => {
    assert.equal(
      featureForApiPath("/api/ttlock/bluetooth-sync/session"),
      "smartLocks"
    );
    assert.equal(
      featureForApiPath("/api/integrations/ttlock/connect"),
      "smartLocks"
    );
    assert.equal(
      featureForApiPath("/api/lwn-rooms/prop-1/lock-settings"),
      "smartLocks"
    );
    assert.equal(
      featureForApiPath("/api/lwn-rooms/prop-1/access-grants"),
      "smartLocks"
    );
  });

  it("maps AI / comparison APIs to paid features", () => {
    assert.equal(featureForApiPath("/api/ai-employees"), "aiEmployees");
    assert.equal(
      featureForApiPath("/api/reports/monthly-comparison"),
      "aiFinanceOptimization"
    );
    assert.equal(
      featureForApiPath("/api/room-comparison/run"),
      "roomComparison"
    );
  });

  it("does not gate core room/property/tenant CRUD as smartLocks", () => {
    for (const path of [
      "/api/properties",
      "/api/properties/abc",
      "/api/tenants",
      "/api/contracts",
      "/api/payments",
      "/api/expenses",
      "/api/tasks",
      "/api/reports",
      "/api/subscription",
    ]) {
      assert.notEqual(featureForApiPath(path), "smartLocks", path);
    }
    // expenses/tasks are catalog features available on DEMO — mapped but allowed
    assert.equal(featureForApiPath("/api/expenses"), "expenses");
    assert.equal(featureForApiPath("/api/tasks"), "tasks");
    assert.equal(featureForApiPath("/api/properties"), null);
    assert.equal(featureForApiPath("/api/tenants"), null);
    assert.equal(featureForApiPath("/api/contracts"), null);
  });

  it("DEMO assert path: paid APIs denied, core APIs allowed", () => {
    const demoCtx = {
      isInternal: false,
      hasAccess: true,
      subscription: { plan: "demo", status: "DEMO" } as never,
    };
    const paidPaths = [
      "/api/ttlock/bluetooth-sync/session",
      "/api/lwn-rooms/x/lock-settings",
      "/api/ai-employees",
      "/api/reports/monthly-comparison",
    ];
    for (const path of paidPaths) {
      const feature = featureForApiPath(path);
      assert.ok(feature, path);
      assert.equal(canUseFeature(demoCtx, feature!), false, path);
    }
    for (const path of [
      "/api/properties",
      "/api/tenants",
      "/api/contracts",
      "/api/expenses",
      "/api/tasks",
      "/api/telegram",
    ]) {
      const feature = featureForApiPath(path);
      if (feature) {
        assert.equal(canUseFeature(demoCtx, feature), true, path);
      }
    }
  });
});
