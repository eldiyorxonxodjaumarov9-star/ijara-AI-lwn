import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { GET as getCollection } from "@/app/api/[resource]/route";
import { POST as postCheckout } from "@/app/api/tenants/[id]/checkout/route";
import { MAPPERS } from "@/lib/api/mappers";
import { prisma } from "@/lib/api-server/prisma";
import { checkoutTenant, TenantCheckoutError } from "@/lib/api-server/tenant-checkout";
import {
  computeServerDebts,
  sendTelegramPaymentReminders,
} from "@/lib/api-server/telegram-reminders";
import { computeContractDebt } from "@/lib/debt-calculator";
import { selectCanonicalDebts, summarizeCanonicalDebts } from "@/lib/debts/canonical-debts";
import {
  checkoutSuccessMessage,
  formatCheckoutDebt,
  previewCheckoutDebt,
} from "@/lib/tenant-checkout-debt";
import type { Contract, Payment, Tenant } from "@/types";

// Real route handlers, JWT auth, RBAC and workspace resolution; only DB I/O
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
type DbAdjustment = {
  id: string;
  workspaceId: string;
  contractId: string;
  tenantId: string;
  amount: number;
  type: string;
  reason: string;
  createdById: string | null;
  createdAt: Date;
};

let tenants: DbTenant[] = [];
let properties: DbProperty[] = [];
let contracts: DbContract[] = [];
let payments: DbPayment[] = [];
let adjustments: DbAdjustment[] = [];
let archives: Record<string, unknown>[] = [];
let paymentCreates = 0;
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
  properties.push({ id: `room-${opts.id}`, workspaceId, title: `Xona ${opts.id}`, status: "RENTED" });
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
function matchContract(c: DbContract, where: ContractWhere = {}) {
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
  for (const model of [prisma.user, prisma.contract, prisma.payment,
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
  mock(prisma.tenant, "updateMany", async ({ where, data }: {
    where: { id?: string; workspaceId?: string | null; leftAt?: null };
    data: Partial<DbTenant>;
  }) => {
    const hits = tenants.filter(
      (t) =>
        where.id &&
        t.id === where.id &&
        t.workspaceId === where.workspaceId &&
        (!("leftAt" in where) || t.leftAt === null)
    );
    hits.forEach((t) => Object.assign(t, data));
    return { count: hits.length };
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
        debtAdjustments: adjustments
          .filter((a) => a.contractId === c.id && a.type === "WRITE_OFF")
          .map((a) => ({ amount: a.amount })),
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
  mock(prisma.payment, "create", async () => {
    paymentCreates += 1;
    throw new Error("checkout must not create payments");
  });
  mock(prisma.debtAdjustment, "create", async ({ data }: { data: Omit<DbAdjustment, "id" | "createdAt"> }) => {
    if (adjustments.some((a) => a.contractId === data.contractId && a.type === data.type && a.reason === data.reason)) {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    }
    const row = { id: `adj-${adjustments.length}`, createdAt: new Date(), ...data };
    adjustments.push(row);
    return row;
  });
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
  adjustments = [];
  archives = [];
  paymentCreates = 0;
  telegramChats = [];
});

const auth = (user: string) => ({
  authorization: `Bearer ${jwt.sign({ sub: user, workspaceId: "ws-a" }, signingKey)}`,
});

function checkoutRequest(tenantId: string, user?: string, body: unknown = { debtDecision: "KEEP_DEBT" }) {
  return postCheckout(
    new NextRequest(`https://example.invalid/api/tenants/${tenantId}/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(user ? auth(user) : {}) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: tenantId }) }
  );
}

// Fixed clock: contract from 1 Aug, 600 000/month → Aug, Sep, Oct due by 6 Oct.
const NOW = new Date("2026-10-06T07:00:00.000Z");
const START = new Date("2026-08-01T00:00:00.000Z");
const END = new Date("2027-07-31T00:00:00.000Z");
const LATER = new Date("2026-12-20T07:00:00.000Z");
const keep = { debtDecision: "KEEP_DEBT" as const, actorUserId: "user-admin", now: NOW };
const writeOff = { debtDecision: "WRITE_OFF" as const, actorUserId: "user-admin", now: NOW };

const debtOf = async (tenantId: string, now = LATER) =>
  (await computeServerDebts({ workspaceId: "ws-a", tenantId, now })).reduce((s, d) => s + d.debt, 0);

describe("POST /api/tenants/:id/checkout — auth, decision, isolation", () => {
  it("ADMIN checkout succeeds", async () => {
    seedTenant({ id: "t1", start: utcMidnight(-100), end: utcMidnight(265) });
    const res = await checkoutRequest("t1", "user-admin");
    assert.equal(res.status, 200);
    const body = (await res.json()).data;
    assert.equal(body.debtDecision, "KEEP_DEBT");
    assert.deepEqual(body.closedContractIds, ["c-t1"]);
    assert.ok(body.remainingDebt > 0);
  });

  it("workspace OWNER checkout succeeds", async () => {
    seedTenant({ id: "t1", start: utcMidnight(-10), end: utcMidnight(355) });
    assert.equal((await checkoutRequest("t1", "user-owner")).status, 200);
    assert.ok(tenantById("t1").leftAt);
  });

  it("16. unauthenticated → 401, nothing changes", async () => {
    seedTenant({ id: "t1", start: utcMidnight(-10), end: utcMidnight(355) });
    const res = await checkoutRequest("t1", undefined, { debtDecision: "WRITE_OFF" });
    assert.equal(res.status, 401);
    assert.equal(tenantById("t1").leftAt, null);
    assert.equal(adjustments.length, 0);
  });

  it("missing/invalid debt decision → 400, nothing changes", async () => {
    seedTenant({ id: "t1", start: utcMidnight(-10), end: utcMidnight(355) });
    assert.equal((await checkoutRequest("t1", "user-admin", {})).status, 400);
    assert.equal((await checkoutRequest("t1", "user-admin", { debtDecision: "FORGIVE" })).status, 400);
    assert.equal(tenantById("t1").leftAt, null);
  });

  it("15. cross-workspace write-off rejected with 404, nothing changes", async () => {
    seedTenant({ id: "t1", workspaceId: "ws-a", start: utcMidnight(-100), end: utcMidnight(265) });
    const res = await checkoutRequest("t1", "user-b", { debtDecision: "WRITE_OFF" });
    assert.equal(res.status, 404);
    assert.equal(tenantById("t1").leftAt, null);
    assert.equal(contractOf("t1").status, "ACTIVE");
    assert.equal(roomOf("t1").status, "RENTED");
    assert.equal(adjustments.length, 0);
    assert.equal(archives.length, 0);
  });

  it("5/14. write-off amount = server debt; client amount/workspace ignored; actor audited", async () => {
    seedTenant({ id: "kept", start: utcMidnight(-100), end: utcMidnight(265) });
    seedTenant({ id: "gone", start: utcMidnight(-100), end: utcMidnight(265) });
    const kept = (await (await checkoutRequest("kept", "user-admin")).json()).data;

    const res = await checkoutRequest("gone", "user-admin", {
      debtDecision: "WRITE_OFF",
      amount: 1,
      debtTotal: 1,
      workspaceId: "ws-b",
    });
    assert.equal(res.status, 200);
    const body = (await res.json()).data;
    assert.ok(kept.remainingDebt > 0);
    assert.equal(body.writtenOffAmount, kept.remainingDebt);
    assert.equal(body.remainingDebt, 0);

    assert.equal(adjustments.length, 1);
    const [adj] = adjustments;
    assert.equal(adj!.amount, kept.remainingDebt);
    assert.equal(adj!.workspaceId, "ws-a");
    assert.equal(adj!.contractId, "c-gone");
    assert.equal(adj!.tenantId, "gone");
    assert.equal(adj!.type, "WRITE_OFF");
    assert.equal(adj!.reason, "TENANT_CHECKOUT");
    assert.equal(adj!.createdById, "user-admin");
    assert.ok(adj!.createdAt instanceof Date);
  });

  it("17. double checkout → 409, no second archive or write-off", async () => {
    seedTenant({ id: "t1", start: utcMidnight(-100), end: utcMidnight(265) });
    assert.equal((await checkoutRequest("t1", "user-admin", { debtDecision: "WRITE_OFF" })).status, 200);
    assert.equal((await checkoutRequest("t1", "user-admin", { debtDecision: "WRITE_OFF" })).status, 409);
    assert.equal(archives.length, 1);
    assert.equal(adjustments.length, 1);
  });
});

describe("checkoutTenant — KEEP_DEBT vs WRITE_OFF", () => {
  it("1/7/9. KEEP_DEBT preserves 1 800 000, stays in debts and reminders", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    const result = await checkoutTenant("t1", "ws-a", keep);
    assert.equal(result.remainingDebt, 1_800_000);
    assert.equal(result.writtenOffAmount, 0);
    assert.equal(adjustments.length, 0);

    const debts = await computeServerDebts({ workspaceId: "ws-a", now: LATER });
    assert.deepEqual(debts.map((d) => [d.tenantId, d.debt]), [["t1", 1_800_000]]);
    await sendTelegramPaymentReminders(debts);
    assert.deepEqual(telegramChats, ["chat-t1"]);
  });

  it("2/8/10. WRITE_OFF makes remaining 0, not in debts, no reminder", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    const result = await checkoutTenant("t1", "ws-a", writeOff);
    assert.equal(result.writtenOffAmount, 1_800_000);
    assert.deepEqual(result.writeOffs, [{ contractId: "c-t1", amount: 1_800_000 }]);
    assert.equal(result.remainingDebt, 0);

    const debts = await computeServerDebts({ workspaceId: "ws-a", now: LATER });
    assert.deepEqual(debts, []);
    await sendTelegramPaymentReminders(debts);
    assert.deepEqual(telegramChats, []);
  });

  it("3/4. write-off creates no Payment and leaves payment history unchanged", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    pay("t1", 1_200_000);
    const before = structuredClone(payments);
    const result = await checkoutTenant("t1", "ws-a", writeOff);
    assert.equal(result.writtenOffAmount, 600_000);
    assert.equal(paymentCreates, 0);
    assert.deepEqual(payments, before);
    assert.match(String(archives[0]!.notes), /hisobdan chiqarildi: 600 000 UZS/);
  });

  it("6. future billing stops after checkout on both paths", async () => {
    seedTenant({ id: "kept", start: START, end: END });
    seedTenant({ id: "gone", start: START, end: END });
    seedTenant({ id: "control", start: START, end: END });
    await checkoutTenant("kept", "ws-a", keep);
    await checkoutTenant("gone", "ws-a", writeOff);
    assert.equal(await debtOf("kept"), 1_800_000);
    assert.equal(await debtOf("gone"), 0);
    assert.equal(await debtOf("control"), 3_000_000);
  });

  it("11/12/13. room AVAILABLE, contract TERMINATED at checkout date, leftAt set — both paths", async () => {
    for (const [id, options] of [["kept", keep], ["gone", writeOff]] as const) {
      seedTenant({ id, start: START, end: END });
      await checkoutTenant(id, "ws-a", options);
      assert.equal(roomOf(id).status, "AVAILABLE", id);
      assert.equal(contractOf(id).status, "TERMINATED", id);
      assert.equal(contractOf(id).endDate.toISOString(), NOW.toISOString(), id);
      assert.equal(tenantById(id).leftAt?.toISOString(), NOW.toISOString(), id);
    }
  });

  it("zero debt + WRITE_OFF creates no adjustment", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    pay("t1", 1_800_000);
    const result = await checkoutTenant("t1", "ws-a", writeOff);
    assert.equal(result.writtenOffAmount, 0);
    assert.equal(result.remainingDebt, 0);
    assert.equal(adjustments.length, 0);
  });

  it("KEEP_DEBT: partial then full payment closes the debt later", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    await checkoutTenant("t1", "ws-a", keep);
    pay("t1", 500_000);
    assert.equal(await debtOf("t1"), 1_300_000);
    pay("t1", 1_300_000);
    assert.equal(await debtOf("t1"), 0);
  });

  it("18. double write-off impossible: re-run is a no-op, unique index → 409", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    await checkoutTenant("t1", "ws-a", writeOff);
    tenantById("t1").leftAt = null;
    contractOf("t1").status = "ACTIVE";
    const again = await checkoutTenant("t1", "ws-a", writeOff);
    assert.equal(again.writtenOffAmount, 0);
    assert.equal(adjustments.length, 1);

    seedTenant({ id: "t2", start: START, end: END });
    adjustments.push({
      id: "adj-pre", workspaceId: "ws-a", contractId: "c-t2", tenantId: "t2", amount: 100,
      type: "WRITE_OFF", reason: "TENANT_CHECKOUT", createdById: null, createdAt: new Date(),
    });
    await assert.rejects(
      checkoutTenant("t2", "ws-a", writeOff),
      (err) => err instanceof TenantCheckoutError && err.status === 409
    );
    assert.equal(adjustments.filter((a) => a.contractId === "c-t2").length, 1);
  });
});

describe("canonical debt + dashboard KPI with write-offs", () => {
  const contract = (writtenOffAmount?: number): Contract => ({
    id: "c1",
    propertyId: "p1",
    tenantId: "t1",
    startDate: "2026-06-01T00:00:00.000Z",
    endDate: "2026-10-06T07:00:00.000Z",
    monthlyPayment: 600_000,
    status: "terminated",
    writtenOffAmount,
    createdAt: "2026-06-01T00:00:00.000Z",
  });
  const paid: Payment[] = [
    { id: "p", contractId: "c1", tenantId: "t1", amount: 1_200_000, date: "2026-06-02T00:00:00.000Z", method: "cash", createdAt: "2026-06-02T00:00:00.000Z" },
  ];

  it("expected 3 000 000 − paid 1 200 000 − write-off 1 800 000 = 0", () => {
    const before = computeContractDebt(contract(), paid, undefined, NOW);
    assert.deepEqual([before.expected, before.paid, before.writtenOff, before.debt], [3_000_000, 1_200_000, 0, 1_800_000]);
    const after = computeContractDebt(contract(1_800_000), paid, undefined, NOW);
    assert.deepEqual([after.expected, after.paid, after.writtenOff, after.debt], [3_000_000, 1_200_000, 1_800_000, 0]);
    assert.equal(after.unpaidMonths, 0);
  });

  it("partial write-off clears oldest months first and keeps payments separate", () => {
    const r = computeContractDebt(contract(600_000), paid, undefined, NOW);
    assert.equal(r.paid, 1_200_000);
    assert.equal(r.writtenOff, 600_000);
    assert.equal(r.debt, 1_200_000);
    assert.equal(r.unpaidMonths, 2);
    assert.equal(r.oldestUnpaidDueDate, "2026-09-01");
  });

  it("19. dashboard KPI (contracts API → mapper → canonical summary) excludes written-off debt", async () => {
    seedTenant({ id: "kept", start: START, end: END });
    seedTenant({ id: "gone", start: START, end: END });
    await checkoutTenant("kept", "ws-a", keep);
    await checkoutTenant("gone", "ws-a", writeOff);

    const res = await getCollection(
      new NextRequest("https://example.invalid/api/contracts?limit=500", { headers: auth("user-admin") }),
      { params: Promise.resolve({ resource: "contracts" }) }
    );
    assert.equal(res.status, 200);
    const rows = (await res.json()).data.data as Record<string, unknown>[];
    assert.ok(rows.every((r) => !("debtAdjustments" in r)));
    const mapped = rows.map((r) => MAPPERS.contracts!.fromApi(r) as Contract);
    assert.equal(mapped.find((c) => c.id === "c-gone")?.writtenOffAmount, 1_800_000);

    const clientTenants: Tenant[] = tenants.map((t) => ({
      id: t.id, fullName: t.fullName, phone: t.phone, passport: t.passport,
      rentAmount: t.rentAmount, leftAt: t.leftAt?.toISOString(), createdAt: t.createdAt.toISOString(),
    }));
    const summary = summarizeCanonicalDebts(selectCanonicalDebts(mapped, [], clientTenants, LATER));
    assert.equal(summary.totalDebtAmount, 1_800_000);
    assert.equal(summary.uniqueDebtorCount, 1);
  });
});

describe("checkout modal preview and toast", () => {
  it("preview matches the server and returns per-contract debt", async () => {
    seedTenant({ id: "t1", start: START, end: END });
    const c: Contract[] = contracts.map((x) => ({
      id: x.id, propertyId: x.propertyId, tenantId: x.tenantId, propertyName: roomOf(x.tenantId).title,
      startDate: x.startDate.toISOString(), endDate: x.endDate.toISOString(), monthlyPayment: x.monthlyRent,
      status: "active", createdAt: x.createdAt.toISOString(),
    }));
    const t: Tenant[] = [{ id: "t1", fullName: "Tenant t1", phone: "", passport: "", rentAmount: 600_000, createdAt: START.toISOString() }];
    const preview = previewCheckoutDebt("t1", c, [], t, NOW);
    assert.equal(preview.remainingDebt, 1_800_000);
    assert.deepEqual(preview.perContract, [{ contractId: "c-t1", debt: 1_800_000 }]);
    assert.equal(preview.roomName, "Xona t1");
    assert.equal((await checkoutTenant("t1", "ws-a", keep)).remainingDebt, preview.remainingDebt);
  });

  it("toast texts for keep, write-off and no debt", () => {
    assert.equal(formatCheckoutDebt(1_800_000), "1 800 000 UZS");
    assert.equal(
      checkoutSuccessMessage({ remainingDebt: 1_800_000, writtenOffAmount: 0 }),
      "Ijarachi xonadan chiqarildi. 1 800 000 UZS qarzdorlik saqlandi."
    );
    assert.equal(
      checkoutSuccessMessage({ remainingDebt: 0, writtenOffAmount: 1_800_000 }),
      "Ijarachi xonadan chiqarildi. Qarzdorlik 0 UZS qilib yopildi."
    );
    assert.equal(
      checkoutSuccessMessage({ remainingDebt: 0, writtenOffAmount: 0 }),
      "Ijarachi xonadan chiqarildi. Qarzdorlik mavjud emas."
    );
  });
});
