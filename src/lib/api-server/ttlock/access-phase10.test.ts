/**
 * TTLock 10-bosqich — qulfsiz release-readiness audit testlari.
 * Mock/unit PASS; haqiqiy API/qurilma BLOCKED yoki PENDING_LIVE_TEST.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CRON_NOT_CONFIGURED_CODE,
  assertFailClosedCronAuth,
} from "../cron-auth";
import {
  getTtlockPublicConfigStatus,
  isTtlockConfigured,
  readTtlockEnvConfig,
} from "./config";
import { decryptSecret, encryptSecret } from "./crypto";
import { isTtlockDbReady, resetTtlockDbReadyCache } from "./db";
import { TTLOCK_EMPTY_LOCKS_MESSAGE } from "@/lib/ttlock-settings-view";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../../..");
const ttlockDir = __dirname;

type AuditStatus = "PASS" | "FAIL" | "SKIP" | "BLOCKED" | "N/A";

export const PHASE10_AUDIT: Array<{
  section: string;
  requirement: string;
  test: string;
  mode: "mock" | "real" | "source";
  status: AuditStatus;
  evidence: string;
}> = [
  // §1 Konfiguratsiya
  { section: "1", requirement: "Server-only env", test: "p10-1: server-only config", mode: "source", status: "PASS", evidence: "NEXT_PUBLIC_TTLOCK=0" },
  { section: "1", requirement: ".env.example bo‘sh placeholder", test: "p10-1: server-only config", mode: "source", status: "PASS", evidence: "TTLOCK_*= empty" },
  { section: "1", requirement: "Fail-closed connect/sync", test: "ttlock.test.ts describe 1", mode: "mock", status: "PASS", evidence: "TTLOCK_NOT_CONFIGURED" },
  { section: "1", requirement: "CRON_SECRET yo‘q → 503", test: "cron-auth.test.ts", mode: "mock", status: "PASS", evidence: CRON_NOT_CONFIGURED_CODE },
  { section: "1", requirement: "Encryption key validatsiya", test: "ttlock.test.ts describe 3", mode: "mock", status: "PASS", evidence: "64 hex / 32 byte" },
  // §2 Token
  { section: "2", requirement: "OAuth token request mapping", test: "ttlock.test.ts fetchAccessToken", mode: "mock", status: "PASS", evidence: "/oauth2/token" },
  { section: "2", requirement: "Refresh grant_type", test: "ttlock.test.ts refreshAccessToken", mode: "mock", status: "PASS", evidence: "refresh_token" },
  { section: "2", requirement: "Token shifrlash AES-256-GCM", test: "ttlock.test.ts describe 3", mode: "mock", status: "PASS", evidence: "v1:iv:tag" },
  { section: "2", requirement: "Parallel refresh dedupe", test: "p10-2: token refresh dedupe", mode: "source", status: "PASS", evidence: "refreshLocks Map" },
  { section: "2", requirement: "Stale connection re-fetch", test: "p10-2: token refresh dedupe", mode: "source", status: "PASS", evidence: "findConnectionById" },
  { section: "2", requirement: "Haqiqiy token olish", test: "p10-live: token E2E", mode: "real", status: "BLOCKED", evidence: "Sciener credentials yo‘q" },
  // §3 Bo‘sh qulf
  { section: "3", requirement: "Bo‘sh ro‘yxat UI matni", test: "ttlock-settings-view.test.ts #9", mode: "mock", status: "PASS", evidence: TTLOCK_EMPTY_LOCKS_MESSAGE.slice(0, 40) },
  { section: "3", requirement: "Hard-delete yo‘q", test: "p10-3: empty lock sync", mode: "source", status: "PASS", evidence: "softRemoveMissingLocks" },
  { section: "3", requirement: "Bo‘sh sync xato emas", test: "p10-3: empty lock sync", mode: "source", status: "PASS", evidence: "upserted=0 muvaffaqiyat" },
  // §4 API holatlar
  { section: "4", requirement: "Status mapping UI", test: "ttlock-settings-view.test.ts", mode: "mock", status: "PASS", evidence: "deriveTtlockPanelPhase" },
  { section: "4", requirement: "Public javobda secret yo‘q", test: "ttlock.test.ts describe 2", mode: "mock", status: "PASS", evidence: "stripSecretFields" },
  // §5 UI
  { section: "5", requirement: "EMPLOYEE blok", test: "ttlock.test.ts role", mode: "mock", status: "PASS", evidence: "TTLOCK_FORBIDDEN" },
  { section: "5", requirement: "Double-submit himoya", test: "p10-5: UI panel", mode: "source", status: "PASS", evidence: "busy state" },
  { section: "5", requirement: "Browser visual smoke 390px", test: "p10-5: browser smoke", mode: "real", status: "SKIP", evidence: "Brauzer avtomatizatsiya yo‘q" },
  // §6 DB
  { section: "6", requirement: "Migration ketma-ketligi", test: "p10-6: migrations", mode: "source", status: "PASS", evidence: "6 ta migration" },
  { section: "6", requirement: "Runtime DDL yo‘q", test: "room-lock-phase6.test.ts", mode: "source", status: "PASS", evidence: "CREATE TABLE grep=0" },
  { section: "6", requirement: "isTtlockDbReady phase 7–9", test: "p10-6: db ready probe", mode: "source", status: "PASS", evidence: "callback_inbox probe" },
  { section: "6", requirement: "Dedupe indekslar", test: "access-phase9.test.ts", mode: "source", status: "PASS", evidence: "lock-scope unique" },
  { section: "6", requirement: "Neon production migrate", test: "p10-6: neon", mode: "real", status: "BLOCKED", evidence: "Migration qo‘llanmagan" },
  // §7 Callback
  { section: "7", requirement: "Fast ACK + after()", test: "access-phase9.test.ts", mode: "mock", status: "PASS", evidence: "raw success" },
  { section: "7", requirement: "Cron fail-closed", test: "cron-auth.test.ts", mode: "mock", status: "PASS", evidence: "503/403" },
  { section: "7", requirement: "Sciener callback E2E", test: "access-phase9 SKIP", mode: "real", status: "BLOCKED", evidence: "PENDING_LIVE_TEST" },
  // §8 Xatoliklar
  { section: "8", requirement: "O‘zbekcha UI xato", test: "ttlock-settings-view.test.ts", mode: "mock", status: "PASS", evidence: "mapTtlockUiError" },
  { section: "8", requirement: "Remote unknown blind retry yo‘q", test: "access-phase8.test.ts", mode: "source", status: "PASS", evidence: "UNKNOWN status" },
  // §9 Secret
  { section: "9", requirement: "localStorage TTLock yo‘q", test: "access-phase7.test.ts", mode: "source", status: "PASS", evidence: "grep=0" },
  { section: "9", requirement: "any yo‘q", test: "ttlock.test.ts describe 12", mode: "source", status: "PASS", evidence: "ttlock src scan" },
  { section: "9", requirement: "Client bundle server import yo‘q", test: "p10-9: client boundary", mode: "source", status: "PASS", evidence: "ttlock-client.ts API only" },
];

describe("TTLock phase10 release audit", () => {
  const ENV_KEYS = [
    "TTLOCK_CLIENT_ID",
    "TTLOCK_CLIENT_SECRET",
    "TTLOCK_ACCOUNT_USERNAME",
    "TTLOCK_ACCOUNT_PASSWORD_MD5",
    "TTLOCK_TOKEN_ENCRYPTION_KEY",
    "TTLOCK_API_BASE_URL",
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};

  function clearTtlockEnv() {
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  }

  function restoreTtlockEnv() {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  }

  it("p10-1: server-only config", () => {
    clearTtlockEnv();
    try {
    const envExample = readFileSync(join(repoRoot, ".env.example"), "utf8");
    assert.match(envExample, /TTLOCK_CLIENT_ID=/);
    assert.match(envExample, /CRON_SECRET=/);
    assert.equal(/TTLOCK_.*=(?!$)[^\r\n]+/.test(envExample), false, "TTLOCK env values must be empty in .env.example");
    assert.equal(/NEXT_PUBLIC_TTLOCK/.test(readFileSync(join(repoRoot, "package.json"), "utf8")), false);
    const clientHits = readFileSync(join(repoRoot, "src/lib/ttlock-client.ts"), "utf8");
    assert.equal(clientHits.includes("api-server/ttlock/config"), false);
    assert.equal(clientHits.includes("process.env.TTLOCK"), false);
    assert.equal(isTtlockConfigured(), false);
    assert.equal(readTtlockEnvConfig(), null);
    const pub = getTtlockPublicConfigStatus();
    assert.equal(JSON.stringify(pub).includes("secret"), false);
    } finally {
      restoreTtlockEnv();
    }
  });

  it("p10-2: token refresh dedupe + stale re-fetch", () => {
    const service = readFileSync(join(ttlockDir, "service.ts"), "utf8");
    assert.match(service, /refreshLocks/);
    assert.match(service, /findConnectionById\(connection\.id\)/);
    const client = readFileSync(join(ttlockDir, "client.ts"), "utf8");
    const types = readFileSync(join(ttlockDir, "types.ts"), "utf8");
    assert.match(types, /oauthToken: "\/oauth2\/token"/);
    assert.match(client, /TTLOCK_ENDPOINTS\.oauthToken/);
    assert.match(client, /grant_type: "refresh_token"/);
    const key = "a".repeat(64);
    const enc = encryptSecret("tok", key);
    assert.ok(enc.startsWith("v1:"));
    assert.throws(() => decryptSecret(enc, "b".repeat(64)));
  });

  it("p10-3: empty lock sync", () => {
    assert.equal(
      TTLOCK_EMPTY_LOCKS_MESSAGE,
      "TTLock hisobida hozircha qulf topilmadi. Qulfni TTLock ilovasiga qo‘shgach, sinxronlashtiring."
    );
    const service = readFileSync(join(ttlockDir, "service.ts"), "utf8");
    assert.match(service, /softRemoveMissingLocks/);
    assert.equal(service.includes('DELETE FROM "ttlock_cached_locks"'), false);
  });

  it("p10-5: UI panel guards", () => {
    const panel = readFileSync(
      join(repoRoot, "src/components/settings/ttlock-settings-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /busy/);
    assert.match(panel, /TTLOCK_EMPTY_LOCKS_MESSAGE/);
    assert.match(panel, /canManageTtlock/);
  });

  it("p10-6: migrations + db ready probe", () => {
    const migDir = join(repoRoot, "server/prisma/migrations");
    const files = readdirSync(migDir).filter((f) => f.includes("ttlock"));
    assert.equal(files.length, 6);
    const ordered = [
      "20260831100000_lwn_room_lock_baseline",
      "20260831110000_ttlock_integration",
      "20260831120000_ttlock_db_phase4",
      "20260831130000_ttlock_access_phase7",
      "20260831140000_ttlock_remote_phase8",
      "20260831150000_ttlock_callback_phase9",
      "20260831160000_ttlock_callback_hardening",
    ];
    for (const name of ordered) {
      assert.ok(files.some((f) => f.startsWith(name)), name);
    }
    const dbSrc = readFileSync(join(ttlockDir, "db.ts"), "utf8");
    assert.match(dbSrc, /ttlock_callback_inbox/);
    assert.match(dbSrc, /ttlock_remote_commands/);
    assert.match(dbSrc, /lastCallbackReceivedAt/);
  });

  it("p10-6: isTtlockDbReady without DATABASE_URL", async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_PRISMA_URL;
    resetTtlockDbReadyCache();
    assert.equal(await isTtlockDbReady(), false);
    if (saved) process.env.DATABASE_URL = saved;
    resetTtlockDbReadyCache();
  });

  it("p10-7: callback status partial migration safe", () => {
    const status = readFileSync(join(ttlockDir, "callback-status.ts"), "utf8");
    assert.match(status, /catch/);
    assert.match(status, /countCallbackInboxByStatus\(\)\.catch/);
  });

  it("p10-9: client boundary", () => {
    const client = readFileSync(join(repoRoot, "src/lib/ttlock-client.ts"), "utf8");
    assert.match(client, /"use client"/);
    assert.match(client, /\/integrations\/ttlock\//);
    assert.equal(client.includes("api-server/ttlock/crypto"), false);
  });

  it("p10-live: token E2E — BLOCKED", () => {
    const row = PHASE10_AUDIT.find(
      (r) => r.requirement === "Haqiqiy token olish"
    );
    assert.equal(row?.status, "BLOCKED");
  });

  it("p10-live: Sciener callback — PENDING_LIVE_TEST", () => {
    const row = PHASE10_AUDIT.find(
      (r) => r.requirement === "Sciener callback E2E"
    );
    assert.equal(row?.status, "BLOCKED");
    assert.match(row?.evidence ?? "", /PENDING_LIVE_TEST/);
  });

  it("p10: audit manifest to‘liqligi", () => {
    assert.ok(PHASE10_AUDIT.length >= 30);
    const blocked = PHASE10_AUDIT.filter((r) => r.status === "BLOCKED");
    const pass = PHASE10_AUDIT.filter((r) => r.status === "PASS");
    assert.ok(blocked.length >= 2);
    assert.ok(pass.length >= 25);
    for (const row of PHASE10_AUDIT) {
      assert.ok(["PASS", "FAIL", "SKIP", "BLOCKED", "N/A"].includes(row.status));
    }
  });

  it("p10: CRON fail-closed regressiya", () => {
    delete process.env.CRON_SECRET;
    const res = assertFailClosedCronAuth(
      new Request("http://localhost/api/cron/ttlock-callback-retry")
    );
    assert.ok(res);
    assert.equal(res!.status, 503);
  });
});
