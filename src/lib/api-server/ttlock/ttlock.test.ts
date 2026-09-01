import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getTtlockPublicConfigStatus,
  isTtlockConfigured,
  listMissingTtlockFields,
  readTtlockEnvConfig,
} from "./config";
import { decryptSecret, encryptSecret } from "./crypto";
import {
  isMissingTtlockTableError,
  ttlockLockUniqueKey,
} from "./db";
import { mapTtlockBusinessCode, mapTtlockErrorToUz, TtlockError } from "./errors";
import { assertTtlockOwnerRole } from "./service";
import { inferRemoteUnlock } from "./types";

const ENV_KEYS = [
  "TTLOCK_CLIENT_ID",
  "TTLOCK_CLIENT_SECRET",
  "TTLOCK_ACCOUNT_USERNAME",
  "TTLOCK_ACCOUNT_PASSWORD_MD5",
  "TTLOCK_TOKEN_ENCRYPTION_KEY",
  "TTLOCK_API_BASE_URL",
] as const;

const saved: Record<string, string | undefined> = {};

function clearTtlockEnv() {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
}

function restoreTtlockEnv() {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

function fakeUser(role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE") {
  return { role };
}

describe("1. konfiguratsiya yo'q holati", () => {
  beforeEach(() => clearTtlockEnv());
  afterEach(() => restoreTtlockEnv());

  it("reports not configured when env empty", () => {
    assert.equal(isTtlockConfigured(), false);
    const status = getTtlockPublicConfigStatus();
    assert.equal(status.configured, false);
    assert.equal(status.environment, "eu");
    assert.ok(status.missingFields.includes("TTLOCK_CLIENT_ID"));
  });

  it("readTtlockEnvConfig returns null when incomplete", () => {
    process.env.TTLOCK_CLIENT_ID = "abc";
    assert.equal(readTtlockEnvConfig(), null);
  });
});

describe("2. secret/token javobga chiqmasligi", () => {
  beforeEach(() => clearTtlockEnv());
  afterEach(() => restoreTtlockEnv());

  it("public status JSON has no secret values", () => {
    process.env.TTLOCK_CLIENT_ID = "id-value-should-not-leak";
    process.env.TTLOCK_CLIENT_SECRET = "secret-value-leak-check";
    const status = getTtlockPublicConfigStatus();
    const json = JSON.stringify(status);
    assert.equal(json.includes("id-value-should-not-leak"), false);
    assert.equal(json.includes("secret-value-leak-check"), false);
    assert.ok(!/"clientSecret"/.test(json));
    assert.ok(!/"accessToken"/.test(json));
  });

  it("lists missing fields without exposing values", () => {
    process.env.TTLOCK_CLIENT_ID = "id-value-should-not-leak";
    const missing = listMissingTtlockFields();
    assert.ok(!missing.includes("id-value-should-not-leak"));
    assert.ok(missing.includes("TTLOCK_CLIENT_SECRET"));
  });
});

describe("3. encrypt/decrypt", () => {
  const testKey = "a".repeat(64);

  it("encrypts and decrypts roundtrip", () => {
    const plain = "access-token-sample-xyz";
    const enc = encryptSecret(plain, testKey);
    assert.ok(enc.startsWith("v1:"));
    assert.notEqual(enc, plain);
    assert.equal(decryptSecret(enc, testKey), plain);
  });

  it("uses unique IV each time", () => {
    const a = encryptSecret("same", testKey);
    const b = encryptSecret("same", testKey);
    assert.notEqual(a, b);
  });
});

describe("4. noto'g'ri encryption key", () => {
  const testKey = "a".repeat(64);

  it("fails with wrong key", () => {
    const enc = encryptSecret("token", testKey);
    const wrong = "b".repeat(64);
    assert.throws(
      () => decryptSecret(enc, wrong),
      (err: unknown) =>
        err instanceof TtlockError && err.code === "TTLOCK_DECRYPT_FAILED"
    );
  });

  it("rejects invalid key material", () => {
    assert.throws(
      () => encryptSecret("x", "short"),
      (err: unknown) =>
        err instanceof TtlockError &&
        err.code === "TTLOCK_ENCRYPTION_KEY_INVALID"
    );
  });
});

describe("5–6. token parse va refresh (mock fetch)", () => {
  beforeEach(() => {
    clearTtlockEnv();
    process.env.TTLOCK_CLIENT_ID = "cid";
    process.env.TTLOCK_CLIENT_SECRET = "csec";
    process.env.TTLOCK_ACCOUNT_USERNAME = "user@example.com";
    process.env.TTLOCK_ACCOUNT_PASSWORD_MD5 = "a".repeat(32);
    process.env.TTLOCK_TOKEN_ENCRYPTION_KEY = "c".repeat(64);
    process.env.TTLOCK_API_BASE_URL = "https://euapi.ttlock.com";
  });
  afterEach(() => {
    mock.restoreAll();
    restoreTtlockEnv();
  });

  it("parses token response", async () => {
    mock.method(globalThis, "fetch", async () => {
      return new Response(
        JSON.stringify({
          access_token: "tok_access",
          refresh_token: "tok_refresh",
          uid: 42,
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    const { fetchAccessToken } = await import("./client");
    const token = await fetchAccessToken();
    assert.equal(token.access_token, "tok_access");
    assert.equal(token.refresh_token, "tok_refresh");
    assert.equal(token.expires_in, 3600);
  });

  it("refresh token grant_type", async () => {
    let body = "";
    mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
      body = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          access_token: "a2",
          refresh_token: "r2",
          expires_in: 100,
        }),
        { status: 200 }
      );
    });
    const { refreshAccessToken } = await import("./client");
    const token = await refreshAccessToken("old_refresh");
    assert.equal(token.access_token, "a2");
    assert.ok(body.includes("grant_type=refresh_token"));
  });
});

describe("7. TTLock xato mapping", () => {
  it("maps token expired codes", () => {
    const err = mapTtlockBusinessCode(-3, "invalid token");
    assert.equal(err.code, "TTLOCK_TOKEN_EXPIRED");
  });

  it("maps rate limit", () => {
    const err = mapTtlockBusinessCode(-2018);
    assert.equal(err.code, "TTLOCK_RATE_LIMITED");
  });

  it("does not echo secret-like errmsg", () => {
    const err = mapTtlockBusinessCode(1, "bad password token secret");
    assert.equal(err.message, "TTLock API xatosi");
  });

  it("maps DATABASE_MIGRATION_REQUIRED for API clients", () => {
    const mapped = mapTtlockErrorToUz(
      new TtlockError(
        "TTLock jadvallari hali migratsiya qilinmagan",
        "DATABASE_MIGRATION_REQUIRED",
        503
      )
    );
    assert.equal(mapped.code, "DATABASE_MIGRATION_REQUIRED");
    assert.equal(mapped.httpStatus, 503);
  });
});

describe("8–9. qulf upsert va dublikat lockId", () => {
  it("builds stable unique key per connection + lockId", () => {
    const k1 = ttlockLockUniqueKey("conn-a", 123156);
    const k2 = ttlockLockUniqueKey("conn-a", "123156");
    const k3 = ttlockLockUniqueKey("conn-b", "123156");
    assert.equal(k1, k2);
    assert.notEqual(k1, k3);
  });

  it("detects missing-table errors for migration gate", () => {
    assert.equal(
      isMissingTtlockTableError({
        code: "P2021",
        message: 'Relation "ttlock_connections" does not exist',
      }),
      true
    );
    assert.equal(
      isMissingTtlockTableError({ code: "42P01", message: "undefined_table" }),
      true
    );
    assert.equal(
      isMissingTtlockTableError({ code: "P1001", message: "Can't reach" }),
      false
    );
  });
});

describe("10. user scope himoyasi", () => {
  it("allows ADMIN", () => {
    assert.doesNotThrow(() => assertTtlockOwnerRole(fakeUser("ADMIN")));
  });

  it("allows MANAGER", () => {
    assert.doesNotThrow(() => assertTtlockOwnerRole(fakeUser("MANAGER")));
  });

  it("allows SUPER_ADMIN (Prisma Role literal)", () => {
    // server/prisma Role enum: SUPER_ADMIN | ADMIN | MANAGER | EMPLOYEE
    assert.doesNotThrow(() => assertTtlockOwnerRole(fakeUser("SUPER_ADMIN")));
  });

  it("rejects EMPLOYEE", () => {
    assert.throws(
      () => assertTtlockOwnerRole(fakeUser("EMPLOYEE")),
      (err: unknown) =>
        err instanceof TtlockError && err.code === "TTLOCK_FORBIDDEN"
    );
  });

  it("OWNER_ROLES covers all five TTLock API service entry guards", async () => {
    // status/connect/sync/locks/disconnect → service → assertTtlockOwnerRole
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = dirname(fileURLToPath(import.meta.url));
    const service = readFileSync(join(dir, "service.ts"), "utf8");
    assert.match(service, /isTtlockAccessOwnerRole\(user\.role\)/);
    const effective = readFileSync(join(dir, "access-effective.ts"), "utf8");
    assert.match(
      effective,
      /TTLOCK_ACCESS_OWNER_ROLES = \[\s*"SUPER_ADMIN",\s*"ADMIN",\s*"MANAGER",\s*\]/
    );
    for (const fn of [
      "getTtlockStatus",
      "connectTtlock",
      "syncTtlockLocks",
      "listTtlockLocks",
      "disconnectTtlock",
    ]) {
      assert.match(
        service,
        new RegExp(`export async function ${fn}[\\s\\S]*?assertTtlockOwnerRole`),
        `${fn} must call assertTtlockOwnerRole`
      );
    }
  });
});

describe("11. TTLock ishlamasa boshqa modullar", () => {
  beforeEach(() => clearTtlockEnv());
  afterEach(() => restoreTtlockEnv());

  it("config helpers do not throw when TTLock env missing", () => {
    assert.equal(isTtlockConfigured(), false);
    assert.doesNotThrow(() => getTtlockPublicConfigStatus());
    assert.doesNotThrow(() => listMissingTtlockFields());
    assert.equal(readTtlockEnvConfig(), null);
  });

  it("inferRemoteUnlock stays usable without TTLock network", () => {
    assert.equal(inferRemoteUnlock(null), null);
    assert.equal(typeof inferRemoteUnlock(0x10), "boolean");
  });
});

describe("12. TypeScript'da any ishlatilmasligi", () => {
  it("ttlock source files contain no `: any` or `as any`", () => {
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
});
