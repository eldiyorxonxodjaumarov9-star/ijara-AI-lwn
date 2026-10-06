import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { GET as statusRoute, POST as clearRoute } from "@/app/api/workspace/clear-demo-data/route";
import { POST as createPropertyRoute } from "@/app/api/properties/route";
import { POST as createVehicleRoute } from "@/app/api/vehicles/route";
import { POST as createBookingRoute } from "@/app/api/bookings/route";
import { DEMO_SEED_NOTE } from "@/lib/api-server/demo-seed-plan";
import { seedDemoWorkspace } from "@/lib/api-server/demo-seed";
import { createWithinPlanLimit } from "@/lib/api-server/plan-service";
import { prisma } from "@/lib/api-server/prisma";
import { resolveUserWorkspaceContext } from "@/lib/api-server/workspace";
import { addDays, tashkentToday } from "@/lib/vehicle-rentals";

// Real seed, real routes, real plan-limit logic; Prisma is an in-memory store.
const signingKey = randomBytes(32).toString("hex");
const originalEnv = { database: process.env.DATABASE_URL, jwt: process.env.JWT_ACCESS_SECRET };
const restores: (() => void)[] = [];
function mock(model: object, name: string, impl: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, impl);
  restores.push(() => Reflect.set(model, name, original));
}

type Row = Record<string, unknown>;
const MODELS = [
  "property", "tenant", "contract", "payment", "expense", "vehicle", "vehicleRental", "booking",
  "sourcePayment", "debtAdjustment", "tenantArchive", "client", "telegramBotUser", "roomAccessGrant",
  "contractRequest", "manualDebt", "maintenance", "roomLockSettings", "roomAccessLogEvent",
  "ttlockRemoteCommand", "aiAgentMedia", "employee",
] as const;
let tables: Record<string, Row[]> = {};
let workspaces: Row[] = [];
let subscriptions: Row[] = [];
const users = new Map<string, { role: string; workspaceId: string; memberRole: string }>();

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null || value === undefined;
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  if (typeof cond !== "object") return value === cond;
  const c = cond as Record<string, unknown>;
  const num = (v: unknown) => (v instanceof Date ? v.getTime() : Number(v));
  return Object.entries(c).every(([op, arg]) => {
    switch (op) {
      case "in": return (arg as unknown[]).includes(value);
      case "gte": return value != null && num(value) >= num(arg);
      case "lte": return value != null && num(value) <= num(arg);
      case "gt": return value != null && num(value) > num(arg);
      case "lt": return value != null && num(value) < num(arg);
      case "startsWith": return typeof value === "string" && value.startsWith(String(arg));
      case "not": return !matchValue(value, arg);
      default: throw new Error(`unsupported operator ${op}`);
    }
  });
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((w) => matches(row, w));
    if (key === "AND") return (cond as Row[]).every((w) => matches(row, w));
    if (key === "NOT") return !matches(row, cond as Row);
    return matchValue(row[key], cond);
  });
}

function withIncludes(row: Row, include?: Row) {
  const out = { ...row };
  if (include?.property) {
    const p = tables.property!.find((x) => x.id === row.propertyId);
    out.property = p ? { title: p.title } : null;
  }
  if (include?.tenant) {
    const t = tables.tenant!.find((x) => x.id === row.tenantId);
    out.tenant = t ? { fullName: t.fullName } : null;
  }
  return out;
}

function newRow(data: Row): Row {
  const now = new Date();
  return { id: randomUUID(), createdAt: now, updatedAt: now, notes: null, description: null, ...data };
}

function modelImpl(name: string) {
  const rows = () => tables[name]!;
  return {
    findMany: async (a: { where?: Row; include?: Row } = {}) =>
      rows().filter((r) => matches(r, a.where)).map((r) => withIncludes(r, a.include)),
    findFirst: async (a: { where?: Row; include?: Row } = {}) => {
      const r = rows().find((x) => matches(x, a.where));
      return r ? withIncludes(r, a.include) : null;
    },
    findUnique: async (a: { where: Row; include?: Row }) => {
      const r = rows().find((x) => matches(x, a.where));
      return r ? withIncludes(r, a.include) : null;
    },
    count: async (a: { where?: Row } = {}) => rows().filter((r) => matches(r, a.where)).length,
    create: async (a: { data: Row }) => {
      const r = newRow(a.data);
      rows().push(r);
      return r;
    },
    createMany: async (a: { data: Row[] }) => {
      for (const d of a.data) rows().push(newRow(d));
      return { count: a.data.length };
    },
    deleteMany: async (a: { where?: Row } = {}) => {
      const keep = rows().filter((r) => !matches(r, a.where));
      const count = rows().length - keep.length;
      tables[name] = keep;
      return { count };
    },
  };
}

function token(userId: string) {
  return jwt.sign({ sub: userId, email: `${userId}@example.invalid`, role: "ADMIN" }, signingKey, { expiresIn: "1h" });
}
function req(method: string, path: string, userId: string | null, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", ...(userId ? { authorization: `Bearer ${token(userId)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(res: Response) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- route payloads differ per endpoint
  const body = (await res.json()) as { data?: any; message?: string; error?: { code?: string } };
  return { data: body.data, message: body.message, code: body.error?.code };
}

function addWorkspace(id: string, industry: string, opts: { plan?: string; status?: string } = {}) {
  workspaces.push({
    id, name: id, slug: null, industry, isInternal: false,
    createdAt: new Date(), updatedAt: new Date(), demoSeededAt: null, demoDataClearedAt: null,
  });
  subscriptions.push({
    id: `sub-${id}`, workspaceId: id, status: opts.status ?? "DEMO", plan: opts.plan ?? "demo",
    demoEndsAt: new Date(Date.now() + 7 * 86_400_000), startedAt: new Date(),
  });
  users.set(`owner-${id}`, { role: "ADMIN", workspaceId: id, memberRole: "OWNER" });
}

async function seeded(id: string, industry: string, opts: { plan?: string; status?: string } = {}) {
  addWorkspace(id, industry);
  const r = await seedDemoWorkspace({ workspaceId: id });
  assert.equal(r.seeded, true, `seed ${id}`);
  const sub = subscriptions.find((s) => s.workspaceId === id)!;
  if (opts.plan) sub.plan = opts.plan;
  if (opts.status) sub.status = opts.status;
}

const countIn = (ws: string) =>
  Object.fromEntries(
    ["property", "tenant", "contract", "payment", "expense", "vehicle", "vehicleRental", "booking", "sourcePayment"].map(
      (m) => [m, tables[m]!.filter((r) => r.workspaceId === ws).length]
    )
  ) as Record<string, number>;
const total = (c: Record<string, number>) => Object.values(c).reduce((s, n) => s + n, 0);
const clear = (userId: string, body: unknown = {}) => clearRoute(req("POST", "/api/workspace/clear-demo-data", userId, body));

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;

  mock(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => ({
    id: where.id, email: `${where.id}@example.invalid`, fullName: where.id,
    role: users.get(where.id)?.role ?? "ADMIN", isActive: true, isInternalAccount: false,
  }));
  mock(prisma.user, "findMany", async () => []);
  mock(prisma.company, "findFirst", async () => null);
  for (const model of [prisma.user, prisma.property, prisma.tenant, prisma.contract, prisma.payment,
    prisma.expense, prisma.maintenance, prisma.employee, prisma.partnerCompany, prisma.client,
    prisma.contactLead, prisma.workTask, prisma.notification]) {
    mock(model, "updateMany", async () => ({ count: 0 }));
  }
  mock(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => {
    const u = users.get(where.userId);
    const ws = workspaces.find((w) => w.id === u?.workspaceId);
    if (!u || !ws) return null;
    return { role: u.memberRole, workspace: { ...ws, subscription: subscriptions.find((s) => s.workspaceId === ws.id) ?? null } };
  });

  for (const name of MODELS) {
    const impl = modelImpl(name);
    const model = Reflect.get(prisma, name) as object;
    for (const [method, fn] of Object.entries(impl)) mock(model, method, fn);
  }
  mock(prisma.workspace, "findFirst", async () => ({ id: "internal", isInternal: true }));
  mock(prisma.workspace, "findUnique", async ({ where }: { where: { id: string } }) => {
    const ws = workspaces.find((w) => w.id === where.id);
    return ws ? { ...ws, subscription: subscriptions.find((s) => s.workspaceId === ws.id) ?? null } : null;
  });
  mock(prisma.workspace, "update", async ({ where, data }: { where: { id: string }; data: Row }) => {
    const ws = workspaces.find((w) => w.id === where.id)!;
    Object.assign(ws, data);
    return ws;
  });
  mock(prisma.workspaceSubscription, "findUnique", async ({ where }: { where: { workspaceId: string } }) =>
    where.workspaceId === "internal"
      ? { workspaceId: "internal", status: "ACTIVE", plan: "internal" }
      : (subscriptions.find((s) => s.workspaceId === where.workspaceId) ?? null)
  );
  mock(prisma, "$queryRaw", async () => []);
  mock(prisma.workspaceActivityEvent, "createMany", async () => ({ count: 0 }));
  mock(prisma, "$queryRawUnsafe", async () => []);
  mock(prisma, "$transaction", async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
});

after(() => {
  restores.reverse().forEach((r) => r());
  for (const [key, value] of [["DATABASE_URL", originalEnv.database], ["JWT_ACCESS_SECRET", originalEnv.jwt]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  tables = Object.fromEntries(MODELS.map((m) => [m, []]));
  workspaces = [];
  subscriptions = [];
  users.clear();
});

describe("clear demo data — per industry", () => {
  it("1/15. HOTEL: all demo rooms, guests, bookings, payments and expenses go to 0", async () => {
    await seeded("hotel", "HOTEL_HOSTEL");
    const before = countIn("hotel");
    assert.ok(before.property > 0 && before.tenant > 0 && before.booking > 0 && before.sourcePayment > 0);

    const status = await json(await statusRoute(req("GET", "/api/workspace/clear-demo-data", "owner-hotel")));
    assert.equal(status.data.eligible, true);
    assert.equal(status.data.hasDemoData, true);

    const res = await clear("owner-hotel");
    assert.equal(res.status, 200);
    const { data } = await json(res);
    assert.equal(data.alreadyCleared, false);
    assert.equal(data.deleted.properties, before.property);
    assert.equal(data.deleted.bookings, before.booking);
    assert.equal(total(countIn("hotel")), 0);

    const ws = workspaces.find((w) => w.id === "hotel")!;
    assert.ok(ws.demoDataClearedAt instanceof Date);
    assert.equal(ws.industry, "HOTEL_HOSTEL");
    assert.equal(subscriptions.find((s) => s.workspaceId === "hotel")!.plan, "demo", "plan untouched");

    const after = await json(await statusRoute(req("GET", "/api/workspace/clear-demo-data", "owner-hotel")));
    assert.equal(after.data.hasDemoData, false);
    assert.ok(after.data.demoDataClearedAt);
  });

  it("2. CAR: vehicles, customers, rentals and source payments go to 0", async () => {
    await seeded("car", "CAR_RENTAL");
    assert.ok(countIn("car").vehicle > 0 && countIn("car").vehicleRental > 0);
    assert.equal((await clear("owner-car")).status, 200);
    assert.equal(total(countIn("car")), 0);
  });

  for (const industry of ["OFFICE_RENTAL", "APARTMENT_RENTAL", "RETAIL_RENTAL", "WAREHOUSE_RENTAL", "COMMERCIAL_RENTAL", "OTHER", "VILLA_RENTAL"]) {
    it(`3. ${industry}: all seeded records go to 0`, async () => {
      await seeded("w", industry);
      assert.ok(total(countIn("w")) > 0);
      assert.equal((await clear("owner-w")).status, 200);
      assert.deepEqual(countIn("w"), Object.fromEntries(Object.keys(countIn("w")).map((k) => [k, 0])));
    });
  }

  it("legacy workspace without demoSeededAt is anchored on workspace creation", async () => {
    await seeded("old", "OFFICE_RENTAL");
    workspaces.find((w) => w.id === "old")!.demoSeededAt = null;
    assert.equal((await clear("owner-old")).status, 200);
    assert.equal(total(countIn("old")), 0);
  });
});

describe("clear demo data — idempotency and seed prevention", () => {
  it("4. a second clear is a no-op", async () => {
    await seeded("h", "HOTEL_HOSTEL");
    await clear("owner-h");
    const res = await clear("owner-h");
    assert.equal(res.status, 200);
    const { data } = await json(res);
    assert.equal(data.alreadyCleared, true);
    assert.equal(total(data.deleted), 0);
  });

  it("5. the demo seed never runs again after a clear", async () => {
    await seeded("h", "HOTEL_HOSTEL");
    await clear("owner-h");
    assert.deepEqual(await seedDemoWorkspace({ workspaceId: "h" }), { seeded: false, reason: "CLEARED" });
    assert.equal(total(countIn("h")), 0);
  });

  it("a never-seeded empty workspace gets 409 and is not marked", async () => {
    addWorkspace("empty", "OFFICE_RENTAL");
    const res = await clear("owner-empty");
    assert.equal(res.status, 409);
    assert.equal((await json(res)).code, "NO_DEMO_DATA");
    assert.equal(workspaces[0]!.demoDataClearedAt, null);
  });
});

describe("clear demo data — real data protection", () => {
  it("6. real records and anything real attached to demo records survive", async () => {
    await seeded("o", "OFFICE_RENTAL");
    const later = new Date(Date.now() + 2 * 60 * 60_000);
    const contract = tables.contract!.find((c) => c.workspaceId === "o")!;
    const property = tables.property!.find((p) => p.workspaceId === "o" && p.id !== contract.propertyId)!;
    tables.property!.push(newRow({ workspaceId: "o", title: "Real office", description: null }));
    tables.property!.push(newRow({ workspaceId: "o", title: "Typed marker later", description: DEMO_SEED_NOTE, createdAt: later }));
    tables.tenant!.push(newRow({ workspaceId: "o", fullName: "Nova Design", phone: "+998901234567" }));
    tables.expense!.push(newRow({ workspaceId: "o", title: "Real rent", notes: null }));
    tables.payment!.push(newRow({ workspaceId: "o", contractId: contract.id, amount: 100, notes: "real" }));
    tables.maintenance!.push(newRow({ workspaceId: "o", propertyId: property.id }));

    const res = await clear("owner-o");
    assert.equal(res.status, 200);
    const { data } = await json(res);

    const ids = (m: string) => new Set(tables[m]!.filter((r) => r.workspaceId === "o").map((r) => r.id));
    assert.ok([...ids("property")].length >= 4);
    assert.ok(tables.property!.some((p) => p.title === "Real office"));
    assert.ok(tables.property!.some((p) => p.title === "Typed marker later"), "outside seed window");
    assert.ok(tables.tenant!.some((t) => t.phone === "+998901234567"), "real phone with demo name");
    assert.ok(tables.expense!.some((e) => e.title === "Real rent"));
    assert.ok(ids("contract").has(contract.id), "contract with a real payment is kept");
    assert.ok(ids("property").has(contract.propertyId), "its room is kept");
    assert.ok(ids("tenant").has(contract.tenantId), "its tenant is kept");
    assert.equal(tables.payment!.filter((p) => p.contractId === contract.id).length, 2, "demo + real payment kept together");
    assert.ok(ids("property").has(property.id), "room with maintenance is kept");
    assert.equal(tables.maintenance!.length, 1);
    assert.ok(data.kept.contracts >= 1 && data.kept.properties >= 2);
  });

  it("a real source payment on a demo booking keeps that booking, room and guest", async () => {
    await seeded("h", "HOTEL_HOSTEL");
    const booking = tables.booking!.find((b) => b.workspaceId === "h")!;
    tables.sourcePayment!.push(newRow({ workspaceId: "h", bookingId: booking.id, sourceType: "BOOKING", amount: 5 }));
    await clear("owner-h");
    assert.ok(tables.booking!.some((b) => b.id === booking.id));
    assert.ok(tables.property!.some((p) => p.id === booking.propertyId));
    assert.ok(tables.tenant!.some((t) => t.id === booking.tenantId));
    assert.equal(tables.sourcePayment!.filter((s) => s.bookingId === booking.id).length >= 1, true);
  });
});

describe("clear demo data — security", () => {
  it("7. clearing A never touches B, even if the body names B", async () => {
    await seeded("a", "HOTEL_HOSTEL");
    await seeded("b", "HOTEL_HOSTEL");
    const beforeB = countIn("b");
    assert.equal((await clear("owner-a", { workspaceId: "b" })).status, 200);
    assert.equal(total(countIn("a")), 0);
    assert.deepEqual(countIn("b"), beforeB);
    assert.equal(workspaces.find((w) => w.id === "b")!.demoDataClearedAt, null);
  });

  it("8. unauthenticated requests get 401", async () => {
    assert.equal((await statusRoute(req("GET", "/api/workspace/clear-demo-data", null))).status, 401);
    assert.equal((await clearRoute(req("POST", "/api/workspace/clear-demo-data", null))).status, 401);
  });

  it("9. MANAGER / EMPLOYEE and non-owner members are forbidden", async () => {
    await seeded("h", "HOTEL_HOSTEL");
    users.set("manager-h", { role: "MANAGER", workspaceId: "h", memberRole: "MANAGER" });
    users.set("employee-h", { role: "EMPLOYEE", workspaceId: "h", memberRole: "EMPLOYEE" });
    users.set("admin-member-h", { role: "ADMIN", workspaceId: "h", memberRole: "MANAGER" });
    const before = countIn("h");
    assert.equal((await clear("manager-h")).status, 403);
    assert.equal((await clear("employee-h")).status, 403);
    const member = await clear("admin-member-h");
    assert.equal(member.status, 403);
    assert.equal((await json(member)).code, "FORBIDDEN");
    assert.deepEqual(countIn("h"), before);
  });

  it("10. PRO / PREMIUM workspaces cannot clear; FREE can", async () => {
    await seeded("pro", "HOTEL_HOSTEL", { plan: "pro", status: "ACTIVE" });
    await seeded("prem", "OFFICE_RENTAL", { plan: "PREMIUM", status: "ACTIVE" });
    await seeded("free", "OFFICE_RENTAL", { plan: "FREE", status: "ACTIVE" });
    const beforePro = countIn("pro");
    const res = await clear("owner-pro");
    assert.equal(res.status, 403);
    assert.equal((await json(res)).code, "PLAN_NOT_ELIGIBLE");
    assert.equal((await clear("owner-prem")).status, 403);
    assert.deepEqual(countIn("pro"), beforePro);
    const status = await json(await statusRoute(req("GET", "/api/workspace/clear-demo-data", "owner-pro")));
    assert.equal(status.data.eligible, false);
    assert.equal((await clear("owner-free")).status, 200);
  });
});

describe("real data entry after clearing", () => {
  it("11/12/13. HOTEL: room and guest are blocked by the demo quota, then work; booking works", async () => {
    await seeded("h", "HOTEL_HOSTEL");
    const room = { title: "Real 501", address: "Real", region: "Toshkent", district: "Real", rentPrice: 400_000 };
    const blocked = await createPropertyRoute(req("POST", "/api/properties", "owner-h", room));
    assert.equal(blocked.status, 403, "demo seed fills the DEMO room quota");
    assert.equal((await json(blocked)).code, "PLAN_LIMIT_REACHED");

    await clear("owner-h");

    const created = await createPropertyRoute(req("POST", "/api/properties", "owner-h", room));
    assert.equal(created.status, 201);
    const property = (await json(created)).data;
    assert.equal(property.workspaceId, "h");

    const ctx = await resolveUserWorkspaceContext((await prisma.user.findUnique({ where: { id: "owner-h" } }))!);
    const guest = await createWithinPlanLimit(ctx, "tenants", (db) =>
      db.tenant.create({ data: { workspaceId: "h", fullName: "Real Guest", phone: "+998911112233" } as never })
    );

    const today = tashkentToday();
    const booking = await createBookingRoute(req("POST", "/api/bookings", "owner-h", {
      propertyId: property.id,
      tenantId: (guest as { id: string }).id,
      checkInDate: today,
      checkOutDate: addDays(today, 2),
      nightlyRate: 400_000,
      guestCount: 1,
    }));
    assert.equal(booking.status, 201);
    assert.equal(countIn("h").booking, 1);
    assert.equal(countIn("h").property, 1);
    assert.equal(countIn("h").tenant, 1);
  });

  it("12. tenant quota is free after clearing (OFFICE)", async () => {
    await seeded("o", "OFFICE_RENTAL");
    const ctx = await resolveUserWorkspaceContext((await prisma.user.findUnique({ where: { id: "owner-o" } }))!);
    const make = () =>
      createWithinPlanLimit(ctx, "tenants", (db) =>
        db.tenant.create({ data: { workspaceId: "o", fullName: "Real Co", phone: "+998931234567" } as never })
      );
    await assert.rejects(make(), /tarifida/);
    await clear("owner-o");
    await make();
    assert.equal(countIn("o").tenant, 1);
  });

  it("14. CAR: vehicle quota blocked by demo cars, works after clearing", async () => {
    await seeded("c", "CAR_RENTAL");
    const car = { brand: "Chevrolet", model: "Onix", year: 2024, plateNumber: "01 Z 999 ZZ", dailyRate: 400_000 };
    const blocked = await createVehicleRoute(req("POST", "/api/vehicles", "owner-c", car));
    assert.equal(blocked.status, 403);
    await clear("owner-c");
    const created = await createVehicleRoute(req("POST", "/api/vehicles", "owner-c", car));
    assert.equal(created.status, 201);
    assert.equal(countIn("c").vehicle, 1);
  });
});
