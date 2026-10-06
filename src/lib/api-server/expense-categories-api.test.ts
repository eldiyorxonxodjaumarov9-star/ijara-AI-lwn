import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { PATCH as resourcePatch } from "@/app/api/[resource]/[id]/route";
import { POST as resourcePost } from "@/app/api/[resource]/route";
import { MAPPERS } from "@/lib/api/mappers";
import { prisma } from "@/lib/api-server/prisma";
import type { Expense } from "@/types";

const signingKey = randomBytes(32).toString("hex");
const ENV_KEYS = ["DATABASE_URL", "JWT_ACCESS_SECRET"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const restores: (() => void)[] = [];
function mock(model: object, name: string, impl: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, impl);
  restores.push(() => Reflect.set(model, name, original));
}

type Row = Record<string, unknown>;
const workspaces = new Map<string, Row>();
const users = new Map<string, string>();
let expenses: Row[] = [];

function addWorkspace(id: string) {
  workspaces.set(id, {
    id, name: id, slug: null, industry: "OFFICE_RENTAL", isInternal: false, createdAt: new Date(), updatedAt: new Date(),
    demoSeededAt: null, demoDataClearedAt: null,
    subscription: { id: `sub-${id}`, workspaceId: id, status: "ACTIVE", plan: "PRO", startedAt: new Date() },
  });
  users.set(`owner-${id}`, id);
}

function req(method: string, url: string, userId: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${jwt.sign({ sub: userId, email: `${userId}@example.invalid`, role: "ADMIN" }, signingKey, { expiresIn: "1h" })}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(res: Response | undefined) {
  assert.ok(res, "route returned no response");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- route payloads differ per endpoint
  const body = (await res.json()) as { data?: any; error?: any };
  return { status: res.status, data: body.data, error: body.error };
}

const mapper = MAPPERS.expenses!;
/** Goes through the same client mapper the UI uses (lowercase → API enum). */
const create = (ws: string, category: string) =>
  resourcePost(
    req("POST", "/api/expenses", `owner-${ws}`, mapper.toCreate({ category, amount: 250_000, date: "2026-07-10", note: `test ${category}` })),
    { params: Promise.resolve({ resource: "expenses" }) }
  ).then(json);
const patch = (ws: string, id: string, body: Row) =>
  resourcePatch(req("PATCH", `/api/expenses/${id}`, `owner-${ws}`, body), {
    params: Promise.resolve({ resource: "expenses", id }),
  }).then(json);

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;

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
  mock(prisma.workspaceActivityEvent, "createMany", async ({ data }: { data: Row[] }) => ({ count: data.length }));
  mock(prisma.workspaceActivityEvent, "findFirst", async () => null);

  mock(prisma.expense, "create", async ({ data }: { data: Row }) => {
    const row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data, employee: null };
    expenses.push(row);
    return row;
  });
  mock(prisma.expense, "findUnique", async ({ where }: { where: { id: string } }) => expenses.find((e) => e.id === where.id) ?? null);
  mock(prisma.expense, "update", async ({ where, data }: { where: { id: string }; data: Row }) => {
    const row = expenses.find((e) => e.id === where.id)!;
    Object.assign(row, data, { updatedAt: new Date() });
    return { ...row, employee: null };
  });
});

after(() => {
  restores.reverse().forEach((r) => r());
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

beforeEach(() => {
  expenses = [];
  workspaces.clear();
  users.clear();
  addWorkspace("ws-a");
  addWorkspace("ws-b");
  addWorkspace("internal");
});

describe("expenses API: utility and tax categories", () => {
  it("creates an expense with each of the 6 categories and maps it back", async () => {
    const expected = { waste_service: "WASTE_SERVICE", electricity: "ELECTRICITY", water: "WATER", gas: "GAS", internet: "INTERNET", tax: "TAX" };
    for (const [client, api] of Object.entries(expected)) {
      const res = await create("ws-a", client);
      assert.equal(res.status, 201, `${client}: ${JSON.stringify(res.error)}`);
      assert.equal(res.data.category, api);
      assert.equal(res.data.workspaceId, "ws-a");
      assert.equal((mapper.fromApi(res.data) as Expense).category, client);
    }
    assert.equal(expenses.length, 6);
  });

  it("old categories still create unchanged (regression)", async () => {
    for (const category of ["utilities", "salary", "repair", "marketing", "advance", "other"]) {
      const res = await create("ws-a", category);
      assert.equal(res.status, 201, category);
      assert.equal(res.data.category, category.toUpperCase());
    }
    const omitted = await resourcePost(req("POST", "/api/expenses", "owner-ws-a", { title: "x", amount: 1 }), {
      params: Promise.resolve({ resource: "expenses" }),
    }).then(json);
    assert.equal(omitted.data.category, "OTHER");
  });

  it("edit switches an old record to a new category and back", async () => {
    const created = await create("ws-a", "utilities");
    const toGas = await patch("ws-a", created.data.id, mapper.toUpdate({ category: "gas" }));
    assert.equal(toGas.status, 200);
    assert.equal(expenses[0].category, "GAS");
    const toTax = await patch("ws-a", created.data.id, { category: "TAX" });
    assert.equal(toTax.status, 200);
    assert.equal(expenses[0].category, "TAX");
  });

  it("unknown category → 400 on create and edit, nothing written", async () => {
    const bad = await resourcePost(req("POST", "/api/expenses", "owner-ws-a", { title: "x", amount: 1, category: "ELECTRIC" }), {
      params: Promise.resolve({ resource: "expenses" }),
    }).then(json);
    assert.equal(bad.status, 400);
    assert.equal(expenses.length, 0);
    const created = await create("ws-a", "water");
    const badPatch = await patch("ws-a", created.data.id, { category: "SEWAGE" });
    assert.equal(badPatch.status, 400);
    assert.equal(expenses[0].category, "WATER");
  });

  it("workspace isolation: another workspace cannot edit the expense", async () => {
    const created = await create("ws-a", "electricity");
    const foreign = await patch("ws-b", created.data.id, { category: "TAX" });
    assert.equal(foreign.status, 404);
    assert.equal(expenses[0].category, "ELECTRICITY");
    assert.equal(expenses[0].workspaceId, "ws-a");
  });
});
