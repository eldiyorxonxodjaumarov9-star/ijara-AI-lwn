import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateSubscriptionAccess,
  getDemoTrialDays,
  isInternalUser,
  isRecordInWorkspace,
} from "@/lib/api-server/workspace";

describe("workspace subscription access", () => {
  it("internal always has access", () => {
    const r = evaluateSubscriptionAccess({
      isInternal: true,
      subscription: null,
    });
    assert.equal(r.hasAccess, true);
    assert.equal(r.accessReason, "internal");
  });

  it("ACTIVE has access", () => {
    const r = evaluateSubscriptionAccess({
      isInternal: false,
      subscription: {
        id: "1",
        workspaceId: "w",
        status: "ACTIVE",
        plan: "pro",
        startedAt: new Date(),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        demoStartedAt: null,
        demoEndsAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    assert.equal(r.hasAccess, true);
    assert.equal(r.accessReason, "active");
  });

  it("DEMO active before end", () => {
    const ends = new Date(Date.now() + 86400000);
    const r = evaluateSubscriptionAccess({
      isInternal: false,
      subscription: {
        id: "1",
        workspaceId: "w",
        status: "DEMO",
        plan: "demo",
        startedAt: new Date(),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        demoStartedAt: new Date(),
        demoEndsAt: ends,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    assert.equal(r.hasAccess, true);
    assert.equal(r.accessReason, "demo");
  });

  it("DEMO expired blocks", () => {
    const ends = new Date(Date.now() - 86400000);
    const r = evaluateSubscriptionAccess({
      isInternal: false,
      subscription: {
        id: "1",
        workspaceId: "w",
        status: "DEMO",
        plan: "demo",
        startedAt: new Date(),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        demoStartedAt: new Date(),
        demoEndsAt: ends,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    assert.equal(r.hasAccess, false);
    assert.equal(r.accessReason, "demo_expired");
  });

  it("PAST_DUE and CANCELED block", () => {
    assert.equal(
      evaluateSubscriptionAccess({
        isInternal: false,
        subscription: {
          id: "1",
          workspaceId: "w",
          status: "PAST_DUE",
          plan: null,
          startedAt: new Date(),
          currentPeriodStart: null,
          currentPeriodEnd: null,
          demoStartedAt: null,
          demoEndsAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }).accessReason,
      "past_due"
    );
    assert.equal(
      evaluateSubscriptionAccess({
        isInternal: false,
        subscription: {
          id: "1",
          workspaceId: "w",
          status: "CANCELED",
          plan: null,
          startedAt: new Date(),
          currentPeriodStart: null,
          currentPeriodEnd: null,
          demoStartedAt: null,
          demoEndsAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }).accessReason,
      "canceled"
    );
  });
});

describe("workspace IDOR guard", () => {
  it("rejects null workspaceId and foreign workspace", () => {
    assert.equal(isRecordInWorkspace(null, "w1"), false);
    assert.equal(isRecordInWorkspace({ workspaceId: null }, "w1"), false);
    assert.equal(isRecordInWorkspace({ workspaceId: "w2" }, "w1"), false);
    assert.equal(isRecordInWorkspace({ workspaceId: "w1" }, "w1"), true);
  });
});

describe("internal user detection", () => {
  it("flags SUPER_ADMIN and isInternalAccount", () => {
    assert.equal(
      isInternalUser({
        role: "SUPER_ADMIN",
        isInternalAccount: false,
        email: "a@x.uz",
      }),
      true
    );
    assert.equal(
      isInternalUser({
        role: "ADMIN",
        isInternalAccount: true,
        email: "a@x.uz",
      }),
      true
    );
    assert.equal(
      isInternalUser({
        role: "ADMIN",
        isInternalAccount: false,
        email: "a@x.uz",
      }),
      false
    );
  });
});

describe("demo trial days config", () => {
  it("defaults to 14 and clamps invalid", () => {
    const prev = process.env.DEMO_TRIAL_DAYS;
    delete process.env.DEMO_TRIAL_DAYS;
    assert.equal(getDemoTrialDays(), 14);
    process.env.DEMO_TRIAL_DAYS = "30";
    assert.equal(getDemoTrialDays(), 30);
    process.env.DEMO_TRIAL_DAYS = "0";
    assert.equal(getDemoTrialDays(), 14);
    if (prev === undefined) delete process.env.DEMO_TRIAL_DAYS;
    else process.env.DEMO_TRIAL_DAYS = prev;
  });
});
