import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { POST as postCheckout } from "@/app/api/tenants/[id]/checkout/route";
import { prisma } from "@/lib/api-server/prisma";
import { checkoutTenant } from "@/lib/api-server/tenant-checkout";
import {
  computeServerDebts,
  sendTelegramPaymentReminders,
} from "@/lib/api-server/telegram-reminders";
import {
  checkoutSuccessMessage,
  formatCheckoutDebt,
  previewCheckoutDebt,
} from "@/lib/tenant-checkout-debt";
import type { Contract, Payment, Tenant } from "@/types";

// Real route handler, JWT auth, RBAC and workspace resolution; only DB I/O
// (in-memory) and the Telegram HTTP call are replaced.
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

type DbTenant = {
  id: string;
  workspaceId: string;
  fullName: string;
  phone: string;
  passport: string;
  rentAmount: number;
  paymentDueDate: Date | null;
  leftAt: Date | null;
  createdAt: Date;
  clientNumber: string;
  telegramChatId: string | null;
};
type DbProperty = { id: string; workspaceId: string; title: string; status: string };
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
type DbContract = {
  id: string;
  workspaceId: string;
  tenantId: string;
  propertyId: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  deposit: number;
  depositPaid: boolean;
  notes: string | null;
  status: "ACTIVE" | "PENDING" | "EXPIRED" | "TERMINATED";
  createdAt: Date;
};

let tenants: DbTenant[] = [];
let properties: DbProperty[] = [];
let contracts: DbContract[] = [];
let payments: DbPayment[] = [];
let archives: Record<string, unknown>[] = [];
let telegramChats: string[] = [];

const USERS: Record<string, { workspaceId: string; membership: string }> = {
  "user-admin": { workspaceId: "ws-a", membership: "ADMIN" },
  "user-owner": { workspaceId: "ws-a", membership: "OWNER" },
  "user-b": { workspaceId: "ws-b", membership: "OWNER" },
};

function seedTenant(opts: {
  id: string;
  workspaceId?: string;
  start: Date;
  end: Date;
  monthly?: number;
  status?: DbContract["status"];
  chatId?: string | null;
}) {
  const workspaceId = opts.workspaceId ?? "ws-a";
  tenants.push({
    id: opts.id,
    workspaceId,
    fullName: `Tenant ${opts.id}`,
    phone: "+998900000000",
    passport: "AA0000000",
    rentAmount: opts.monthly ?? 600_000,
    paymentDueDate: null,
    leftAt: null,
    createdAt: opts.start,
    clientNumber: `K-${opts.id}`,
    telegramChatId: opts.chatId === undefined ? `chat-${opts.id}` : opts.chatId,
  });
  properties.push({ id: `room-${opts.id}`, workspaceId, title: `Xona ${opts.id}`, status: "OCCUPIED" });
  contracts.push({
    id: `c-${opts.id}`,
    workspaceId,
    tenantId: opts.id,
    propertyId: `room-${opts.id}`,
    startDate: opts.start,
    endDate: opts.end,
    monthlyRent: opts.monthly ?? 600_000,
    deposit: 0,
    depositPaid: false,
    notes: null,
    status: opts.status ?? "ACTIVE",
    createdAt: opts.start,
  });
}

function pay(tenantId: string, amount: number) {
  payments.push({
    id: `pay-${payments.length}`,
    contractId: `c-${tenantId}`,
    amount,
    paymentDate: new Date(),
    periodYear: null,
    periodMonth: null,
    paymentMethod: "CASH",
    createdAt: new Date(),
  });
}

const tenantById = (id: string) => tenants.find((t) => t.id === id)!;
const contractOf = (id: string) => contracts.find((c) => c.tenantId === id)!;
const roomOf = (id: string) => properties.find((p) => p.id === `room-${id}`)!;

type ContractWhere = {
  id?: string;
  tenantId?: string | { not: string };
  workspaceId?: string;
  propertyId?: string;
  status?: { in: string[] };
};
function matchContract(c: DbContract, where: ContractWhere) {
  if (where.status && !where.status.in.includes(c.status)) return false;
  if (where.workspaceId && c.workspaceId !== where.workspaceId) return false;
  if (where.propertyId && c.propertyId !== where.propertyId) return false;
  if (typeof where.tenantId === "string" && c.tenantId !== where.tenantId) return false;
  if (where.tenantId && typeof where.tenantId === "object" && c.tenantId === where.tenantId.not) {
    return false;
  }
  return true;
}

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { chat_id: string };
    telegramChats.push(String(body.chat_id));
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
  for (const model of [prisma.user, prisma.tenant, prisma.contract, prisma.payment,
    prisma.expense, prisma.maintenance, prisma.employee, prisma.partnerCompany,
    prisma.contactLead, prisma.workTask, prisma.notification]) {
    mock(model, "updateMany", async () => ({ count: 0 }));
  }
  mock(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => {
    const u = USERS[where.userId];
    if (!u) return null;
    return {
      role: u.membership,
      workspace: {
        id: u.workspaceId,
        isInternal: false,
        subscription: { status: "ACTIVE", demoEndsAt: null },
      },
    };
  });

  mock(prisma.tenant, "findFirst", async ({ where }: { where: { id: string; workspaceId: string } }) =>
    tenants.find((t) => t.id === where.id && t.workspaceId === where.workspaceId) ?? null
  );
  mock(prisma.tenant, "findUnique", async ({ where }: { where: { id: string } }) =>
    tenants.find((t) => t.id === where.id) ?? null
  );
  mock(prisma.tenant, "findMany", async ({ where }: { where: { id: { in: string[] } } }) =>
    tenants
      .filter((t) => where.id.in.includes(t.id))
      .map((t) => ({ id: t.id, telegramChatId: t.telegramChatId }))
  );
  mock(prisma.tenant, "update", async ({ where, data }: { where: { id: string }; data: Partial<DbTenant> }) => {
    const t = tenantById(where.id);
    Object.assign(t, data);
    return t;
  });
  mock(prisma.contract, "findMany", async ({ where }: { where: ContractWhere }) =>
    contracts
      .filter((c) => matchContract(c, where))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((c) => ({
        ...c,
        property: properties.find((p) => p.id === c.propertyId)!,
        tenant: tenantById(c.tenantId),
        payments: payments.filter((p) => p.contractId === c.id),
      }))
  );
  mock(prisma.contract, "count", async ({ where }: { where: ContractWhere }) =>
    contracts.filter((c) => matchContract(c, where)).length
  );
  mock(prisma.contract, "update", async ({ where, data }: { where: { id: string }; data: Partial<DbContract> }) => {
    const c = contracts.find((x) => x.id === where.id)!;
    Object.assign(c, data);
    return c;
  });
  mock(prisma.property, "updateMany", async ({ where, data }: {
    where: { id?: string; workspaceId?: string | null };
    data: Partial<DbProperty>;
  }) => {
    const hits = properties.filter(
      (p) => where.id && p.id === where.id && p.workspaceId === where.workspaceId
    );
    hits.forEach((p) => Object.assign(p, data));
    return { count: hits.length };
  });
  mock(prisma.client, "updateMany", async () => ({ count: 0 }));
  mock(prisma.tenantArchive, "create", async ({ data }: { data: Record<string, unknown> }) => {
    const archive = { id: `arch-${archives.length}`, ...data };
    archives.push(archive);
    return archive;
  });
  mock(prisma, "$transaction", async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  mock(prisma.notification, "deleteMany", async () => ({ count: 0 }));
  mock(prisma.notification, "create", async ({ data }: { data: Record<string, unknown> }) => data);
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
  tenants = [];
  properties = [];
  contracts = [];
  payments = [];
  archives = [];
  telegramChats = [];
});

function checkoutRequest(tenantId: string, user?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (user) {
    headers.authorization = `Bearer ${jwt.sign({ sub: user, workspaceId: "ws-a" }, signingKey)}`;
  }
  return postCheckout(
    new NextRequest(`https://example.invalid/api/tenants/${tenantId}/checkout`, {
      method: "POST",
      headers,
      body: "{}",
    }),
    { params: Promise.resolve({ id: tenantId }) }
  );
}

describe("POST /api/tenants/:id/checkout — auth and workspace isolation", () => {
  it("1. ADMIN checkout succeeds and returns preserved debt", async () => {
    seedTenant({ id: "t1", start: utcMidnight(-100), end: utcMidnight(265) });
    const res = await checkoutRequest("t1", "user-admin");
    assert.equal(res.status, 200);
    const body = (await res.json()).data;
    assert.deepEqual(body.closedContractIds, ["c-t1"]);
    assert.deepEqual(body.releasedPropertyIds, ["room-t1"]);
    assert.ok(body.remainingDebt > 0);
    assert.equal(archives.length, 1);
  });

  it("2. workspace OWNER checkout succeeds", async () => {
    seedTenant({ id: "t1", start: utcMidnight(-10), end: utcMidnight(355) });
    const res = await checkoutRequest("t1", "user-owner");
    assert.equal(res.status, 200);
    assert.ok(tenantById("t1").leftAt);
  });

  it("3. unauthenticated → 401, nothing changes", async () => {
    seedTenant({ id: "t1", start: utcMidnight(-10), end: utcMidnight(355) });
    const res = await checkoutRequest("t1");
    assert.equal(res.status, 401);
    assert.equal(tenantById("t1").leftAt, null);
    assert.equal(contractOf("t1").status, "ACTIVE");
    assert.equal(roomOf("t1").status, "OCCUPIED");
  });

  it("4. other workspace tenant → 404, nothing changes", async () => {
    seedTenant({ id: "t1", workspaceId: "ws-a", start: utcMidnight(-10), end: utcMidnight(355) });
    const res = await checkoutRequest("t1", "user-b");
    assert.equal(res.status, 404);
    assert.equal(tenantById("t1").leftAt, null);
    assert.equal(contractOf("t1").status, "ACTIVE");
    assert.equal(roomOf("t1").status, "OCCUPIED");
    assert.equal(archives.length, 0);
  });

  it("second checkout of the same tenant → 409", async () => {
    seedTenant({ id: "t1", start: utcMidnight(-10), end: utcMidnight(355) });
    assert.equal((await checkoutRequest("t1", "user-admin")).status, 200);
    assert.equal((await checkoutRequest("t1", "user-admin")).status, 409);
    assert.equal(archives.length, 1);
  });
});

// Fixed clock: contract from 1 Aug, 600 000/month → Aug, Sep, Oct due by 6 Oct.
const NOW = new Date("2026-10-06T07:00:00.000Z");
const START = new Date("2026-08-01T00:00:00.000Z");
const END = new Date("2027-07-31T00:00:00.000Z");
const LATER = new Date("2026-12-20T07:00:00.000Z");

describe("checkoutTenant — contract, room and debt rules", () => {
  it("5-8. leftAt set, contract TERMINATED at checkout date, room AVAILABLE, assignment removed", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    await checkoutTenant("t1", "ws-a", NOW);

    assert.equal(tenantById("t1").leftAt?.toISOString(), NOW.toISOString());
    assert.equal(contractOf("t1").status, "TERMINATED");
    assert.equal(contractOf("t1").endDate.toISOString(), NOW.toISOString());
    assert.equal(roomOf("t1").status, "AVAILABLE");
    const open = contracts.filter(
      (c) => c.tenantId === "t1" && (c.status === "ACTIVE" || c.status === "PENDING")
    );
    assert.equal(open.length, 0);
  });

  it("contract ending before checkout keeps its earlier end date", async () => {
    const earlyEnd = new Date("2026-09-15T00:00:00.000Z");
    seedTenant({ id: "t1", start: START, end: earlyEnd });
    await checkoutTenant("t1", "ws-a", NOW);
    assert.equal(contractOf("t1").endDate.toISOString(), earlyEnd.toISOString());
  });

  it("room stays occupied if another tenant still holds it", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    contracts.push({ ...contractOf("t1"), id: "c-other", tenantId: "t-other" });
    await checkoutTenant("t1", "ws-a", NOW);
    assert.equal(roomOf("t1").status, "OCCUPIED");
  });

  it("9/10/17. 1 800 000 debt preserved; no new month after checkout", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    seedTenant({ id: "control", start: START, end: END });

    const result = await checkoutTenant("t1", "ws-a", NOW);
    assert.equal(result.remainingDebt, 1_800_000);
    assert.equal(result.unpaidMonths, 3);

    const later = await computeServerDebts({ workspaceId: "ws-a", now: LATER });
    const byTenant = new Map(later.map((d) => [d.tenantId, d.debt]));
    assert.equal(byTenant.get("t1"), 1_800_000);
    assert.equal(byTenant.get("control"), 3_000_000);
  });

  it("11. zero-debt tenant is not in the debt list after checkout", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    pay("t1", 1_800_000);
    const result = await checkoutTenant("t1", "ws-a", NOW);
    assert.equal(result.remainingDebt, 0);
    assert.deepEqual(await computeServerDebts({ workspaceId: "ws-a", now: LATER }), []);
  });

  it("12-14. debtor stays listed; partial payment reduces, full payment clears", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    await checkoutTenant("t1", "ws-a", NOW);

    let debts = await computeServerDebts({ workspaceId: "ws-a", now: LATER });
    assert.deepEqual(debts.map((d) => [d.tenantId, d.debt]), [["t1", 1_800_000]]);

    pay("t1", 500_000);
    debts = await computeServerDebts({ workspaceId: "ws-a", now: LATER });
    assert.deepEqual(debts.map((d) => [d.tenantId, d.debt]), [["t1", 1_300_000]]);

    pay("t1", 1_300_000);
    assert.deepEqual(await computeServerDebts({ workspaceId: "ws-a", now: LATER }), []);
  });

  it("15/16. Telegram: unpaid checked-out debtor reminded, fully paid one is not", async () => {
    seedTenant({ id: "owes", start: START, end: END });
    seedTenant({ id: "paid", start: START, end: END });
    await checkoutTenant("owes", "ws-a", NOW);
    await checkoutTenant("paid", "ws-a", NOW);
    pay("paid", 1_800_000);

    const debts = await computeServerDebts({ workspaceId: "ws-a", now: LATER });
    const result = await sendTelegramPaymentReminders(debts);
    assert.equal(result.sent, 1);
    assert.deepEqual(telegramChats, ["chat-owes"]);
  });
});

describe("checkout modal preview and toast", () => {
  const toClient = (): { c: Contract[]; p: Payment[]; t: Tenant[] } => ({
    c: contracts.map((c) => ({
      id: c.id,
      propertyId: c.propertyId,
      tenantId: c.tenantId,
      propertyName: roomOf(c.tenantId).title,
      tenantName: tenantById(c.tenantId).fullName,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      monthlyPayment: c.monthlyRent,
      status: c.status.toLowerCase() as Contract["status"],
      createdAt: c.createdAt.toISOString(),
    })),
    p: payments.map((p) => ({
      id: p.id,
      contractId: p.contractId,
      tenantId: contracts.find((c) => c.id === p.contractId)!.tenantId,
      amount: p.amount,
      date: p.paymentDate.toISOString(),
      method: "cash",
      createdAt: p.createdAt.toISOString(),
    })),
    t: tenants.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      passport: t.passport,
      rentAmount: t.rentAmount,
      createdAt: t.createdAt.toISOString(),
    })),
  });

  it("preview matches the server result and shows the room", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    const { c, p, t } = toClient();
    const preview = previewCheckoutDebt("t1", c, p, t, NOW);
    assert.equal(preview.remainingDebt, 1_800_000);
    assert.equal(preview.roomName, "Xona t1");
    const result = await checkoutTenant("t1", "ws-a", NOW);
    assert.equal(result.remainingDebt, preview.remainingDebt);
  });

  it("formats the debt and success toast texts", () => {
    assert.equal(formatCheckoutDebt(1_800_000), "1 800 000 UZS");
    assert.equal(formatCheckoutDebt(0), "0 UZS");
    assert.equal(
      checkoutSuccessMessage(1_800_000),
      "Ijarachi xonadan chiqarildi. 1 800 000 UZS qarzdorlik saqlandi."
    );
    assert.equal(checkoutSuccessMessage(0), "Ijarachi xonadan chiqarildi. Qarzdorlik mavjud emas.");
  });
});
