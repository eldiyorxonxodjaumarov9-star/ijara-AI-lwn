import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAccessEffectiveStatus } from "./access-effective";
import {
  isTtlockSyncStatusActive,
  mapTtlockSyncStatusLabel,
  TTLOCK_SYNC_STATUS_LABELS,
} from "@/lib/ttlock-access-view";

describe("TTLock sync status labels (QA-015/026)", () => {
  it("maps explicit Uzbek labels — SENT is not ACTIVE", () => {
    assert.equal(mapTtlockSyncStatusLabel("PLANNED"), "Reja saqlandi");
    assert.equal(mapTtlockSyncStatusLabel("SENT"), "API'ga yuborilgan");
    assert.equal(mapTtlockSyncStatusLabel("ACTIVE"), "Qurilmada faol");
    assert.equal(isTtlockSyncStatusActive("SENT"), false);
    assert.equal(isTtlockSyncStatusActive("ACTIVE"), true);
  });

  it("effective status: SENT never becomes FAOL", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const effective = resolveAccessEffectiveStatus({
      grantStatus: "PLANNED",
      validFrom: new Date("2026-05-01T00:00:00Z"),
      validTo: new Date("2026-12-01T00:00:00Z"),
      syncStatus: "SENT",
      hasCredential: true,
      now,
    });
    assert.equal(effective, "API_YUBORILGAN");
    assert.notEqual(effective, "FAOL");
  });

  it("effective status: only ACTIVE in window is FAOL", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom: new Date("2026-05-01T00:00:00Z"),
        validTo: new Date("2026-12-01T00:00:00Z"),
        syncStatus: "ACTIVE",
        hasCredential: true,
        now,
      }),
      "FAOL"
    );
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom: new Date("2026-07-01T00:00:00Z"),
        validTo: new Date("2026-12-01T00:00:00Z"),
        syncStatus: "ACTIVE",
        hasCredential: true,
        now,
      }),
      "API_YUBORILGAN"
    );
  });

  it("PLANNED stays rejalashtirilgan", () => {
    assert.equal(
      TTLOCK_SYNC_STATUS_LABELS.PLANNED,
      mapTtlockSyncStatusLabel("PLANNED")
    );
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom: null,
        validTo: null,
        syncStatus: "PLANNED",
        hasCredential: false,
      }),
      "REJALASHTIRILGAN"
    );
  });
});
