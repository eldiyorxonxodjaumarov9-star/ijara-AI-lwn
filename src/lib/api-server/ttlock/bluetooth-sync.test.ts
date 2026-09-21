import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/api-server/prisma";

import {
  accessWindowsOverlap,
  generateRandomKeyboardPin,
  supportsBluetoothTimedPin,
  recordBluetoothSyncResult,
  deliverBluetoothCredential,
  validateBluetoothResult,
} from "./bluetooth-sync";
import { resolveAccessEffectiveStatus } from "./access-effective";

describe("TTLock Bluetooth timed PIN capability", () => {
  it("requires V4 passcode capability", () => {
    assert.equal(
      supportsBluetoothTimedPin({ model: "D10", capabilities: {}, rawSafe: {} }),
      false
    );
    assert.equal(
      supportsBluetoothTimedPin({
        model: "D10",
        capabilities: { keyboardPwdVersion: 4 },
        rawSafe: {},
      }),
      true
    );
  });

  it("detects overlapping windows with half-open boundaries", () => {
    const start = new Date("2026-09-20T09:00:00Z");
    const end = new Date("2026-09-25T07:00:00Z");
    assert.equal(
      accessWindowsOverlap(
        { start, end },
        { start: new Date("2026-09-25T07:01:00Z"), end: new Date("2026-09-30T07:00:00Z") }
      ),
      false
    );
    assert.equal(
      accessWindowsOverlap(
        { start, end },
        { start: new Date("2026-09-25T06:59:00Z"), end: new Date("2026-09-30T07:00:00Z") }
      ),
      true
    );
  });

  it("generates non-predictable 6-digit PINs", () => {
    const values = new Set(Array.from({ length: 20 }, () => generateRandomKeyboardPin()));
    assert.ok([...values].every((value) => /^\d{6}$/.test(value)));
  });

  it("only exposes Bluetooth-installed credentials as active in-window", () => {
    const validFrom = new Date("2026-09-20T09:00:00Z");
    const validTo = new Date("2026-09-25T07:00:00Z");
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom,
        validTo,
        syncStatus: "READY_FOR_BLUETOOTH",
        hasCredential: true,
        now: new Date("2026-09-20T08:59:00Z"),
      }),
      "REJALASHTIRILGAN"
    );
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom,
        validTo,
        syncStatus: "INSTALLED_ON_LOCK",
        hasCredential: true,
        now: new Date("2026-09-20T09:01:00Z"),
      }),
      "FAOL"
    );
  });
});

describe("Bluetooth bridge result trust boundary", () => {
  const user = { id: "owner", role: "ADMIN" } as User;
  it("rejects success without SDK callback, but allows preflight failure", () => {
    assert.throws(() => validateBluetoothResult({ success: true, sdkCallbackReceived: false }));
    assert.doesNotThrow(() => validateBluetoothResult({ success: false, sdkCallbackReceived: false }));
  });
  it("does not infer capability from a model name", () => {
    assert.equal(supportsBluetoothTimedPin({ model: "D10 V4", capabilities: {}, rawSafe: {} }), false);
  });
  it("rejects undelivered credentials and replayed terminal results without writes", async () => {
    for (const entryStatus of ["READY_FOR_BLUETOOTH", "INSTALLED_ON_LOCK", "BLUETOOTH_SYNC_FAILED"]) {
      let writes = 0;
      const tx = {
        $queryRawUnsafe: async () => [{ sessionId: "s", credentialId: "c", entryStatus, deliveredAt: null }],
        $executeRawUnsafe: async () => { writes++; return 1; },
      };
      const stub = stubTransaction( async (fn: (client: typeof tx) => unknown) => fn(tx));
      try {
        await assert.rejects(recordBluetoothSyncResult({ user, sessionToken: "token", entryId: "e", success: true, sdkCallbackReceived: true }));
        assert.equal(writes, 0);
      } finally { stub.mock.restore(); }
    }
  });
  it("persists SDK success only after delivery and finalizes terminal batches", async () => {
    const writes: unknown[][] = [];
    const tx = {
      $queryRawUnsafe: async () => [{ sessionId: "s", credentialId: "c", entryStatus: "BLUETOOTH_SYNCING", deliveredAt: new Date() }],
      $executeRawUnsafe: async (...args: unknown[]) => { writes.push(args); return 1; },
    };
    const stub = stubTransaction( async (fn: (client: typeof tx) => unknown) => fn(tx));
    try {
      const result = await recordBluetoothSyncResult({ user, sessionToken: "token", entryId: "e", success: true, sdkCallbackReceived: true });
      assert.equal(result.status, "INSTALLED_ON_LOCK");
      assert.equal(writes[0][2], "INSTALLED_ON_LOCK");
      assert.equal(writes[1][2], "INSTALLED_ON_LOCK");
      assert.equal(writes.length, 3);
    } finally { stub.mock.restore(); }
  });
  it("persists per-entry failure without storing raw SDK text or PINs", async () => {
    const writes: unknown[][] = [];
    const tx = {
      $queryRawUnsafe: async () => [{ sessionId: "s", credentialId: "c", entryStatus: "READY_FOR_BLUETOOTH", deliveredAt: null }],
      $executeRawUnsafe: async (...args: unknown[]) => { writes.push(args); return 1; },
    };
    const stub = stubTransaction( async (fn: (client: typeof tx) => unknown) => fn(tx));
    try {
      const result = await recordBluetoothSyncResult({ user, sessionToken: "token", entryId: "e", success: false,
        sdkCallbackReceived: false, errorCode: "BLUETOOTH_TIMED_PIN_UNSUPPORTED", errorMessage: "secret PIN 5588" });
      assert.equal(result.status, "BLUETOOTH_SYNC_FAILED");
      assert.ok(!JSON.stringify(writes).includes("5588"));
      assert.equal(writes[0][4], "BLUETOOTH_TIMED_PIN_UNSUPPORTED");
    } finally { stub.mock.restore(); }
  });
  it("rejects expired, consumed and not-yet-activated credential sessions", async () => {
    for (const sessionStatus of ["CREATED", "COMPLETED", "EXPIRED", "FAILED"]) {
      const tx = { $queryRawUnsafe: async () => [{ sessionStatus, expiresAt: new Date(Date.now() + 60000), entryStatus: "READY_FOR_BLUETOOTH" }] };
      const stub = stubTransaction( async (fn: (client: typeof tx) => unknown) => fn(tx));
      try { await assert.rejects(deliverBluetoothCredential({ user, sessionToken: "token", entryId: "e" })); }
      finally { stub.mock.restore(); }
    }
  });
});

function stubTransaction(implementation: unknown) {
  const original = prisma.$transaction;
  prisma.$transaction = implementation as typeof original;
  return { mock: { restore: () => { prisma.$transaction = original; } } };
}
