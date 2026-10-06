import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { POST as resourcePost } from "@/app/api/[resource]/route";
import { GET as usageGet } from "@/app/api/dashboard/usage-analytics/route";
import { POST as leadUpsert } from "@/app/api/internal/agent/v1/leads/upsert/route";
import { recordActivity, sanitizeActivityMetadata, toActivityRow, writeActivities } from "@/lib/api-server/activity-events";
import { completedAiRunAction } from "@/lib/api-server/agent-gateway/ai-activity";
import { seedDemoWorkspace } from "@/lib/api-server/demo-seed";
import { DEMO_SEED_CUSTOMER_NAMES, DEMO_SEED_NOTE as DEMO_NOTE } from "@/lib/api-server/demo-seed-plan";
import { prisma } from "@/lib/api-server/prisma";
import { sendTelegramPaymentReminders } from "@/lib/api-server/telegram-reminders";

const signingKey = randomBytes(32).toString("hex");
const agentToken = randomBytes(24).toString("hex");
const ENV_KEYS = ["DATABASE_URL", "JWT_ACCESS_SECRET", "LWN_TELEGRAM_AGENT_TOKEN", "TELEGRAM_BOT_TOKEN"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const originalFetch = globalThis.fetch;
const restores: (() => void)[] = [];
function mock(model: object, name: string, impl: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, impl);
  restores.push(() => Reflect.set(model, name, original));
}

type Row = Record<string, unknown>;
let events: Row[] = [];
let groupByCalls = 0;
let expenseFails = false;
let leadFails = false;
const workspaces = new Map<string, Row>();
const users = new Map<string, string>();

function addWorkspace(id: string, industry: string) {
  workspaces.set(id, {
    id, name: id, slug: null, industry, isInternal: false, createdAt: new Date(), updatedAt: new Date(),
    demoSeededAt: null, demoDataClearedAt: null,
    subscription: { id: `sub-${id}`, workspaceId: id, status: "ACTIVE", plan: "PRO", startedAt: new Date() },
  });
  users.set(`owner-${id}`, id);
}

function req(method: string, url: string, userId?: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(userId
        ? { authorization: `Bearer ${jwt.sign({ sub: userId, email: `${userId}@example.invalid`, role: "ADMIN" }, signingKey, { expiresIn: "1h" })}` }
        : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(res: Response) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- route payloads differ per endpoint
  const body = (await res.json()) as { data?: any };
  return { status: res.status, data: body.data };
}
const usage = (ws: string, query = "") => usageGet(req("GET", `/api/dashboard/usage-analytics${query}`, `owner-${ws}`)).then(json);
const createExpense = (ws: string, body: Row = {}) =>
  resourcePost(req("POST", "/api/expenses", `owner-${ws}`, { title: "Svet", amount: 1000, ...body }), {
    params: Promise.resolve({ resource: "expenses" }),
  }).then(json);

const time = (v: unknown) => (v as Date).getTime();
function matchesField(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null || value === undefined;
  if (!cond || typeof cond !== "object" || cond instanceof Date) return value === cond;
  return Object.entries(cond as Row).every(([op, arg]) => {
    switch (op) {
      case "gte": return time(value) >= time(arg);
      case "lt": return time(value) < time(arg);
      case "gt": return time(value) > time(arg);
      case "lte": return time(value) <= time(arg);
      case "in": return (arg as unknown[]).includes(value);
      case "notIn": return value != null && !(arg as unknown[]).includes(value);
      case "startsWith": return typeof value === "string" && value.startsWith(arg as string);
      case "not": return value != null && !matchesField(value, arg);
      default: throw new Error(`unsupported where op ${op}`);
    }
  });
}
const matchesWhere = (r: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return (cond as Row[]).some((c) => matchesWhere(r, c));
    if (k === "AND") return (cond as Row[]).every((c) => matchesWhere(r, c));
    if (k === "NOT") return !matchesWhere(r, cond as Row);
    return matchesField(r[k], cond);
  });

const RECORD_MODELS = [
  "property", "tenant", "contract", "booking", "vehicle", "vehicleRental", "payment",
  "sourcePayment", "manualDebt", "debtAdjustment", "expense", "workTask",
] as const;
type RecordModel = (typeof RECORD_MODELS)[number];
let records: Record<RecordModel, Row[]>;
let recordQueries = 0;
const addRecord = (model: RecordModel, row: Row) =>
  records[model].push({ id: randomUUID(), createdAt: new Date(), notes: null, ...row });

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;
  process.env.LWN_TELEGRAM_AGENT_TOKEN = agentToken;
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";

  mock(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) =>
    users.has(where.id)
      ? { id: where.id, email: `${where.id}@example.invalid`, fullName: where.id, role: "ADMIN", isActive: true, isInternalAccount: false }
      : null
  );
  mock(prisma.user, "findMany", async () => []);
  mock(prisma.company, "findFirst", async () => null);
  for (const model of [prisma.user, prisma.property, prisma.tenant, prisma.contract, prisma.employee, prisma.client,
    prisma.payment, prisma.expense, prisma.maintenance, prisma.partnerCompany, prisma.contactLead, prisma.workTask,
    prisma.notification]) {
    mock(model, "updateMany", async () => ({ count: 0 }));
  }
  mock(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => {
    const ws = workspaces.get(users.get(where.userId) ?? "");
    return ws ? { role: "OWNER", workspace: ws } : null;
  });
  mock(prisma.workspace, "findFirst", async () => ({ id: "internal", isInternal: true }));
  mock(prisma.workspace, "findUnique", async ({ where }: { where: { id: string } }) => workspaces.get(where.id) ?? null);
  mock(prisma.workspaceSubscription, "findUnique", async ({ where }: { where: { workspaceId: string } }) =>
    (workspaces.get(where.workspaceId)?.subscription as Row | undefined) ?? null
  );
  mock(prisma, "$queryRaw", async () => []);

  mock(prisma.expense, "create", async ({ data }: { data: Row }) => {
    if (expenseFails) throw new Error("db down");
    return { id: randomUUID(), ...data, employee: null };
  });
  mock(prisma.telegramAiLead, "findUnique", async () => null);
  mock(prisma.telegramAiLead, "create", async ({ data }: { data: Row }) => {
    if (leadFails) throw new Error("db down");
    const now = new Date();
    return { id: randomUUID(), workspaceId: null, source: "TELEGRAM_AI", createdAt: now, updatedAt: now, ...data };
  });
  mock(prisma.agentActionAudit, "findUnique", async () => null);
  mock(prisma.agentActionAudit, "create", async ({ data }: { data: Row }) => ({ id: randomUUID(), ...data }));

  for (const model of RECORD_MODELS) {
    mock(prisma[model], "findFirst", async ({ where }: { where: Row }) => {
      recordQueries += 1;
      const hit = records[model].find((r) => matchesWhere(r, where));
      return hit ? { id: hit.id } : null;
    });
  }
  mock(prisma.contract, "findMany", async ({ where }: { where: Row }) => {
    recordQueries += 1;
    return records.contract
      .filter((r) => matchesWhere(r, where))
      .map((c) => ({
        ...c,
        property: { title: "Xona" },
        tenant: { id: c.tenantId, fullName: "Ijarachi", phone: "+998901112233", passport: null, rentAmount: c.monthlyRent, paymentDueDate: null, leftAt: null, createdAt: c.createdAt },
        payments: [],
        debtAdjustments: [],
      }));
  });

  mock(prisma.workspaceActivityEvent, "createMany", async ({ data }: { data: Row[] }) => {
    for (const d of data) events.push({ id: randomUUID(), createdAt: new Date(), ...d });
    return { count: data.length };
  });
  mock(prisma.workspaceActivityEvent, "findFirst", async () => null);
  mock(prisma.workspaceActivityEvent, "groupBy", async (args: { by: string[]; where: Row }) => {
    groupByCalls += 1;
    const groups = new Map<string, Row & { n: number }>();
    for (const e of events.filter((r) => matchesWhere(r, args.where))) {
      const key = args.by.map((k) => String(e[k])).join("|");
      const g = groups.get(key) ?? { ...Object.fromEntries(args.by.map((k) => [k, e[k]])), n: 0 };
      g.n += 1;
      groups.set(key, g);
    }
    return [...groups.values()].map(({ n, ...g }) => ({ ...g, _count: { _all: n } }));
  });
});

after(() => {
  restores.reverse().forEach((r) => r());
  globalThis.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

beforeEach(() => {
  events = [];
  groupByCalls = 0;
  records = Object.fromEntries(RECORD_MODELS.map((m) => [m, []])) as unknown as Record<RecordModel, Row[]>;
  recordQueries = 0;
  expenseFails = false;
  leadFails = false;
  workspaces.clear();
  users.clear();
  addWorkspace("hotel", "HOTEL_HOSTEL");
  addWorkspace("car", "CAR_RENTAL");
  addWorkspace("office", "OFFICE_RENTAL");
  addWorkspace("internal", "OFFICE_RENTAL");
});

describe("activity tracking", () => {
  it("human create writes one HUMAN event with the session user and workspace", async () => {
    const res = await createExpense("office");
    assert.equal(res.status, 201);
    assert.equal(events.length, 1);
    assert.equal(events[0].actorType, "HUMAN");
    assert.equal(events[0].actionType, "EXPENSE_CREATE");
    assert.equal(events[0].featureKey, "expenses");
    assert.equal(events[0].workspaceId, "office");
    assert.equal(events[0].userId, "owner-office");
  });

  it("failed action writes no event", async () => {
    expenseFails = true;
    const res = await createExpense("office");
    assert.equal(res.status, 500);
    assert.equal(events.length, 0);
  });

  it("client cannot spoof actorType, action or workspace", async () => {
    await createExpense("office", { actorType: "AI", actionType: "AI_FINANCE_ANALYSIS", workspaceId: "hotel" });
    assert.equal(events.length, 1);
    assert.equal(events[0].actorType, "HUMAN");
    assert.equal(events[0].actionType, "EXPENSE_CREATE");
    assert.equal(events[0].workspaceId, "office");
  });

  it("AI lead upsert success writes an AI event; failure writes none", async () => {
    const call = () =>
      leadUpsert(req("POST", "/api/internal/agent/v1/leads/upsert", undefined, { telegramUserId: "tg-1", desiredArea: 20 }, {
        authorization: `Bearer ${agentToken}`,
      }));
    assert.equal((await call()).status, 200);
    assert.equal(events.length, 1);
    assert.equal(events[0].actorType, "AI");
    assert.equal(events[0].actionType, "AI_CUSTOMER_RESPONSE");
    assert.equal(events[0].workspaceId, "internal");
    assert.equal(events[0].userId, null);

    leadFails = true;
    assert.equal((await call()).status, 500);
    assert.equal(events.length, 1);
  });

  it("agent runs count as AI only when completed with a real model", () => {
    const base = { status: "RUNNING", triggerType: "SCHEDULE", agentType: "ANALYST", model: null, modelProvider: null } as const;
    assert.equal(completedAiRunAction(base, { status: "COMPLETED", model: "gpt-4o-mini" }), "AI_FINANCE_ANALYSIS");
    assert.equal(completedAiRunAction(base, { status: "FAILED", model: "gpt-4o-mini" }), null);
    assert.equal(completedAiRunAction(base, { status: "COMPLETED" }), null, "rule-based run (no model)");
    assert.equal(completedAiRunAction({ ...base, triggerType: "TEST" }, { status: "COMPLETED", model: "m" }), null);
    assert.equal(completedAiRunAction({ ...base, status: "COMPLETED" }, { status: "COMPLETED", model: "m" }), null);
  });

  it("cron payment reminder is AUTOMATION; staff-triggered send records nothing", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 })) as typeof fetch;
    const manual = [{
      manualDebtId: "md-1", workspaceId: "office", debtorName: "Ali", propertyName: null, debtorOccupation: null,
      debtDate: "2026-09-01", remainingAmount: 5000, chatId: "555",
    }];
    await sendTelegramPaymentReminders([], "morning", manual);
    assert.equal(events.length, 0);
    const res = await sendTelegramPaymentReminders([], "morning", manual, { recordAutomation: true });
    assert.equal(res.sent, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0].actorType, "AUTOMATION");
    assert.equal(events[0].actionType, "DEBT_REMINDER_SENT");
    assert.equal(events[0].workspaceId, "office");
  });

  it("actor is always derived from the action; unknown actions are dropped", () => {
    assert.equal(toActivityRow({ workspaceId: "w", action: "PAYMENT_CREATE", userId: "u" })?.actorType, "HUMAN");
    assert.equal(toActivityRow({ workspaceId: "w", action: "DEBT_REMINDER_SENT", userId: "u" })?.userId, null);
    assert.equal(toActivityRow({ workspaceId: "w", action: "HACK" as never }), null);
  });

  it("metadata never stores secrets or nested objects", () => {
    const meta = sanitizeActivityMetadata({
      password: "x", accessToken: "t", apiKey: "k", cardNumber: "4111", pin: "1234", secret: "s",
      nested: { a: 1 }, status: "QUALIFIED", company: "LWN", count: 2,
    });
    assert.deepEqual(meta, { status: "QUALIFIED", company: "LWN", count: 2 });
  });

  it("a failing analytics write never throws into the business action", async () => {
    const original = console.error;
    const logged: unknown[] = [];
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      const written = await writeActivities([{ workspaceId: "w", action: "PAYMENT_CREATE" }], {
        workspaceActivityEvent: { createMany: async () => { throw new Error("boom"); } },
      });
      assert.equal(written, 0);
      assert.equal(logged.length, 1);
    } finally {
      console.error = original;
    }
    await recordActivity([]);
  });

  it("demo seed creates no activity events", async () => {
    const tables: Record<string, Row[]> = {};
    const model = (name: string) => ({
      count: async () => 0,
      createMany: async ({ data }: { data: Row[] }) => {
        (tables[name] ??= []).push(...data);
        return { count: data.length };
      },
    });
    const ws = { id: "demo", industry: "HOTEL_HOSTEL", isInternal: false, subscription: { status: "DEMO", plan: "demo" } };
    const db = new Proxy({} as Row, {
      get: (_t, prop: string) => {
        if (prop === "$queryRaw") return async () => [];
        if (prop === "workspace") {
          return { findUnique: async () => ws, update: async ({ data }: { data: Row }) => Object.assign(ws, data) };
        }
        return model(prop);
      },
    });
    const client = { $transaction: async (fn: (tx: unknown) => unknown) => fn(db) };
    const result = await seedDemoWorkspace({ workspaceId: "demo", now: new Date() }, client as never);
    assert.equal(result.seeded, true);
    assert.ok(Object.keys(tables).length > 0);
    assert.equal(tables.workspaceActivityEvent, undefined);
    assert.equal(events.length, 0);
    for (const file of ["src/lib/api-server/demo-seed.ts", "src/lib/api-server/demo-data-clear.ts", "src/app/api/workspace/clear-demo-data/route.ts"]) {
      const src = readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(!/recordActivity|workspaceActivityEvent/.test(src), file);
    }
  });
});

describe("GET /api/dashboard/usage-analytics", () => {
  it("unauthenticated → 401", async () => {
    const res = await usageGet(req("GET", "/api/dashboard/usage-analytics"));
    assert.equal(res.status, 401);
  });

  it("invalid period → 400; valid periods accepted", async () => {
    assert.equal((await usage("office", "?period=365d")).status, 400);
    for (const p of ["7d", "30d", "90d"]) {
      const res = await usage("office", `?period=${p}`);
      assert.equal(res.status, 200);
      assert.equal(res.data.period, p);
    }
    assert.equal((await usage("office")).data.period, "30d");
  });

  it("zero events: collecting state with real eligible count", async () => {
    const res = await usage("hotel");
    assert.equal(res.data.collecting, true);
    assert.equal(res.data.platformUsage.usedFeatures, 0);
    assert.equal(res.data.platformUsage.eligibleFeatures, 8);
    assert.equal(res.data.platformUsage.percentage, 0);
    assert.equal(res.data.workShare.total, 0);
  });

  it("period window excludes older events", async () => {
    const old = new Date(Date.now() - 20 * 86_400_000);
    events.push({ workspaceId: "office", actorType: "HUMAN", actionType: "PAYMENT_CREATE", featureKey: "payments", createdAt: old });
    assert.equal((await usage("office", "?period=7d")).data.workShare.human.count, 0);
    assert.equal((await usage("office", "?period=30d")).data.workShare.human.count, 1);
  });

  it("is isolated per workspace and ignores a client workspaceId", async () => {
    await createExpense("office");
    await createExpense("office");
    await createExpense("car");
    const office = await usage("office", "?workspaceId=car");
    const car = await usage("car");
    const hotel = await usage("hotel", "?workspaceId=office");
    assert.equal(office.data.workShare.human.count, 2);
    assert.equal(car.data.workShare.human.count, 1);
    assert.equal(hotel.data.workShare.total, 0);
  });

  it("bounded queries: fixed groupBy + existence checks regardless of data volume", async () => {
    for (let i = 0; i < 50; i++) await createExpense("office");
    for (let i = 0; i < 200; i++) addRecord("property", { workspaceId: "office", description: null });
    groupByCalls = 0;
    recordQueries = 0;
    const res = await usage("office");
    assert.equal(groupByCalls, 2, "one period groupBy + one all-time groupBy");
    // 7 data features; payments + debts use two probes each, debts adds one contract scan.
    assert.ok(recordQueries <= 10, `record queries=${recordQueries}`);
    assert.equal(res.data.workShare.human.count, 50);
    assert.equal(res.data.platformUsage.usedFeatures, 2);
    assert.equal(res.data.features.find((f: { key: string }) => f.key === "expenses").used, true);
  });
});

const feature = (res: { data: { features: { key: string; used: boolean }[] } }, key: string) =>
  res.data.features.find((f) => f.key === key)?.used;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("platform usage: all-time real data", () => {
  it("old room with no events → rooms used", async () => {
    addRecord("property", { workspaceId: "office", description: "2-qavat", createdAt: daysAgo(400) });
    const res = await usage("office");
    assert.equal(feature(res, "properties"), true);
    assert.equal(res.data.platformUsage.percentage, 13);
    assert.equal(res.data.workShare.total, 0);
  });

  it("old tenant → tenants used", async () => {
    addRecord("tenant", { workspaceId: "office", fullName: "Ali Valiyev", phone: "+998901234567", createdAt: daysAgo(300) });
    assert.equal(feature(await usage("office"), "tenants"), true);
  });

  it("old contract → contracts used", async () => {
    addRecord("contract", {
      workspaceId: "office", status: "TERMINATED", tenantId: "t0", propertyId: "p0", monthlyRent: 500_000,
      startDate: daysAgo(400), endDate: daysAgo(200), createdAt: daysAgo(400),
    });
    assert.equal(feature(await usage("office"), "contracts"), true);
  });

  it("old payment (or source payment) → payments used", async () => {
    addRecord("payment", { workspaceId: "office", createdAt: daysAgo(500) });
    assert.equal(feature(await usage("office"), "payments"), true);
    records.payment = [];
    addRecord("sourcePayment", { workspaceId: "hotel", createdAt: daysAgo(100) });
    assert.equal(feature(await usage("hotel"), "payments"), true);
  });

  it("debts: manual debt or a canonical non-demo debt counts", async () => {
    addRecord("manualDebt", { workspaceId: "office" });
    assert.equal(feature(await usage("office"), "debts"), true);
    records.manualDebt = [];
    addRecord("contract", {
      workspaceId: "office", status: "ACTIVE", tenantId: "t1", propertyId: "p1", monthlyRent: 1_000_000,
      startDate: daysAgo(120), endDate: daysAgo(-200), createdAt: daysAgo(120),
    });
    assert.equal(feature(await usage("office"), "debts"), true);
  });

  it("reports are never inferred from data — only from report events", async () => {
    addRecord("property", { workspaceId: "office" });
    addRecord("payment", { workspaceId: "office" });
    assert.equal(feature(await usage("office"), "reports"), false);
    events.push({ workspaceId: "office", actorType: "HUMAN", actionType: "REPORT_VIEW", featureKey: "reports", createdAt: daysAgo(200) });
    assert.equal(feature(await usage("office"), "reports"), true);
  });

  it("event only (row since deleted) → used, even outside the selected period", async () => {
    events.push({ workspaceId: "office", actorType: "HUMAN", actionType: "EXPENSE_CREATE", featureKey: "expenses", createdAt: daysAgo(150) });
    const res = await usage("office", "?period=7d");
    assert.equal(feature(res, "expenses"), true);
    assert.equal(res.data.workShare.total, 0);
  });

  it("platform % is all-time and identical for 7d / 30d / 90d; actor counts follow the period", async () => {
    addRecord("property", { workspaceId: "office", createdAt: daysAgo(365) });
    addRecord("tenant", { workspaceId: "office", fullName: "Real", phone: "+998935551122", createdAt: daysAgo(365) });
    for (const [age, n] of [[3, 1], [20, 2], [60, 4]] as const) {
      for (let i = 0; i < n; i++) {
        events.push({ workspaceId: "office", actorType: "HUMAN", actionType: "PAYMENT_CREATE", featureKey: "payments", createdAt: daysAgo(age) });
      }
    }
    events.push({ workspaceId: "office", actorType: "AI", actionType: "AI_CUSTOMER_RESPONSE", featureKey: "ai_customer_chat", createdAt: daysAgo(45) });
    const [d7, d30, d90] = await Promise.all(["7d", "30d", "90d"].map((p) => usage("office", `?period=${p}`)));
    for (const res of [d7, d30, d90]) {
      assert.deepEqual(res.data.platformUsage, { scope: "ALL_TIME", usedFeatures: 3, eligibleFeatures: 8, percentage: 38 });
    }
    assert.deepEqual([d7, d30, d90].map((r) => r.data.workShare.human.count), [1, 3, 7]);
    assert.deepEqual([d7, d30, d90].map((r) => r.data.workShare.ai.count), [0, 0, 1]);
  });

  it("HOTEL and CAR detect their own models", async () => {
    addRecord("booking", { workspaceId: "hotel" });
    addRecord("vehicle", { workspaceId: "car" });
    addRecord("vehicleRental", { workspaceId: "car" });
    const hotel = await usage("hotel");
    const car = await usage("car");
    assert.equal(hotel.data.features.find((f: { key: string }) => f.key === "bookings").used, true);
    assert.equal(car.data.features.find((f: { key: string }) => f.key === "vehicles").used, true);
    assert.equal(car.data.features.find((f: { key: string }) => f.key === "vehicle_rentals").used, true);
    assert.equal(hotel.data.platformUsage.usedFeatures, 1);
    assert.equal(car.data.platformUsage.usedFeatures, 2);
  });

  it("cross-workspace records never leak, even with a client workspaceId", async () => {
    addRecord("property", { workspaceId: "car" });
    addRecord("tenant", { workspaceId: "car", fullName: "X", phone: "+998901110000" });
    const office = await usage("office", "?workspaceId=car");
    assert.equal(office.data.platformUsage.usedFeatures, 0);
    assert.equal(office.data.platformUsage.percentage, 0);
  });
});

describe("platform usage: demo seed exclusion", () => {
  const seedDemo = (ws: string, seededAt: Date) => {
    Object.assign(workspaces.get(ws)!, { demoSeededAt: seededAt });
    const at = new Date(seededAt.getTime() + 60_000);
    addRecord("property", { workspaceId: ws, description: DEMO_NOTE, createdAt: at });
    addRecord("tenant", { workspaceId: ws, fullName: DEMO_SEED_CUSTOMER_NAMES[0], phone: "+998900001234", createdAt: at });
    addRecord("contract", {
      workspaceId: ws, notes: DEMO_NOTE, status: "ACTIVE", tenantId: "dt", propertyId: "dp", monthlyRent: 2_000_000,
      startDate: daysAgo(90), endDate: daysAgo(-90), createdAt: at,
    });
    addRecord("payment", { workspaceId: ws, notes: DEMO_NOTE, createdAt: at });
    addRecord("expense", { workspaceId: ws, notes: DEMO_NOTE, createdAt: at });
  };

  it("demo seed only → nothing counted as used (incl. canonical debts on demo contracts)", async () => {
    seedDemo("office", daysAgo(2));
    const res = await usage("office");
    assert.equal(res.data.platformUsage.usedFeatures, 0);
    assert.equal(res.data.platformUsage.percentage, 0);
    assert.ok(res.data.features.every((f: { used: boolean }) => !f.used));
  });

  it("demo cleared + real room → only the real room counts", async () => {
    Object.assign(workspaces.get("office")!, { demoSeededAt: daysAgo(10), demoDataClearedAt: daysAgo(9) });
    addRecord("property", { workspaceId: "office", description: null, createdAt: daysAgo(5) });
    const res = await usage("office");
    assert.equal(feature(res, "properties"), true);
    assert.equal(res.data.platformUsage.usedFeatures, 1);
  });

  it("real records alongside an uncleared demo seed still count", async () => {
    const seededAt = daysAgo(2);
    seedDemo("office", seededAt);
    addRecord("property", { workspaceId: "office", description: null, createdAt: new Date(seededAt.getTime() + 60_000) });
    addRecord("expense", { workspaceId: "office", notes: DEMO_NOTE, createdAt: daysAgo(1) });
    const res = await usage("office");
    assert.equal(feature(res, "properties"), true, "real room inside window (no marker)");
    assert.equal(feature(res, "expenses"), true, "marker but created after the seed window");
    assert.equal(feature(res, "tenants"), false);
    assert.equal(feature(res, "payments"), false);
  });
});

describe("dashboard UI copy", () => {
  it("renders the agreed labels and no invented metrics", () => {
    const src = readFileSync(path.join(process.cwd(), "src/components/dashboard/platform-usage-section.tsx"), "utf8");
    for (const text of [
      "Platformadan foydalanish",
      "Ishlarning bajarilish ulushi",
      "Qaysi funksiyalar ishlatilmoqda",
      "AI bajargan ishlar",
      "Odam bajargan ishlar",
      "Avtomatik bajarilgan",
      "Faol",
      "Ishlatilmagan",
      "Ma'lumot yig'ilmoqda",
      "Barcha vaqt bo‘yicha",
      "periodLabel",
    ]) {
      assert.ok(src.includes(text), text);
    }
    assert.ok(!/soat|tejad/i.test(src), "no time-saved metric");
    assert.ok(!/\b(70|80)%/.test(src), "no hardcoded percentages");
  });
});
