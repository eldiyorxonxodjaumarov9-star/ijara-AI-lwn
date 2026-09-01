/**
 * PostgreSQL 18 + embedded scratch DB integration for TTLock service layer.
 * Run: TTLOCK_PG18_INTEGRATION=1 npx tsx --test src/lib/api-server/ttlock/ttlock-pg18-integration.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";

import { Role, PrismaClient } from "@prisma/client";

import { decryptSecret, encryptSecret } from "./crypto";
import { looksEncryptedSecret } from "./persistence";
import { TtlockError } from "./errors";

const ENABLED = process.env.TTLOCK_PG18_INTEGRATION === "1";
const describePg = ENABLED ? describe : describe.skip;

function loadEnvLocal() {
  for (const file of [".env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

describePg("TTLock PostgreSQL 18 integration", () => {
  let scratchDir = "";
  let pg: { stop: () => Promise<void> } | null = null;
  let prisma: PrismaClient;
  let adminUser: { id: string; role: Role };
  let connectTtlock: typeof import("./service").connectTtlock;
  let disconnectTtlock: typeof import("./service").disconnectTtlock;
  let syncTtlockLocks: typeof import("./service").syncTtlockLocks;
  let getValidAccessToken: typeof import("./service").getValidAccessToken;
  let findConnectionByOwner: typeof import("./db").findConnectionByOwner;
  let resetTtlockDbReadyCache: typeof import("./db").resetTtlockDbReadyCache;
  let upsertConnectionForOwner: typeof import("./db").upsertConnectionForOwner;

  before(async () => {
    loadEnvLocal();
    const required = [
      "TTLOCK_CLIENT_ID",
      "TTLOCK_CLIENT_SECRET",
      "TTLOCK_ACCOUNT_USERNAME",
      "TTLOCK_ACCOUNT_PASSWORD_MD5",
      "TTLOCK_TOKEN_ENCRYPTION_KEY",
    ];
    for (const k of required) {
      if (!process.env[k]?.trim()) {
        throw new Error(`missing env for integration: ${k}`);
      }
    }

    scratchDir = mkdtempSync(join(tmpdir(), "arenda-ttlock-pg18-"));
    const EmbeddedPostgres = (await import("embedded-postgres")).default;
    const port = 55432 + Math.floor(Math.random() * 1000);
    const pgInstance = new EmbeddedPostgres({
      databaseDir: join(scratchDir, "pgdata"),
      user: "postgres",
      password: "postgres",
      port,
      persistent: false,
    });
    await pgInstance.initialise();
    await pgInstance.start();
    pg = pgInstance;

    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
    process.env.DATABASE_URL = databaseUrl;
    process.env.POSTGRES_PRISMA_URL = databaseUrl;
    delete (globalThis as { prisma?: PrismaClient }).prisma;

    prisma = new PrismaClient();
    (globalThis as { prisma?: PrismaClient }).prisma = prisma;

    const push = spawnSync(
      process.execPath,
      [
        require.resolve("prisma/build/index.js"),
        "db",
        "push",
        "--schema=server/prisma/schema.prisma",
        "--accept-data-loss",
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        shell: false,
      }
    );
    if (push.status !== 0) {
      throw new Error(`db push failed: ${push.stderr || push.stdout}`);
    }

    resetTtlockDbReadyCache = (await import("./db")).resetTtlockDbReadyCache;
    resetTtlockDbReadyCache();

    const svc = await import("./service");
    connectTtlock = svc.connectTtlock;
    disconnectTtlock = svc.disconnectTtlock;
    syncTtlockLocks = svc.syncTtlockLocks;
    getValidAccessToken = svc.getValidAccessToken;

    const db = await import("./db");
    findConnectionByOwner = db.findConnectionByOwner;
    upsertConnectionForOwner = db.upsertConnectionForOwner;

    const passwordHash = await bcrypt.hash("TestAdmin@12345", 10);
    adminUser = await prisma.user.create({
      data: {
        email: `ttlock-pg18-${randomUUID()}@localhost.test`,
        password: passwordHash,
        fullName: "TTLock PG18 Admin",
        role: Role.SUPER_ADMIN,
      },
      select: { id: true, role: true },
    });
  });

  after(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    delete (globalThis as { prisma?: PrismaClient }).prisma;
    if (pg) await pg.stop();
    if (scratchDir) {
      try {
        rmSync(scratchDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it("rejects invalid connection status enum", async () => {
    await assert.rejects(
      () =>
        upsertConnectionForOwner(adminUser.id, {
          status: "NOT_A_REAL_STATUS",
        }),
      (err: unknown) => err instanceof TtlockError
    );
  });

  it("connectTtlock stores encrypted tokens and CONNECTED status", async () => {
    const status = await connectTtlock({
      id: adminUser.id,
      role: adminUser.role,
    } as never);
    assert.equal(status.connection?.connected, true);

    const row = await findConnectionByOwner(adminUser.id);
    assert.ok(row);
    assert.equal(row!.status, "CONNECTED");
    assert.ok(looksEncryptedSecret(row!.accessTokenEncrypted));
    assert.ok(looksEncryptedSecret(row!.refreshTokenEncrypted));
    assert.match(row!.accessTokenEncrypted ?? "", /^v1:/);
    assert.doesNotMatch(row!.accessTokenEncrypted ?? "", /eyJ/i);
  });

  it("syncTtlockLocks succeeds with zero locks", async () => {
    const result = await syncTtlockLocks({
      id: adminUser.id,
      role: adminUser.role,
    } as never);
    assert.equal(result.locks.length, 0);
    assert.equal(result.upserted, 0);
    assert.equal(result.status.connection?.lockCount, 0);
  });

  it("refresh path re-encrypts tokens after expiry skew", async () => {
    const row = await findConnectionByOwner(adminUser.id);
    assert.ok(row?.accessTokenEncrypted && row.refreshTokenEncrypted);

    await prisma.ttlockConnection.update({
      where: { id: row!.id },
      data: { tokenExpiresAt: new Date(Date.now() - 3600_000) },
    });

    const stale = await findConnectionByOwner(adminUser.id);
    assert.ok(stale?.tokenExpiresAt);
    assert.ok(stale!.tokenExpiresAt!.getTime() < Date.now());

    const plain = await getValidAccessToken(stale!, adminUser.id);
    assert.ok(plain.length > 0);

    const after = await findConnectionByOwner(adminUser.id);
    assert.ok(after?.accessTokenEncrypted && after.refreshTokenEncrypted);
    assert.ok(looksEncryptedSecret(after!.accessTokenEncrypted));
    assert.ok(looksEncryptedSecret(after!.refreshTokenEncrypted));
    assert.ok(after!.tokenExpiresAt);
    assert.ok(after!.tokenExpiresAt!.getTime() > Date.now());
    assert.equal(after!.status, "CONNECTED");
  });

  it("disconnect clears tokens without enum errors", async () => {
    const status = await disconnectTtlock({
      id: adminUser.id,
      role: adminUser.role,
    } as never);
    assert.equal(status.connection?.connected, false);
    const row = await findConnectionByOwner(adminUser.id);
    assert.ok(row);
    assert.equal(row!.status, "DISCONNECTED");
    assert.equal(row!.accessTokenEncrypted, null);
  });

  it("crypto round-trip remains independent", () => {
    const sample = `pg18-sample-${randomBytes(4).toString("hex")}`;
    const enc = encryptSecret(sample);
    assert.equal(decryptSecret(enc), sample);
  });
});
