/**
 * TTLock callback after()-style processing on embedded PostgreSQL 18 scratch DB.
 * Run: TTLOCK_PG18_INTEGRATION=1 npx tsx --test src/lib/api-server/ttlock/ttlock-callback-pg18-integration.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, describe, it, mock } from "node:test";
import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";

import { Role, PrismaClient } from "@prisma/client";

import { TTLOCK_CALLBACK_SUCCESS_BODY } from "./callback-config";
import { TTLOCK_ENDPOINTS } from "./types";

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

function uniqueExternalLockId(): string {
  return `${Date.now()}${randomBytes(2).readUInt16BE(0)}`.slice(0, 18);
}

async function pollInboxStatus(
  prisma: PrismaClient,
  inboxId: string,
  statuses: string[],
  timeoutMs = 10_000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await prisma.ttlockCallbackInbox.findUnique({
      where: { id: inboxId },
    });
    if (row && statuses.includes(row.status)) return row;
    await new Promise((r) => setTimeout(r, 50));
  }
  const last = await prisma.ttlockCallbackInbox.findUnique({
    where: { id: inboxId },
  });
  throw new Error(
    `inbox ${inboxId} did not reach [${statuses.join(", ")}]; last=${last?.status ?? "missing"}`
  );
}

async function simulateAfterProcessing(
  processInbox: typeof import("./callback-processor").processCallbackInbox,
  input: { inboxId: string; rawBody: string }
) {
  await processInbox({
    inboxId: input.inboxId,
    rawBody: input.rawBody,
    workerId: `pg18-after-${input.inboxId.slice(0, 8)}`,
  });
}

describePg("TTLock callback PG18 after() flows", () => {
  let scratchDir = "";
  let pg: { stop: () => Promise<void> } | null = null;
  let prisma: PrismaClient;
  let adminUser: { id: string; role: Role };
  let connectionId = "";
  let connectTtlock: typeof import("./service").connectTtlock;
  let findConnectionByOwner: typeof import("./db").findConnectionByOwner;
  let resetTtlockDbReadyCache: typeof import("./db").resetTtlockDbReadyCache;
  let upsertCachedLock: typeof import("./db").upsertCachedLock;
  let processCallbackInbox: typeof import("./callback-processor").processCallbackInbox;
  let receiveCallbackFastAck: (rawBody: string) => Promise<{
    status: number;
    body: string;
    inboxId: string | null;
    duplicate: boolean;
  }>;

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

    scratchDir = mkdtempSync(join(tmpdir(), "arenda-ttlock-cb-pg18-"));
    const EmbeddedPostgres = (await import("embedded-postgres")).default;
    const port = 56432 + Math.floor(Math.random() * 1000);
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

    const db = await import("./db");
    findConnectionByOwner = db.findConnectionByOwner;
    upsertCachedLock = db.upsertCachedLock;
    processCallbackInbox = (await import("./callback-processor"))
      .processCallbackInbox;

    const { parseCallbackFormBody } = await import("./callback-parse");
    const { receiveCallbackInbox } = await import("./callback-inbox");
    const {
      buildSanitizedMetadata,
      inferPrimarySemanticEvent,
      resolveLockConnection,
    } = await import("./callback-processor");
    const { findActiveLockMatchesByExternalId } = await import("./db");

    receiveCallbackFastAck = async (rawBody: string) => {
      const parsed = parseCallbackFormBody(rawBody);
      let connId: string | null = null;
      if (parsed.lockId) {
        const matches = await findActiveLockMatchesByExternalId(parsed.lockId);
        const resolved = resolveLockConnection(matches);
        if (resolved.ok) connId = resolved.match.connection.id;
      }
      const providerEventAt =
        parsed.records[0]?.serverDate != null
          ? new Date(parsed.records[0].serverDate!)
          : null;
      const receiveResult = await receiveCallbackInbox({
        rawBody,
        parsed,
        connectionId: connId,
        semanticEventType: inferPrimarySemanticEvent(parsed),
        providerEventAt,
        sanitizedMetadata: buildSanitizedMetadata(parsed),
      });
      return {
        status: 200,
        body: TTLOCK_CALLBACK_SUCCESS_BODY,
        inboxId: receiveResult.inboxId,
        duplicate: receiveResult.kind === "duplicate",
      };
    };

    const passwordHash = await bcrypt.hash("TestAdmin@12345", 10);
    adminUser = await prisma.user.create({
      data: {
        email: `ttlock-cb-pg18-${randomUUID()}@localhost.test`,
        password: passwordHash,
        fullName: "TTLock Callback PG18 Admin",
        role: Role.SUPER_ADMIN,
      },
      select: { id: true, role: true },
    });

    await connectTtlock({
      id: adminUser.id,
      role: adminUser.role,
    } as never);
    const conn = await findConnectionByOwner(adminUser.id);
    assert.ok(conn);
    connectionId = conn!.id;
  });

  afterEach(() => {
    mock.restoreAll();
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

  it("fast ACK: HTTP 200 success before inbox processing completes", async () => {
    const lockId = uniqueExternalLockId();
    const rawBody = `notifyType=2&lockId=${lockId}&electricQuantity=60`;

    const ack = await receiveCallbackFastAck(rawBody);
    assert.equal(ack.status, 200);
    assert.equal(ack.body, TTLOCK_CALLBACK_SUCCESS_BODY);

    const inbox = await prisma.ttlockCallbackInbox.findFirst({
      where: { externalLockId: lockId },
      orderBy: { receivedAt: "desc" },
    });
    assert.ok(inbox);
    assert.equal(inbox!.status, "RECEIVED");

    await simulateAfterProcessing(processCallbackInbox, {
      inboxId: inbox!.id,
      rawBody,
    });
    const final = await pollInboxStatus(prisma, inbox!.id, [
      "UNRESOLVED",
      "PROCESSED",
      "FAILED",
    ]);
    assert.ok(final);
  });

  it("UNRESOLVED for unknown lock callback", async () => {
    const lockId = uniqueExternalLockId();
    const rawBody = `notifyType=2&lockId=${lockId}&electricQuantity=55`;

    const ack = await receiveCallbackFastAck(rawBody);
    assert.equal(ack.status, 200);
    assert.equal(ack.body, TTLOCK_CALLBACK_SUCCESS_BODY);

    const inbox = await prisma.ttlockCallbackInbox.findFirst({
      where: { externalLockId: lockId },
    });
    assert.ok(inbox);
    assert.equal(inbox!.status, "RECEIVED");

    await simulateAfterProcessing(processCallbackInbox, {
      inboxId: inbox!.id,
      rawBody,
    });
    const final = await pollInboxStatus(prisma, inbox!.id, ["UNRESOLVED"]);
    assert.equal(final.status, "UNRESOLVED");
    assert.equal(final.lastErrorCode, "TTLOCK_CALLBACK_UNKNOWN_LOCK");
  });

  it("PROCESSED for cached lock with mocked verify-by-fetch (device wake-up)", async () => {
    const lockId = uniqueExternalLockId();
    const cached = await upsertCachedLock({
      connectionId,
      externalLockId: lockId,
      name: "PG18 Callback Lock",
      mac: null,
      model: null,
      battery: 40,
      hasGateway: false,
      remoteUnlock: false,
      capabilities: null,
      rawSafe: null,
      lastSyncedAt: new Date(),
    });

    mock.method(globalThis, "fetch", async (url: string | URL) => {
      const u = String(url);
      if (u.includes(TTLOCK_ENDPOINTS.lockDetail)) {
        return new Response(JSON.stringify({ errcode: 0, electricQuantity: 72 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ errcode: 0, list: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const rawBody = `notifyType=2&lockId=${lockId}&electricQuantity=72`;
    const ack = await receiveCallbackFastAck(rawBody);
    assert.equal(ack.status, 200);
    assert.equal(ack.body, TTLOCK_CALLBACK_SUCCESS_BODY);

    const inbox = await prisma.ttlockCallbackInbox.findFirst({
      where: { externalLockId: lockId },
    });
    assert.ok(inbox);
    assert.equal(inbox!.connectionId, connectionId);
    assert.equal(inbox!.status, "RECEIVED");

    await simulateAfterProcessing(processCallbackInbox, {
      inboxId: inbox!.id,
      rawBody,
    });
    const final = await pollInboxStatus(prisma, inbox!.id, ["PROCESSED"]);
    assert.equal(final.status, "PROCESSED");
    assert.ok(final.processedAt);

    const lockRow = await prisma.ttlockCachedLock.findUnique({
      where: { id: cached.id },
    });
    assert.equal(lockRow?.battery, 72);
  });

  it("FAILED with retry metadata when notifyType=1 verify-by-fetch fails", async () => {
    const lockId = uniqueExternalLockId();
    const cached = await upsertCachedLock({
      connectionId,
      externalLockId: lockId,
      name: "PG18 Verify Fail Lock",
      mac: null,
      model: null,
      battery: 30,
      hasGateway: false,
      remoteUnlock: false,
      capabilities: null,
      rawSafe: null,
      lastSyncedAt: new Date(),
    });

    const property = await prisma.property.create({
      data: {
        title: `PG18 room ${randomUUID().slice(0, 8)}`,
        address: "Test address",
        region: "Tashkent",
        district: "Test",
      },
    });
    await prisma.roomLockSettings.create({
      data: {
        propertyId: property.id,
        ttlockCachedLockId: cached.id,
      },
    });

    mock.method(globalThis, "fetch", async (url: string | URL) => {
      const u = String(url);
      if (u.includes(TTLOCK_ENDPOINTS.lockRecordList)) {
        return new Response(JSON.stringify({ errcode: 0, list: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ errcode: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const serverDate = Date.now();
    const records = JSON.stringify([
      {
        recordType: 4,
        success: 1,
        serverDate,
        lockDate: serverDate,
      },
    ]);
    const rawBody = `notifyType=1&lockId=${lockId}&records=${encodeURIComponent(records)}`;

    const ack = await receiveCallbackFastAck(rawBody);
    assert.equal(ack.status, 200);
    assert.equal(ack.body, TTLOCK_CALLBACK_SUCCESS_BODY);

    const inbox = await prisma.ttlockCallbackInbox.findFirst({
      where: { externalLockId: lockId },
    });
    assert.ok(inbox);
    assert.equal(inbox!.status, "RECEIVED");

    await simulateAfterProcessing(processCallbackInbox, {
      inboxId: inbox!.id,
      rawBody,
    });
    const final = await pollInboxStatus(prisma, inbox!.id, ["FAILED"]);
    assert.equal(final.status, "FAILED");
    assert.equal(final.lastErrorCode, "TTLOCK_CALLBACK_VERIFY_FAILED");
    assert.equal(final.attempts, 1);
    assert.ok(final.nextRetryAt);
    assert.ok(final.nextRetryAt!.getTime() > Date.now());
  });

  it("DUPLICATE when identical payload is resubmitted before processing", async () => {
    const lockId = uniqueExternalLockId();
    const rawBody = `notifyType=2&lockId=${lockId}&electricQuantity=44&uid=${randomUUID().slice(0, 8)}`;

    const first = await receiveCallbackFastAck(rawBody);
    assert.equal(first.status, 200);
    assert.equal(first.body, TTLOCK_CALLBACK_SUCCESS_BODY);

    const inbox = await prisma.ttlockCallbackInbox.findFirst({
      where: { externalLockId: lockId },
    });
    assert.ok(inbox);
    assert.equal(inbox!.status, "RECEIVED");

    const second = await receiveCallbackFastAck(rawBody);
    assert.equal(second.status, 200);
    assert.equal(second.body, TTLOCK_CALLBACK_SUCCESS_BODY);

    const dup = await pollInboxStatus(prisma, inbox!.id, ["DUPLICATE"]);
    assert.equal(dup.status, "DUPLICATE");
    assert.ok(dup.processedAt);
  });
});
