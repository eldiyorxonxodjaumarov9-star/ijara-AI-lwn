import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { GET as listRoute, POST as createRoute } from "@/app/api/manual-debts/route";
import { GET as getRoute, PATCH as patchRoute } from "@/app/api/manual-debts/[id]/route";
import { POST as payRoute } from "@/app/api/manual-debts/[id]/payments/route";
import { POST as cancelRoute } from "@/app/api/manual-debts/[id]/cancel/route";
import { POST as postReminders } from "@/app/api/notifications/payment-reminders/route";
import { computeManualDebtReminders } from "@/lib/api-server/manual-debts";
import { prisma } from "@/lib/api-server/prisma";
import { sendTelegramPaymentReminders } from "@/lib/api-server/telegram-reminders";
import {
  isActiveManualDebt,
  summarizeAllDebts,
  type ManualDebtView,
} from "@/lib/manual-debts";

// Real route handlers, JWT auth and workspace resolution; Prisma I/O is an
// in-memory store and the Telegram HTTP call is stubbed.
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

type Row = Record<string, unknown> & { id: string };

let debts: Row[] = [];
let debtPayments: Row[] = [];
let legacyPaymentWrites = 0;
let contractWrites = 0;
let telegramChats: string[] = [];
let telegramTexts: string[] = [];
let seq = 0;

const properties: Row[] = [
  { id: "prop-a205", workspaceId: "workspace-a", title: "205 Room" },
  { id: "prop-b1", workspaceId: "workspace-b", title: "B Room" },
];
const tenants: Row[] = [
  { id: "ten-a", workspaceId: "workspace-a", phone: "+998901112233", telegramChatId: "chat-a" },
  { id: "ten-b", workspaceId: "workspace-b", phone: "+998907778899", telegramChatId: "chat-b" },
];

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c) return (c.in as unknown[]).includes(value);
      if ("gt" in c) return Number(value) > Number(c.gt);
      if ("lte" in c) return (value as Date).getTime() <= (c.lte as Date).getTime();
      if ("not" in c) return value !== c.not && value !== undefined;
      return false;
    }
    return value === cond;
  });
}

function withIncludes(row: Row, include?: Record<string, unknown>) {
  const out: Row = { ...row };
  if (include?.property) {
    const p = properties.find((x) => x.id === row.propertyId);
    out.property = p ? { title: p.title } : null;
  }
  if (include?.payments) out.payments = debtPayments.filter((p) => p.manualDebtId === row.id);
  return out;
}

function token(userId: string) {
  return jwt.sign({ sub: userId, email: `${userId}@example.invalid`, role: "ADMIN" }, signingKey, {
    expiresIn: "1h",
  });
}

function req(method: string, path: string, userId: string | null, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(userId ? { authorization: `Bearer ${token(userId)}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function json(res: Response) {
  const body = (await res.json()) as { data?: unknown; message?: string; error?: { code?: string } };
  return { data: body.data, message: body.message, code: body.error?.code };
}

async function create(body: Record<string, unknown>, userId = "user-a") {
  const res = await createRoute(req("POST", "/api/manual-debts", userId, body));
  return { res, body: await json(res) };
}

const base = {
  propertyId: "prop-a205",
  debtorName: "Test Logistics",
  debtorPhone: "90 111 22 33",
  debtorOccupation: "Logistika",
  originalAmount: 2_000_000,
  debtDate: "2026-10-01",
  description: "Eski qarz",
};

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
    role: where.id.startsWith("employee") ? "EMPLOYEE" : "ADMIN",
    isActive: true,
    isInternalAccount: false,
  }));
  mock(prisma.workspace, "findFirst", async () => ({ id: "internal", isInternal: true }));
  mock(prisma.user, "findMany", async () => []);
  mock(prisma.workspaceSubscription, "findUnique", async () => ({ status: "ACTIVE" }));
  mock(prisma.company, "findFirst", async () => null);
  for (const model of [prisma.user, prisma.property, prisma.tenant, prisma.contract,
    prisma.expense, prisma.maintenance, prisma.employee, prisma.partnerCompany, prisma.client,
    prisma.contactLead, prisma.workTask, prisma.notification]) {
    mock(model, "updateMany", async () => ({ count: 0 }));
  }
  mock(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => ({
    role: "OWNER",
    workspace: {
      id: where.userId.endsWith("-b") ? "workspace-b" : "workspace-a",
      isInternal: false,
      subscription: { status: "ACTIVE", demoEndsAt: null },
    },
  }));

  mock(prisma.property, "findFirst", async ({ where }: { where: Record<string, unknown> }) =>
    properties.find((p) => matches(p, where)) ?? null
  );
  mock(prisma.tenant, "findMany", async ({ where }: { where: Record<string, unknown> }) =>
    tenants.filter((t) => matches(t, where))
  );
  mock(prisma.contract, "findMany", async () => []);
  mock(prisma.contract, "create", async () => {
    contractWrites += 1;
    return {};
  });
  mock(prisma.payment, "create", async () => {
    legacyPaymentWrites += 1;
    return {};
  });
  mock(prisma.payment, "updateMany", async () => ({ count: 0 }));
  mock(prisma.notification, "deleteMany", async () => ({ count: 0 }));
  mock(prisma.notification, "create", async ({ data }: { data: Record<string, unknown> }) => ({
    id: `n-${++seq}`,
    ...data,
  }));

  mock(prisma.manualDebt, "findFirst", async (args: { where: Record<string, unknown>; include?: Record<string, unknown> }) => {
    const row = debts.find((d) => matches(d, args.where));
    return row ? withIncludes(row, args.include) : null;
  });
  mock(prisma.manualDebt, "findMany", async (args: { where: Record<string, unknown>; include?: Record<string, unknown> }) =>
    debts.filter((d) => matches(d, args.where)).map((d) => withIncludes(d, args.include))
  );
  mock(prisma.manualDebt, "create", async (args: { data: Record<string, unknown>; include?: Record<string, unknown> }) => {
    const now = new Date();
    const row: Row = {
      id: `md-${++seq}`,
      notes: null,
      closedAt: null,
      cancelledAt: null,
      cancelledById: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
      ...args.data,
    };
    debts.push(row);
    return withIncludes(row, args.include);
  });
  mock(prisma.manualDebt, "updateMany", async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const hits = debts.filter((d) => matches(d, args.where));
    for (const d of hits) {
      for (const [k, v] of Object.entries(args.data)) if (v !== undefined) d[k] = v;
    }
    return { count: hits.length };
  });
  mock(prisma.manualDebt, "delete", async () => {
    throw new Error("manual debts must never be deleted");
  });
  mock(prisma.manualDebtPayment, "create", async ({ data }: { data: Record<string, unknown> }) => {
    const row: Row = { id: `mdp-${++seq}`, createdAt: new Date(), ...data };
    debtPayments.push(row);
    return row;
  });
  mock(prisma, "$transaction", async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
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
  debts = [];
  debtPayments = [];
  legacyPaymentWrites = 0;
  contractWrites = 0;
  telegramChats = [];
  telegramTexts = [];
});

describe("Manual debts — create", () => {
  it("1/2/6/7/8. creates with room, occupation, phone and date; no contract or Payment rows", async () => {
    const { res, body } = await create({ ...base, workspaceId: "workspace-b" });
    assert.equal(res.status, 201);
    const d = body.data as ManualDebtView;
    assert.equal(d.propertyId, "prop-a205");
    assert.equal(d.propertyName, "205 Room");
    assert.equal(d.debtorName, "Test Logistics");
    assert.equal(d.debtorOccupation, "Logistika");
    assert.equal(d.debtorPhone, "+998901112233");
    assert.equal(d.debtDate, "2026-10-01");
    assert.equal(d.description, "Eski qarz");
    assert.equal(d.originalAmount, 2_000_000);
    assert.equal(d.paidAmount, 0);
    assert.equal(d.remainingAmount, 2_000_000);
    assert.equal(d.status, "OPEN");
    assert.equal(debts[0]!.workspaceId, "workspace-a", "client workspaceId ignored");
    assert.equal(debts[0]!.createdById, "user-a");
    assert.equal(contractWrites, 0);
    assert.equal(legacyPaymentWrites, 0);
  });

  it("2. a room from another workspace is rejected", async () => {
    const { res } = await create({ ...base, propertyId: "prop-b1" });
    assert.equal(res.status, 404);
    assert.equal(debts.length, 0);
  });

  it("3. room is optional and renders as unassigned", async () => {
    const { res, body } = await create({ ...base, propertyId: null });
    assert.equal(res.status, 201);
    const d = body.data as ManualDebtView;
    assert.equal(d.propertyId, null);
    assert.equal(d.propertyName, null);
  });

  it("4. debtor name is required", async () => {
    const { res, body } = await create({ ...base, debtorName: "   " });
    assert.equal(res.status, 400);
    assert.match(String(body.message), /Qarzdor nomi/);
  });

  it("5. amount must be > 0", async () => {
    for (const originalAmount of [0, -5, "abc"]) {
      const { res } = await create({ ...base, originalAmount });
      assert.equal(res.status, 400);
    }
    assert.equal(debts.length, 0);
  });

  it("7. invalid phone is rejected", async () => {
    const { res } = await create({ ...base, debtorPhone: "12345" });
    assert.equal(res.status, 400);
  });

  it("23. unauthenticated requests get 401", async () => {
    assert.equal((await listRoute(req("GET", "/api/manual-debts", null))).status, 401);
    assert.equal((await createRoute(req("POST", "/api/manual-debts", null, base))).status, 401);
    assert.equal((await payRoute(req("POST", "/api/manual-debts/x/payments", null, { amount: 1 }), ctx("x"))).status, 401);
  });

  it("EMPLOYEE can read but not create", async () => {
    assert.equal((await listRoute(req("GET", "/api/manual-debts", "employee-a"))).status, 200);
    const { res } = await create(base, "employee-a");
    assert.equal(res.status, 403);
  });
});

describe("Manual debts — list and KPI", () => {
  it("9. appears in the workspace list", async () => {
    await create(base);
    const res = await listRoute(req("GET", "/api/manual-debts", "user-a"));
    const list = (await json(res)).data as ManualDebtView[];
    assert.equal(list.length, 1);
    assert.equal(list[0]!.debtorName, "Test Logistics");
  });

  it("10/11. KPI adds active manual debts once, on top of contract debt", () => {
    const contract = { totalDebtAmount: 3_000_000, debtorContractCount: 2 };
    const manual = [
      { id: "m1", status: "OPEN" as const, remainingAmount: 2_000_000 },
      { id: "m1", status: "OPEN" as const, remainingAmount: 2_000_000 },
      { id: "m2", status: "PARTIAL" as const, remainingAmount: 500_000 },
      { id: "m3", status: "PAID" as const, remainingAmount: 0 },
      { id: "m4", status: "CANCELLED" as const, remainingAmount: 900_000 },
    ];
    const s = summarizeAllDebts(contract, manual);
    assert.equal(s.totalDebtAmount, 5_500_000);
    assert.equal(s.debtRecordCount, 4);
    assert.equal(s.manualDebtCount, 2);
    assert.deepEqual(summarizeAllDebts(contract, []), {
      totalDebtAmount: 3_000_000,
      debtRecordCount: 2,
      manualDebtCount: 0,
      manualDebtAmount: 0,
    });
  });
});

describe("Manual debts — payments, edit, cancel", () => {
  async function seeded() {
    const { body } = await create(base);
    return (body.data as ManualDebtView).id;
  }
  const pay = (id: string, amount: number, userId = "user-a") =>
    payRoute(req("POST", `/api/manual-debts/${id}/payments`, userId, { amount, paymentDate: "2026-10-06" }), ctx(id));

  it("12. partial payment → PARTIAL with remaining", async () => {
    const id = await seeded();
    const res = await pay(id, 500_000);
    assert.equal(res.status, 201);
    const d = (await json(res)).data as ManualDebtView;
    assert.equal(d.status, "PARTIAL");
    assert.equal(d.paidAmount, 500_000);
    assert.equal(d.remainingAmount, 1_500_000);
    assert.equal(debtPayments.length, 1);
    assert.equal(debtPayments[0]!.workspaceId, "workspace-a");
    assert.equal(legacyPaymentWrites, 0, "no legacy Payment rows");
  });

  it("13/14. full payment → PAID, closedAt set, leaves the active list", async () => {
    const id = await seeded();
    await pay(id, 500_000);
    const res = await pay(id, 1_500_000);
    const d = (await json(res)).data as ManualDebtView;
    assert.equal(d.status, "PAID");
    assert.equal(d.remainingAmount, 0);
    assert.ok(d.closedAt);
    assert.equal(d.payments?.length, 2);
    assert.equal(isActiveManualDebt(d), false);
    const active = (await json(await listRoute(req("GET", "/api/manual-debts?active=1", "user-a")))).data as ManualDebtView[];
    assert.equal(active.length, 0);
    assert.equal((await pay(id, 1)).status, 409, "closed debt takes no more payments");
  });

  it("24. overpayment is rejected and nothing changes", async () => {
    const id = await seeded();
    const res = await pay(id, 2_000_001);
    assert.equal(res.status, 400);
    assert.equal((await json(res)).code, "OVERPAYMENT");
    assert.equal(debts[0]!.paidAmount, 0);
    assert.equal(debtPayments.length, 0);
  });

  it("25. originalAmount below paid is rejected", async () => {
    const id = await seeded();
    await pay(id, 800_000);
    const res = await patchRoute(req("PATCH", `/api/manual-debts/${id}`, "user-a", { originalAmount: 700_000 }), ctx(id));
    assert.equal(res.status, 409);
    assert.equal((await json(res)).message, "Qarz summasi to‘langan summadan kam bo‘lishi mumkin emas");
    const ok = await patchRoute(
      req("PATCH", `/api/manual-debts/${id}`, "user-a", { originalAmount: 1_000_000, workspaceId: "workspace-b", createdById: "x" }),
      ctx(id)
    );
    assert.equal(ok.status, 200);
    const d = (await json(ok)).data as ManualDebtView;
    assert.equal(d.remainingAmount, 200_000);
    assert.equal(d.status, "PARTIAL");
    assert.equal(debts[0]!.workspaceId, "workspace-a");
    assert.equal(debts[0]!.createdById, "user-a");
  });

  it("26. cancel keeps the row, amounts and payment history", async () => {
    const id = await seeded();
    await pay(id, 300_000);
    const res = await cancelRoute(req("POST", `/api/manual-debts/${id}/cancel`, "user-a", { reason: "Kelishildi" }), ctx(id));
    assert.equal(res.status, 200);
    const d = (await json(res)).data as ManualDebtView;
    assert.equal(d.status, "CANCELLED");
    assert.equal(d.cancelReason, "Kelishildi");
    assert.ok(d.cancelledAt);
    assert.equal(d.paidAmount, 300_000);
    assert.equal(d.payments?.length, 1);
    assert.equal(debts.length, 1);
    assert.equal(debts[0]!.cancelledById, "user-a");
    assert.equal((await pay(id, 1)).status, 409);
    const again = await cancelRoute(req("POST", `/api/manual-debts/${id}/cancel`, "user-a", {}), ctx(id));
    assert.equal(again.status, 409);
  });
});

describe("Manual debts — workspace isolation", () => {
  async function seededA() {
    const { body } = await create(base);
    return (body.data as ManualDebtView).id;
  }

  it("20. workspace B cannot read workspace A debts", async () => {
    const id = await seededA();
    assert.equal((await getRoute(req("GET", `/api/manual-debts/${id}`, "user-b"), ctx(id))).status, 404);
    const list = (await json(await listRoute(req("GET", "/api/manual-debts", "user-b")))).data as ManualDebtView[];
    assert.equal(list.length, 0);
  });

  it("21. workspace B cannot pay workspace A debts", async () => {
    const id = await seededA();
    const res = await payRoute(req("POST", `/api/manual-debts/${id}/payments`, "user-b", { amount: 100 }), ctx(id));
    assert.equal(res.status, 404);
    assert.equal(debts[0]!.paidAmount, 0);
    assert.equal(debtPayments.length, 0);
  });

  it("22. workspace B cannot edit or cancel workspace A debts", async () => {
    const id = await seededA();
    const patch = await patchRoute(req("PATCH", `/api/manual-debts/${id}`, "user-b", { debtorName: "Hijack" }), ctx(id));
    assert.equal(patch.status, 404);
    const cancel = await cancelRoute(req("POST", `/api/manual-debts/${id}/cancel`, "user-b", {}), ctx(id));
    assert.equal(cancel.status, 404);
    assert.equal(debts[0]!.debtorName, "Test Logistics");
    assert.equal(debts[0]!.status, "OPEN");
  });
});

describe("Manual debts — Telegram reminders", () => {
  const NOW = new Date("2026-10-06T10:00:00Z");

  it("15/16/17. OPEN and PARTIAL are eligible; PAID and CANCELLED are not", async () => {
    const { body: a } = await create({ ...base, debtorName: "Open Co" });
    const { body: b } = await create({ ...base, debtorName: "Partial Co" });
    const { body: c } = await create({ ...base, debtorName: "Paid Co" });
    const { body: d } = await create({ ...base, debtorName: "Cancelled Co" });
    const [ida, idb, idc, idd] = [a, b, c, d].map((x) => (x.data as ManualDebtView).id);
    await payRoute(req("POST", `/api/manual-debts/${idb}/payments`, "user-a", { amount: 500_000 }), ctx(idb!));
    await payRoute(req("POST", `/api/manual-debts/${idc}/payments`, "user-a", { amount: 2_000_000 }), ctx(idc!));
    await cancelRoute(req("POST", `/api/manual-debts/${idd}/cancel`, "user-a", {}), ctx(idd!));

    const targets = await computeManualDebtReminders({ workspaceId: "workspace-a", now: NOW });
    assert.deepEqual(targets.map((t) => t.manualDebtId).sort(), [ida, idb].sort());
    assert.equal(targets.find((t) => t.manualDebtId === idb)!.remainingAmount, 1_500_000);
  });

  it("future-dated debts wait until their date", async () => {
    await create({ ...base, debtDate: "2026-12-01" });
    assert.equal((await computeManualDebtReminders({ workspaceId: "workspace-a", now: NOW })).length, 0);
  });

  it("19. chat is resolved only from same-workspace tenants", async () => {
    await create({ ...base, debtorPhone: "90 777 88 99" });
    const { body } = await create({ ...base, debtorPhone: "90 111 22 33", debtorName: "Linked" });
    assert.equal((body.data as ManualDebtView).telegramLinked, true);
    assert.equal(debts[0]!.telegramChatId, null, "workspace-b tenant phone must not link");

    const targets = await computeManualDebtReminders({ workspaceId: "workspace-a", now: NOW });
    const chats = targets.map((t) => t.chatId);
    assert.ok(!chats.includes("chat-b"));
    assert.ok(chats.includes("chat-a"));
  });

  it("message format and skip without chat", async () => {
    await create({ ...base, originalAmount: 1_500_000, debtorPhone: "90 111 22 33" });
    await create({ ...base, debtorName: "No Chat", debtorPhone: null });
    const targets = await computeManualDebtReminders({ workspaceId: "workspace-a", now: NOW });
    const result = await sendTelegramPaymentReminders([], undefined, targets);
    assert.equal(result.sent, 1);
    assert.equal(result.skipped, 1);
    assert.deepEqual(telegramChats, ["chat-a"]);
    const text = telegramTexts[0]!;
    assert.match(text, /Sizda 1 500 000 so‘m qarzdorlik mavjud\./);
    assert.match(text, /Xona: 205 Room/);
    assert.match(text, /Faoliyat: Logistika/);
    assert.match(text, /Qarzdorlik sanasi: 2026-10-01/);
  });

  it("18. bulk reminder includes manual debts; dry run sends nothing", async () => {
    await create({ ...base, debtDate: "2026-01-01" });
    await create({ ...base, debtorName: "No Chat", debtorPhone: null, debtDate: "2026-01-01" });

    const dry = await postReminders(req("POST", "/api/notifications/payment-reminders", "user-a", { dryRun: true }));
    const dryData = (await json(dry)).data as { recipients: number; totalDebt: number; manualDebts: { telegramLinked: boolean; chatId?: string }[] };
    assert.equal(dryData.recipients, 2);
    assert.equal(dryData.totalDebt, 4_000_000);
    assert.deepEqual(dryData.manualDebts.map((m) => m.telegramLinked).sort(), [false, true]);
    assert.ok(dryData.manualDebts.every((m) => m.chatId === undefined), "chat ids are not exposed");
    assert.equal(telegramChats.length, 0);

    const res = await postReminders(req("POST", "/api/notifications/payment-reminders", "user-a", {}));
    const data = (await json(res)).data as { sent: number; telegramSent: number; telegramSkipped: number };
    assert.equal(data.sent, 2);
    assert.equal(data.telegramSent, 1);
    assert.equal(data.telegramSkipped, 1);
    assert.deepEqual(telegramChats, ["chat-a"]);
  });

  it("18. bulk reminder in workspace B never sees workspace A debts", async () => {
    await create({ ...base, debtDate: "2026-01-01" });
    const res = await postReminders(req("POST", "/api/notifications/payment-reminders", "user-b", { dryRun: true }));
    const data = (await json(res)).data as { recipients: number; manualDebts: unknown[] };
    assert.equal(data.recipients, 0);
    assert.equal(data.manualDebts.length, 0);
  });
});
