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

const matchesWhere = (r: Row, where: Row = {}) =>
  Object.entries(where).every(([k, cond]) => {
    if (cond && typeof cond === "object" && !(cond instanceof Date) && "gte" in (cond as Row)) {
      return (r[k] as Date).getTime() >= ((cond as Row).gte as Date).getTime();
    }
    return r[k] === cond;
  });

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

  it("uses one bounded groupBy per request regardless of event volume", async () => {
    for (let i = 0; i < 50; i++) await createExpense("office");
    groupByCalls = 0;
    const res = await usage("office");
    assert.equal(groupByCalls, 1);
    assert.equal(res.data.workShare.human.count, 50);
    assert.equal(res.data.platformUsage.usedFeatures, 1);
    assert.equal(res.data.features.find((f: { key: string }) => f.key === "expenses").used, true);
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
    ]) {
      assert.ok(src.includes(text), text);
    }
    assert.ok(!/soat|tejad/i.test(src), "no time-saved metric");
    assert.ok(!/\b(70|80)%/.test(src), "no hardcoded percentages");
  });
});
