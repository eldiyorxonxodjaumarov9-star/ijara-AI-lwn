import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { POST as postReminders } from "@/app/api/notifications/payment-reminders/route";
import { prisma } from "@/lib/api-server/prisma";
import {
  computeServerDebts,
  sendTelegramPaymentReminders,
} from "@/lib/api-server/telegram-reminders";

// Real handlers, JWT auth and workspace resolution; only DB I/O and the
// Telegram HTTP call are replaced. No real database or Telegram traffic.
const signingKey = randomBytes(32).toString("hex");
const originalEnv = {
  database: process.env.DATABASE_URL,
  jwt: process.env.JWT_ACCESS_SECRET,
  telegram: process.env.TELEGRAM_BOT_TOKEN,
};
const originalFetch = globalThis.fetch;
const restores: (() => void)[] = [];
function mock(model: object, name: string, impl: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, impl);
  restores.push(() => Reflect.set(model, name, original));
}

const DAY = 86_400_000;
const utcMidnight = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

type DbPayment = {
  id: string;
  contractId: string;
  amount: number;
  paymentDate: Date;
  periodYear: number | null;
  periodMonth: number | null;
  paymentMethod: string;
  createdAt: Date;
};

type Row = {
  id: string;
  workspaceId: string;
  tenantId: string;
  tenantName: string;
  chatId: string | null;
  status: "ACTIVE" | "EXPIRED" | "TERMINATED" | "PENDING";
  start: Date;
  end: Date;
  monthly: number;
  payments: DbPayment[];
};

let rows: Row[] = [];
let contractWheres: Record<string, unknown>[] = [];
let telegramChats: string[] = [];
let telegramTexts: string[] = [];
let deleteWheres: Record<string, unknown>[] = [];
let createdNotifications: Record<string, unknown>[] = [];

function row(partial: Partial<Row> & Pick<Row, "id" | "tenantId">): Row {
  return {
    workspaceId: "workspace-a",
    tenantName: `Tenant ${partial.tenantId}`,
    chatId: `chat-${partial.tenantId}`,
    status: "ACTIVE",
    start: utcMidnight(-70),
    end: utcMidnight(300),
    monthly: 1_000_000,
    payments: [],
    ...partial,
  };
}

function toDb(r: Row) {
  return {
    id: r.id,
    propertyId: `prop-${r.id}`,
    tenantId: r.tenantId,
    startDate: r.start,
    endDate: r.end,
    monthlyRent: r.monthly,
    status: r.status,
    createdAt: r.start,
    property: { title: `Room ${r.id}` },
    tenant: {
      id: r.tenantId,
      fullName: r.tenantName,
      phone: "",
      passport: "",
      rentAmount: r.monthly,
      paymentDueDate: null,
      leftAt: null,
      createdAt: r.start,
    },
    payments: r.payments,
  };
}

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { chat_id: string; text: string };
    telegramChats.push(String(body.chat_id));
    telegramTexts.push(body.text);
    return new Response(JSON.stringify({ ok: true, result: {} }));
  }) as typeof fetch;

  mock(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    email: `${where.id}@example.invalid`,
    role: "ADMIN",
    isActive: true,
    isInternalAccount: false,
  }));
  mock(prisma.workspace, "findFirst", async () => ({ id: "internal", isInternal: true }));
  mock(prisma.user, "findMany", async () => []);
  mock(prisma.workspaceSubscription, "findUnique", async () => ({ status: "ACTIVE" }));
  mock(prisma.company, "findFirst", async () => null);
  for (const model of [prisma.user, prisma.property, prisma.tenant, prisma.contract, prisma.payment,
    prisma.expense, prisma.maintenance, prisma.employee, prisma.partnerCompany, prisma.client,
    prisma.contactLead, prisma.workTask, prisma.notification]) {
    mock(model, "updateMany", async () => ({ count: 0 }));
  }
  mock(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => ({
    role: "OWNER",
    workspace: {
      id: where.userId === "user-a" ? "workspace-a" : "workspace-b",
      isInternal: false,
      subscription: { status: "ACTIVE", demoEndsAt: null },
    },
  }));

  mock(prisma.contract, "findMany", async ({ where }: {
    where: { status: { in: string[] }; workspaceId?: string; tenantId?: string };
  }) => {
    contractWheres.push(where);
    return rows
      .filter((r) => where.status.in.includes(r.status))
      .filter((r) => !where.workspaceId || r.workspaceId === where.workspaceId)
      .filter((r) => !where.tenantId || r.tenantId === where.tenantId)
      .map(toDb);
  });
  mock(prisma.tenant, "findMany", async ({ where }: { where: { id: { in: string[] } } }) => {
    const seen = new Map<string, { id: string; telegramChatId: string | null }>();
    for (const r of rows) {
      if (where.id.in.includes(r.tenantId)) {
        seen.set(r.tenantId, { id: r.tenantId, telegramChatId: r.chatId });
      }
    }
    return [...seen.values()];
  });
  mock(prisma.manualDebt, "findMany", async () => []);
  mock(prisma.notification, "deleteMany", async ({ where }: { where: Record<string, unknown> }) => {
    deleteWheres.push(where);
    return { count: 0 };
  });
  mock(prisma.notification, "create", async ({ data }: { data: Record<string, unknown> }) => {
    const created = { id: `n${createdNotifications.length}`, ...data };
    createdNotifications.push(created);
    return created;
  });
});

after(() => {
  restores.reverse().forEach((restore) => restore());
  globalThis.fetch = originalFetch;
  for (const [key, value] of [
    ["DATABASE_URL", originalEnv.database],
    ["JWT_ACCESS_SECRET", originalEnv.jwt],
    ["TELEGRAM_BOT_TOKEN", originalEnv.telegram],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  rows = [];
  contractWheres = [];
  telegramChats = [];
  telegramTexts = [];
  deleteWheres = [];
  createdNotifications = [];
});

function request(user: string, body: Record<string, unknown> = {}) {
  return new NextRequest("https://example.invalid/api/notifications/payment-reminders", {
    method: "POST",
    headers: {
      authorization: `Bearer ${jwt.sign({ sub: user, workspaceId: "workspace-a" }, signingKey)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function fullPayment(contractId: string, amount: number): DbPayment {
  return {
    id: `pay-${contractId}`,
    contractId,
    amount,
    paymentDate: new Date(),
    periodYear: null,
    periodMonth: null,
    paymentMethod: "CASH",
    createdAt: new Date(),
  };
}

describe("Telegram debt reminders — historical debtors", () => {
  it("12. reminder includes a debtor whose debt is only from previous months (ended contract)", async () => {
    rows = [
      row({
        id: "c-ended",
        tenantId: "t-hist",
        status: "EXPIRED",
        start: utcMidnight(-100),
        end: utcMidnight(-20),
      }),
    ];
    const debts = await computeServerDebts();
    assert.equal(debts.length, 1);
    assert.ok((debts[0]!.unpaidMonths ?? 0) >= 2);
    assert.ok(debts[0]!.oldestUnpaidDueDate);

    const result = await sendTelegramPaymentReminders(debts, "morning");
    assert.deepEqual(result, { sent: 1, skipped: 0, failed: 0 });
    assert.deepEqual(telegramChats, ["chat-t-hist"]);
    assert.match(telegramTexts[0]!, /oy bo‘yicha [\d ]+ so‘m qarzdorlik mavjud/);
    assert.match(telegramTexts[0]!, /Eng eski qarz: /);
    assert.match(telegramTexts[0]!, /kun kechikkan/);
  });

  it("13. fully paid debt → no Telegram reminder", async () => {
    rows = [
      row({ id: "c-paid", tenantId: "t-paid", payments: [fullPayment("c-paid", 10_000_000)] }),
      row({ id: "c-owes", tenantId: "t-owes" }),
    ];
    const debts = await computeServerDebts();
    assert.deepEqual(debts.map((d) => d.tenantId), ["t-owes"]);
    await sendTelegramPaymentReminders(debts);
    assert.deepEqual(telegramChats, ["chat-t-owes"]);
  });

  it("15. one run sends at most one message per debtor / chat", async () => {
    rows = [
      row({ id: "c1", tenantId: "t1" }),
      row({ id: "c2", tenantId: "t1", start: utcMidnight(-40) }),
      row({ id: "c3", tenantId: "t2", chatId: "chat-t1" }),
      row({ id: "c4", tenantId: "t3", chatId: null }),
    ];
    const result = await sendTelegramPaymentReminders(await computeServerDebts());
    assert.deepEqual(telegramChats, ["chat-t1"]);
    assert.equal(result.sent, 1);
    assert.equal(result.skipped, 2);
    assert.equal(result.failed, 0);
  });

  it("send failures are reported as failed, not sent", async () => {
    rows = [row({ id: "c1", tenantId: "t1" })];
    const ok = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, description: "blocked" }))) as typeof fetch;
    try {
      const result = await sendTelegramPaymentReminders(await computeServerDebts());
      assert.deepEqual(result, { sent: 0, skipped: 0, failed: 1 });
    } finally {
      globalThis.fetch = ok;
    }
  });
});

describe("POST /api/notifications/payment-reminders (Barchaga eslatma yuborish)", () => {
  it("14. bulk reminder includes historical unresolved debt and reports sent/skipped/failed", async () => {
    rows = [
      row({
        id: "c-ended",
        tenantId: "t-hist",
        status: "TERMINATED",
        start: utcMidnight(-120),
        end: utcMidnight(-30),
      }),
      row({ id: "c-now", tenantId: "t-now", chatId: null }),
    ];
    const res = await postReminders(request("user-a"));
    assert.equal(res.status, 200);
    const body = (await res.json()).data;
    assert.equal(body.sent, 2);
    assert.equal(body.telegramSent, 1);
    assert.equal(body.telegramSkipped, 1);
    assert.equal(body.telegramFailed, 0);
    assert.deepEqual(telegramChats, ["chat-t-hist"]);

    const late = createdNotifications.filter((n) => n.type === "LATE_PAYMENT");
    assert.equal(late.length, 2);
    assert.ok(late.every((n) => n.workspaceId === "workspace-a"));
    assert.ok(deleteWheres.every((w) => w.workspaceId === "workspace-a"));
  });

  it("16. cross-workspace isolation: only caller's workspace debts, client list ignored", async () => {
    rows = [
      row({ id: "c-a", tenantId: "t-a", workspaceId: "workspace-a" }),
      row({ id: "c-b", tenantId: "t-b", workspaceId: "workspace-b" }),
    ];
    const res = await postReminders(
      request("user-b", {
        dryRun: true,
        debts: [{ contractId: "c-a", tenantId: "t-a", tenantName: "x", propertyName: "y", debt: 1 }],
      })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()).data;
    assert.equal(body.dryRun, true);
    assert.deepEqual(
      body.debts.map((d: { contractId: string }) => d.contractId),
      ["c-b"]
    );
    assert.ok(contractWheres.every((w) => w.workspaceId === "workspace-b"));
    assert.deepEqual(telegramChats, []);
    assert.deepEqual(createdNotifications, []);
  });
});
