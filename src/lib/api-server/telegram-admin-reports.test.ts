import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";

import { POST as telegramWebhook } from "@/app/api/telegram/webhook/route";
import { GET as agentDailySnapshot } from "@/app/api/internal/agent/v1/daily-snapshot/route";
import { GET as superAdminDashboard } from "@/app/api/super-admin/dashboard/route";
import { buildDailySnapshot } from "@/lib/api-server/agent-gateway/daily-snapshot";
import { prisma } from "@/lib/api-server/prisma";
import {
  getAdminDashboardRows,
  getAdminRowsForOwner,
  sendAdminReportsToAll,
} from "@/lib/api-server/telegram-admin";

// Only DB I/O and the Telegram HTTP call are replaced — no real DB or Telegram traffic.
const originalEnv = {
  database: process.env.DATABASE_URL,
  telegram: process.env.TELEGRAM_BOT_TOKEN,
  webhook: process.env.TELEGRAM_WEBHOOK_SECRET,
};
const originalFetch = globalThis.fetch;
const restores: (() => void)[] = [];
function mock(model: object, name: string, impl: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, impl);
  restores.push(() => Reflect.set(model, name, original));
}

const DAY = 86_400_000;
const start = new Date(Date.now() - 70 * DAY);
const end = new Date(Date.now() + 300 * DAY);

type TenantRow = { id: string; workspaceId: string; fullName: string; phone: string; rent: number };
const TENANTS: TenantRow[] = [
  { id: "ta", workspaceId: "ws-a", fullName: "Alpha Tenant", phone: "+998900000001", rent: 1_000_000 },
  { id: "tb", workspaceId: "ws-b", fullName: "Bravo Tenant", phone: "+998900000002", rent: 2_000_000 },
  { id: "ti", workspaceId: "ws-internal", fullName: "Internal Tenant", phone: "+998900000003", rent: 3_000_000 },
];

const USERS = {
  "user-a": { id: "user-a", email: "a@example.invalid", role: "ADMIN", isActive: true, isInternalAccount: false, fullName: "Owner A", telegramAdminChatId: null },
  "user-b": { id: "user-b", email: "b@example.invalid", role: "ADMIN", isActive: true, isInternalAccount: false, fullName: "Owner B", telegramAdminChatId: null },
  "user-x": { id: "user-x", email: "x@example.invalid", role: "MANAGER", isActive: true, isInternalAccount: false, fullName: "No WS", telegramAdminChatId: null },
} as const;
const MEMBERSHIP: Record<string, string | undefined> = { "user-a": "ws-a", "user-b": "ws-b" };

let devices: { chatId: string; userId: keyof typeof USERS }[] = [];
let tenantWheres: Record<string, unknown>[] = [];
let scopedWheres: { model: string; where: Record<string, unknown> }[] = [];
let sent: { chatId: string; text: string }[] = [];

let contractWheres: Record<string, unknown>[] = [];

function tenantFindMany({ where, include }: {
  where: { workspaceId?: string; leftAt: null };
  include?: { contracts?: { where?: Record<string, unknown> } };
}) {
  tenantWheres.push(where);
  contractWheres.push(include?.contracts?.where ?? {});
  return TENANTS.filter((t) => t.workspaceId === where.workspaceId).map((t) => ({
    id: t.id,
    fullName: t.fullName,
    phone: t.phone,
    passport: "",
    rentAmount: t.rent,
    paymentDueDate: null,
    createdAt: start,
    contracts: [
      {
        id: `c-${t.id}`,
        propertyId: `p-${t.id}`,
        startDate: start,
        endDate: end,
        monthlyRent: t.rent,
        deposit: null,
        depositPaid: false,
        status: "ACTIVE",
        notes: null,
        createdAt: start,
        property: { title: `Room ${t.id.toUpperCase()}` },
        payments: [],
      },
    ],
  }));
}

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_WEBHOOK_SECRET = "hook-secret";

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { chat_id: string; text: string };
    sent.push({ chatId: String(body.chat_id), text: body.text });
    return new Response(JSON.stringify({ ok: true, result: {} }));
  }) as typeof fetch;

  mock(prisma.tenant, "findMany", async (args: never) => tenantFindMany(args));
  mock(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => {
    const ws = MEMBERSHIP[where.userId];
    return ws
      ? { role: "OWNER", workspace: { id: ws, isInternal: false, subscription: { status: "ACTIVE", demoEndsAt: null } } }
      : null;
  });
  // Bootstrap (resolveUserWorkspaceContext) — no internal attach for ADMIN/MANAGER without membership.
  mock(prisma.workspace, "findFirst", async () => ({ id: "ws-internal", isInternal: true }));
  mock(prisma.workspace, "findFirstOrThrow", async () => { throw new Error("no internal attach"); });
  mock(prisma.workspace, "create", async () => { throw new Error("must not create workspaces"); });
  mock(prisma.user, "findMany", async () => []);
  mock(prisma.workspaceSubscription, "findUnique", async () => ({ status: "ACTIVE" }));
  mock(prisma.company, "findFirst", async () => null);
  for (const model of [prisma.user, prisma.property, prisma.tenant, prisma.contract, prisma.payment,
    prisma.expense, prisma.maintenance, prisma.employee, prisma.partnerCompany, prisma.client,
    prisma.contactLead, prisma.workTask, prisma.notification]) {
    mock(model, "updateMany", async () => ({ count: 0 }));
  }

  mock(prisma.telegramAdminDevice, "findMany", async () =>
    devices.map((d) => ({ chatId: d.chatId, user: USERS[d.userId] }))
  );
  mock(prisma.telegramAdminDevice, "findUnique", async ({ where }: { where: { chatId: string } }) => {
    const d = devices.find((x) => x.chatId === where.chatId);
    return d ? { chatId: d.chatId, userId: d.userId, user: USERS[d.userId] } : null;
  });
  mock(prisma.user, "findFirst", async () => null);

  // Telegram session for the webhook flow — chat is already in owner mode.
  mock(prisma.telegramSession, "findUnique", async ({ where }: { where: { chatId: string } }) => ({
    chatId: where.chatId, mode: "owner", wizardJson: null, expiresAt: null, ownerUserId: null,
  }));
  mock(prisma.telegramSession, "upsert", async () => ({}));
  mock(prisma.telegramSession, "update", async () => ({}));
  mock(prisma, "$transaction", async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ telegramProcessedUpdate: { create: async () => ({}) } })
  );
  mock(prisma.telegramBotUser, "upsert", async () => ({}));
  mock(prisma.telegramBotUser, "findUnique", async () => null);

  for (const [model, name] of [[prisma.property, "property"], [prisma.payment, "payment"], [prisma.expense, "expense"]] as const) {
    mock(model, "count", async ({ where }: { where: Record<string, unknown> }) => {
      scopedWheres.push({ model: name, where });
      return 0;
    });
    mock(model, "findMany", async ({ where }: { where: Record<string, unknown> }) => {
      scopedWheres.push({ model: name, where });
      return [];
    });
  }
});

after(() => {
  restores.reverse().forEach((restore) => restore());
  globalThis.fetch = originalFetch;
  for (const [key, value] of [
    ["DATABASE_URL", originalEnv.database],
    ["TELEGRAM_BOT_TOKEN", originalEnv.telegram],
    ["TELEGRAM_WEBHOOK_SECRET", originalEnv.webhook],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  devices = [];
  tenantWheres = [];
  contractWheres = [];
  scopedWheres = [];
  sent = [];
});

describe("getAdminDashboardRows — workspace scoped", () => {
  it("workspace A report contains only A data", async () => {
    const rows = await getAdminDashboardRows({ workspaceId: "ws-a" });
    assert.deepEqual(rows.map((r) => r.fullName), ["Alpha Tenant"]);
    assert.ok(rows[0]!.debtAmount > 0);
    assert.equal(tenantWheres[0]!.workspaceId, "ws-a");
    assert.equal(contractWheres[0]!.workspaceId, "ws-a");
  });

  it("workspace B report contains only B data", async () => {
    const rows = await getAdminDashboardRows({ workspaceId: "ws-b" });
    assert.deepEqual(rows.map((r) => r.fullName), ["Bravo Tenant"]);
  });

  it("there is no unscoped (global) mode", async () => {
    await assert.rejects(
      () => getAdminDashboardRows({} as { workspaceId: string }),
      /workspaceId/
    );
    assert.equal(tenantWheres.length, 0);
  });

  it("owner workspace comes from server-side membership", async () => {
    const rowsA = await getAdminRowsForOwner(USERS["user-a"] as never);
    assert.deepEqual(rowsA.map((r) => r.id), ["ta"]);
    const rowsB = await getAdminRowsForOwner(USERS["user-b"] as never);
    assert.deepEqual(rowsB.map((r) => r.id), ["tb"]);
  });
});

describe("Telegram bot owner menu (webhook)", () => {
  function update(chatId: string, text: string) {
    return new NextRequest("https://example.invalid/api/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "hook-secret" },
      body: JSON.stringify({
        update_id: 1,
        message: { message_id: 1, date: 0, chat: { id: chatId, type: "private" }, from: { id: 1 }, text },
      }),
    });
  }

  it("A admin sees only A debts/tenants — never B", async () => {
    devices = [
      { chatId: "chat-a", userId: "user-a" },
      { chatId: "chat-b", userId: "user-b" },
    ];
    for (const text of ["📊 Umumiy hisobot", "⚠️ Qarzdorlar", "📋 Arendatorlar"]) {
      sent = [];
      const res = await telegramWebhook(update("chat-a", text));
      assert.equal(res.status, 200);
      const all = sent.map((s) => s.text).join("\n");
      assert.ok(sent.every((s) => s.chatId === "chat-a"));
      assert.match(all, /Alpha Tenant/);
      assert.doesNotMatch(all, /Bravo Tenant|Internal Tenant|\+998900000002/);
    }
  });

  it("unauthenticated webhook call (no / wrong secret) is rejected", async () => {
    const res = await telegramWebhook(
      new NextRequest("https://example.invalid/api/telegram/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "wrong" },
        body: "{}",
      })
    );
    assert.equal(res.status, 403);
    assert.equal(sent.length, 0);
  });
});

describe("sendAdminReportsToAll — per-recipient workspace", () => {
  it("each chat receives only its own workspace report, once", async () => {
    devices = [
      { chatId: "chat-a1", userId: "user-a" },
      { chatId: "chat-a2", userId: "user-a" },
      { chatId: "chat-b", userId: "user-b" },
    ];
    const result = await sendAdminReportsToAll("08:00 (ertalab)");
    assert.deepEqual(result, { sent: 3, skipped: 0, workspaces: 2 });
    assert.deepEqual(sent.map((s) => s.chatId).sort(), ["chat-a1", "chat-a2", "chat-b"]);
    for (const s of sent) {
      if (s.chatId.startsWith("chat-a")) {
        assert.match(s.text, /Alpha Tenant/);
        assert.doesNotMatch(s.text, /Bravo Tenant|Internal Tenant/);
      } else {
        assert.match(s.text, /Bravo Tenant/);
        assert.doesNotMatch(s.text, /Alpha Tenant|Internal Tenant/);
      }
      assert.match(s.text, /^08:00 \(ertalab\)/);
    }
    // One rows query per workspace, not per chat.
    assert.deepEqual(tenantWheres.map((w) => w.workspaceId).sort(), ["ws-a", "ws-b"]);
  });

  it("no duplicate report for the same chat in one run", async () => {
    devices = [
      { chatId: "chat-a", userId: "user-a" },
      { chatId: "chat-a", userId: "user-a" },
    ];
    const result = await sendAdminReportsToAll();
    assert.equal(result.sent, 1);
    assert.equal(sent.length, 1);
  });

  it("recipient without resolvable workspace is skipped — no global fallback", async () => {
    devices = [{ chatId: "chat-x", userId: "user-x" }];
    const result = await sendAdminReportsToAll();
    assert.deepEqual(result, { sent: 0, skipped: 1, workspaces: 0 });
    assert.equal(sent.length, 0);
    assert.equal(tenantWheres.length, 0);
  });
});

describe("Agent daily snapshot (internal LWN agent)", () => {
  it("is scoped to the internal workspace for rows, rooms, payments and expenses", async () => {
    const snapshot = await buildDailySnapshot(new Date());
    assert.deepEqual(snapshot.payments.items.map((i) => i.fullName), ["Internal Tenant"]);
    assert.deepEqual(tenantWheres.map((w) => w.workspaceId), ["ws-internal"]);
    assert.ok(scopedWheres.length >= 5);
    assert.ok(scopedWheres.every((w) => w.where.workspaceId === "ws-internal"));
  });

  it("unauthenticated agent call is rejected", async () => {
    const res = await agentDailySnapshot(
      new NextRequest("https://example.invalid/api/internal/agent/v1/daily-snapshot")
    );
    // 401 without token; 503 when the gateway is fail-closed (not configured).
    assert.ok([401, 503].includes(res.status), String(res.status));
    assert.equal(tenantWheres.length, 0);
    assert.equal(scopedWheres.length, 0);
  });
});

describe("Platform-level global summary", () => {
  it("is only available via the separate Platform Admin dashboard and rejects without a platform session", async () => {
    const res = await superAdminDashboard(
      new NextRequest("https://example.invalid/api/super-admin/dashboard")
    );
    assert.equal(res.status, 401);
  });
});
