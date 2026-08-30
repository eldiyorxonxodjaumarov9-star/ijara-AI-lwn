/**
 * TTLock 4-bosqich (DB) unit testlari — tarmoq / Neon yo‘q.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { decryptSecret, encryptSecret } from "./crypto";
import {
  toPublicAccessCredential,
  ttlockGatewayUniqueKey,
  ttlockLockUniqueKey,
  type TtlockAccessCredentialRow,
  type TtlockConnectionRow,
} from "./db";
import { TtlockError } from "./errors";
import {
  assertValidAccessWindow,
  coerceBatteryFromRemote,
  encryptAccessCredential,
  looksEncryptedSecret,
  mapOnlineStatus,
  normalizeBattery,
  onlineStatusToPublicBool,
  resolveCanonicalOnlineStatus,
  softRemovePatch,
  stripSecretFields,
  toExternalIdString,
} from "./persistence";
import { mapAccessGrant, mapLockSettings } from "@/lib/api-server/lwn-room-lock";

const testKey = "a".repeat(64);

describe("TTLock phase4 DB persistence", () => {
  it("1. 4 xonali passcode hech qanday qismi plaintext DB maydoniga yozilmaydi", () => {
    const pin = "4829";
    const { credentialEncrypted } = encryptAccessCredential(pin, testKey);
    assert.equal(looksEncryptedSecret(credentialEncrypted), true);
    assert.equal(credentialEncrypted.includes(pin), false);
    assert.equal(credentialEncrypted.includes("4829"), false);
    // Natijada last4 / fragment yo‘q
    assert.equal(
      "credentialLast4" in encryptAccessCredential(pin, testKey),
      false
    );
  });

  it("2. API response’da credential yoki fragmenti yo‘q", () => {
    const pin = "482917";
    const cred: TtlockAccessCredentialRow = {
      id: "ac1",
      roomAccessGrantId: "g1",
      connectionId: "c1",
      ttlockCachedLockId: "l1",
      accessType: "PASSCODE",
      syncStatus: "ACTIVE",
      externalAccessId: "8811",
      credentialEncrypted: encryptSecret(pin, testKey),
      sentAt: null,
      lastSyncedAt: null,
      revokedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const pub = toPublicAccessCredential(cred);
    const json = JSON.stringify(pub);
    assert.equal("credentialEncrypted" in pub, false);
    assert.equal("credentialLast4" in pub, false);
    assert.equal(json.includes(pin), false);
    assert.equal(json.includes("2917"), false);
    assert.equal(json.includes("••••"), false);
  });

  it("3. onlineStatus canonical manba", () => {
    assert.equal(mapOnlineStatus(true), "ONLINE");
    assert.equal(onlineStatusToPublicBool("ONLINE"), true);
    assert.equal(onlineStatusToPublicBool("OFFLINE"), false);
    assert.equal(onlineStatusToPublicBool("UNKNOWN"), null);
  });

  it("4. legacy Boolean va enum farq qilsa enum ishlatiladi", () => {
    assert.equal(
      resolveCanonicalOnlineStatus({
        onlineStatus: "ONLINE",
        onlineLegacy: false,
      }),
      "ONLINE"
    );
    assert.equal(
      resolveCanonicalOnlineStatus({
        onlineStatus: "OFFLINE",
        onlineLegacy: true,
      }),
      "OFFLINE"
    );
    // Enum UNKNOWN bo‘lsa migration backfill legacy’dan olishi mumkin
    assert.equal(
      resolveCanonicalOnlineStatus({
        onlineStatus: "UNKNOWN",
        onlineLegacy: true,
      }),
      "ONLINE"
    );
  });

  it("token DB’da plaintext emas", () => {
    const token = "access-token-plaintext-sample";
    const enc = encryptSecret(token, testKey);
    assert.equal(looksEncryptedSecret(enc), true);
    assert.notEqual(enc, token);
  });

  it("encrypt/decrypt roundtrip", () => {
    const plain = "refresh-token-xyz";
    assert.equal(decryptSecret(encryptSecret(plain, testKey), testKey), plain);
  });

  it("noto‘g‘ri encryption key bilan decrypt ishlamaydi", () => {
    const enc = encryptSecret("secret", testKey);
    assert.throws(
      () => decryptSecret(enc, "b".repeat(64)),
      (err: unknown) =>
        err instanceof TtlockError && err.code === "TTLOCK_DECRYPT_FAILED"
    );
  });

  it("lockId / gateway unique keys", () => {
    assert.equal(
      ttlockLockUniqueKey("c1", 999001),
      ttlockLockUniqueKey("c1", "999001")
    );
    assert.equal(
      ttlockGatewayUniqueKey("c1", 55),
      ttlockGatewayUniqueKey("c1", "55")
    );
  });

  it("battery 0–100 yoki null", () => {
    assert.equal(normalizeBattery(100), 100);
    assert.throws(() => normalizeBattery(101));
    assert.equal(coerceBatteryFromRemote(150), null);
  });

  it("validFrom < validUntil", () => {
    const a = new Date("2026-01-01T00:00:00.000Z");
    const b = new Date("2026-02-01T00:00:00.000Z");
    assert.doesNotThrow(() => assertValidAccessWindow(a, b));
    assert.throws(() => assertValidAccessWindow(b, a));
  });

  it("revokedAt mapping", () => {
    const revokedAt = new Date("2026-08-29T12:00:00.000Z");
    const mapped = mapAccessGrant({
      id: "g1",
      propertyId: "p1",
      tenantId: "t1",
      permissionType: "PIN",
      validFrom: null,
      validTo: null,
      status: "CANCELLED",
      notes: null,
      revokedAt,
      createdAt: revokedAt,
      updatedAt: revokedAt,
    });
    assert.equal(mapped.revokedAt, revokedAt.toISOString());
  });

  it("tashqi ID String", () => {
    assert.equal(typeof toExternalIdString(42), "string");
  });

  it("legacy room/grant nullable", () => {
    const settings = mapLockSettings({
      id: "s1",
      propertyId: "p1",
      providerName: null,
      lockName: "Eski",
      deviceId: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assert.equal(settings.ttlockCachedLockId, null);
  });

  it("soft-remove DELETE emas", () => {
    const patch = softRemovePatch();
    assert.equal(patch.isActive, false);
  });

  it("stripSecretFields token/credential olib tashlaydi", () => {
    const conn: TtlockConnectionRow = {
      id: "c1",
      ownerUserId: "u1",
      provider: "TTLOCK",
      status: "CONNECTED",
      ttlockUid: "99",
      accessTokenEncrypted: encryptSecret("tok", testKey),
      refreshTokenEncrypted: encryptSecret("ref", testKey),
      tokenExpiresAt: null,
      lastConnectedAt: null,
      lastSyncedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const safe = stripSecretFields({
      ...conn,
      credentialLast4: "4829",
      password: "x",
    } as Record<string, unknown>);
    assert.equal("accessTokenEncrypted" in safe, false);
    assert.equal("credentialLast4" in safe, false);
    assert.equal("password" in safe, false);
  });

  it("TTLock source fayllarida any yo‘q", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts")
    );
    for (const file of files) {
      const src = readFileSync(join(dir, file), "utf8");
      assert.equal(
        /:\s*any\b|\bas\s+any\b/.test(src),
        false,
        `${file} contains any`
      );
    }
  });

  it("schema/migration/credentialLast4 yo‘q", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const root = join(dir, "..", "..", "..", "..");
    const schema = readFileSync(
      join(root, "server", "prisma", "schema.prisma"),
      "utf8"
    );
    const mig = readFileSync(
      join(
        root,
        "server",
        "prisma",
        "migrations",
        "20260829140000_ttlock_db_phase4",
        "migration.sql"
      ),
      "utf8"
    );
    assert.equal(schema.includes("credentialLast4"), false);
    assert.equal(mig.includes("credentialLast4"), false);
  });
});
