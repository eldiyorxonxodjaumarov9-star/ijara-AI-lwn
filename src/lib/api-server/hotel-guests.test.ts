import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { GET as listRoute, POST as createRoute } from "@/app/api/hotel-guests/route";
import { PATCH as editRoute } from "@/app/api/hotel-guests/[id]/route";
import { GET as bookingsRoute } from "@/app/api/bookings/route";
import { PATCH as bookingPatchRoute } from "@/app/api/bookings/[id]/route";
import { prisma } from "@/lib/api-server/prisma";
import {
  addDays,
  countCurrentGuests,
  selectOccupiedPropertyIds,
  selectTodayCheckIns,
  selectUpcomingArrivals,
  tashkentToday,
  type Booking,
} from "@/lib/bookings";
import { initialGuestStatus, isHotelGuestIndustry, parseHotelGuestInput, type HotelGuestList } from "@/lib/hotel-guests";

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
  "tenant", "tenantArchive", "client", "contract", "property", "employee", "vehicle", "booking", "sourcePayment",
] as const;
let tables: Record<string, Row[]> = {};
const workspaces = new Map<string, Row>();
const users = new Map<string, { role: string; workspaceId: string }>();

const time = (v: unknown) => (v instanceof Date ? v.getTime() : Number(v));

function matchValue(row: Row, key: string, cond: unknown): boolean {
  const value = row[key];
  if (key === "bookings" && cond && typeof cond === "object" && "none" in cond) {
    return !tables.booking!.some((b) => b.tenantId === row.id);
  }
  if (cond === null) return value == null;
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  if (typeof cond !== "object") return value === cond;
  const c = cond as Record<string, unknown>;
  const insensitive = c.mode === "insensitive";
  return Object.entries(c).every(([op, arg]) => {
    switch (op) {
      case "in": return (arg as unknown[]).includes(value);
      case "not": return arg === null ? value != null : value !== arg;
      case "lt": return value != null && time(value) < time(arg);
      case "gt": return value != null && time(value) > time(arg);
      case "gte": return value != null && time(value) >= time(arg);
      case "lte": return value != null && time(value) <= time(arg);
      case "equals":
        return insensitive ? String(value).toLowerCase() === String(arg).toLowerCase() : value === arg;
      case "contains": return typeof value === "string" && value.includes(String(arg));
      case "startsWith": return typeof value === "string" && value.startsWith(String(arg));
      case "mode": return true;
      default: throw new Error(`unsupported operator ${op}`);
    }
  });
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((w) => matches(row, w));
    if (key === "AND") return (cond as Row[]).every((w) => matches(row, w));
    if (key === "NOT") return !matches(row, cond as Row);
    return matchValue(row, key, cond);
  });
}

function withInclude(name: string, row: Row, include?: Row) {
  const out = { ...row };
  if (name === "booking" && include) {
    const p = tables.property!.find((x) => x.id === row.propertyId);
    const t = tables.tenant!.find((x) => x.id === row.tenantId);
    if (include.property) out.property = p ? { title: p.title } : null;
    if (include.tenant) out.tenant = t ? { fullName: t.fullName, phone: t.phone, clientNumber: t.clientNumber ?? null } : null;
  }
  return out;
}

const DEFAULTS: Record<string, Row> = {
  tenant: { login: null, password: null, leftAt: null, clientNumber: null, telegramChatId: null },
  booking: { status: "CONFIRMED", guestCount: 1, notes: null },
  client: { loginCount: 1 },
};

function modelImpl(name: string) {
  const rows = () => tables[name]!;
  return {
    findMany: async (a: { where?: Row; include?: Row } = {}) =>
      rows().filter((r) => matches(r, a.where)).map((r) => withInclude(name, r, a.include)),
    findFirst: async (a: { where?: Row; include?: Row } = {}) => {
      const r = rows().find((x) => matches(x, a.where));
      return r ? withInclude(name, r, a.include) : null;
    },
    findUnique: async (a: { where: Row; include?: Row }) => {
      const r = rows().find((x) => matches(x, a.where));
      return r ? withInclude(name, r, a.include) : null;
    },
    count: async (a: { where?: Row } = {}) => rows().filter((r) => matches(r, a.where)).length,
    create: async (a: { data: Row }) => {
      const now = new Date();
      const r: Row = { id: randomUUID(), createdAt: now, updatedAt: now, ...DEFAULTS[name], ...a.data };
      rows().push(r);
      return { ...r };
    },
    update: async (a: { where: Row; data: Row }) => {
      const r = rows().find((x) => matches(x, a.where));
      if (!r) throw new Error(`${name} not found`);
      Object.assign(r, a.data);
      return { ...r };
    },
    updateMany: async (a: { where?: Row; data: Row }) => {
      const hit = rows().filter((r) => matches(r, a.where));
      hit.forEach((r) => Object.assign(r, a.data));
      return { count: hit.length };
    },
    deleteMany: async (a: { where?: Row } = {}) => {
      const keep = rows().filter((r) => !matches(r, a.where));
      const count = rows().length - keep.length;
      tables[name] = keep;
      return { count };
    },
    aggregate: async (a: { where?: Row }) => {
      const hit = rows().filter((r) => matches(r, a.where));
      return { _sum: { amount: hit.length ? hit.reduce((s, r) => s + Number(r.amount), 0) : null } };
    },
    groupBy: async (a: { by: string[]; where?: Row }) => {
      const key = a.by[0]!;
      const groups = new Map<unknown, Row[]>();
      for (const r of rows().filter((x) => matches(x, a.where))) {
        groups.set(r[key], [...(groups.get(r[key]) ?? []), r]);
      }
      return [...groups.entries()].map(([k, list]) => ({
        [key]: k,
        _sum: { amount: list.reduce((s, r) => s + Number(r.amount), 0) },
        _max: { paymentDate: list.map((r) => r.paymentDate as Date).sort((x, y) => y.getTime() - x.getTime())[0] },
        _count: { _all: list.length },
      }));
    },
  };
}

function token(userId: string) {
  return jwt.sign({ sub: userId, email: `${userId}@example.invalid`, role: "ADMIN" }, signingKey, { expiresIn: "1h" });
}
function req(method: string, url: string, userId: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${token(userId)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(res: Response | undefined) {
  assert.ok(res, "route returned a response");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- route payloads differ per endpoint
  const body = (await res.json()) as { data?: any; message?: string; error?: { code?: string } };
  return { status: res.status, data: body.data, message: body.message, code: body.error?.code };
}

const owner = (ws: string) => `owner-${ws}`;
const create = (ws: string, body: unknown, user = owner(ws)) => createRoute(req("POST", "/api/hotel-guests", user, body)).then(json);
const list = async (ws: string) => (await json(await listRoute(req("GET", "/api/hotel-guests", owner(ws))))).data as HotelGuestList;
const edit = (ws: string, id: string, body: unknown) =>
  editRoute(req("PATCH", `/api/hotel-guests/${id}`, owner(ws), body), { params: Promise.resolve({ id }) }).then(json);
const setStatus = (ws: string, id: string, status: string) =>
  bookingPatchRoute(req("PATCH", `/api/bookings/${id}`, owner(ws), { status }), { params: Promise.resolve({ id }) }).then(json);
const bookingsOf = async (ws: string) => (await json(await bookingsRoute(req("GET", "/api/bookings", owner(ws))))).data as Booking[];

function addWorkspace(id: string, industry: string) {
  workspaces.set(id, {
    id, name: id, slug: null, industry, isInternal: false, createdAt: new Date(), updatedAt: new Date(),
    subscription: { id: `sub-${id}`, workspaceId: id, status: "ACTIVE", plan: "PRO", startedAt: new Date() },
  });
  users.set(owner(id), { role: "ADMIN", workspaceId: id });
}
function addRoom(ws: string, title: string, status = "AVAILABLE") {
  const row = { id: randomUUID(), workspaceId: ws, title, status, rentPrice: 0, createdAt: new Date() };
  tables.property!.push(row);
  return row.id;
}

const TODAY = tashkentToday();
const day = (n: number) => addDays(TODAY, n);
const guest = (propertyId: string, extra: Row = {}) => ({
  fullName: "Ali Valiyev",
  phone: "+998901112233",
  propertyId,
  guestCount: 3,
  checkInDate: TODAY,
  checkOutDate: day(4),
  nightlyRate: 500_000,
  paymentAmount: 0,
  paymentMethod: "CASH",
  notes: "Deraza tomondagi xona",
  ...extra,
});

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;

  mock(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => ({
    id: where.id, email: `${where.id}@example.invalid`, fullName: where.id,
    role: users.get(where.id)?.role ?? "ADMIN", isActive: true, isInternalAccount: false,
  }));
  mock(prisma.user, "findMany", async () => []);
  mock(prisma.company, "findFirst", async () => null);
  for (const model of [prisma.user, prisma.payment, prisma.expense, prisma.maintenance, prisma.partnerCompany,
    prisma.contactLead, prisma.workTask, prisma.notification]) {
    mock(model, "updateMany", async () => ({ count: 0 }));
  }
  mock(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => {
    const u = users.get(where.userId);
    const ws = u && workspaces.get(u.workspaceId);
    return ws ? { role: u!.role === "EMPLOYEE" ? "MEMBER" : "OWNER", workspace: ws } : null;
  });
  for (const name of MODELS) {
    const model = Reflect.get(prisma, name) as object;
    for (const [method, fn] of Object.entries(modelImpl(name))) mock(model, method, fn);
  }
  mock(prisma.workspace, "findFirst", async () => ({ id: "internal", isInternal: true }));
  mock(prisma.workspace, "findUnique", async ({ where }: { where: { id: string } }) => workspaces.get(where.id) ?? null);
  mock(prisma.workspaceSubscription, "findUnique", async ({ where }: { where: { workspaceId: string } }) =>
    where.workspaceId === "internal"
      ? { workspaceId: "internal", status: "ACTIVE", plan: "internal" }
      : ((workspaces.get(where.workspaceId)?.subscription as Row | undefined) ?? null)
  );
  mock(prisma, "$queryRaw", async () => []);
  mock(prisma, "$transaction", async (fn: (tx: typeof prisma) => unknown) => {
    const snapshot = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
    try {
      return await fn(prisma);
    } catch (err) {
      tables = snapshot;
      throw err;
    }
  });
});

after(() => {
  restores.reverse().forEach((r) => r());
  for (const [key, value] of [["DATABASE_URL", originalEnv.database], ["JWT_ACCESS_SECRET", originalEnv.jwt]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

let roomA: string;
let roomB: string;
let otherRoom: string;
beforeEach(() => {
  tables = Object.fromEntries(MODELS.map((m) => [m, []]));
  workspaces.clear();
  users.clear();
  addWorkspace("hotel", "HOTEL_HOSTEL");
  addWorkspace("other", "HOTEL_HOSTEL");
  addWorkspace("villa", "VILLA_RENTAL");
  addWorkspace("office", "OFFICE_RENTAL");
  roomA = addRoom("hotel", "101");
  roomB = addRoom("hotel", "Domik 2");
  otherRoom = addRoom("other", "Other 1");
});

describe("hotel guest create", () => {
  it("creates guest + booking: FIO, phone, room, people, dates, nights, rate, total; today → CHECKED_IN", async () => {
    const res = await create("hotel", guest(roomA));
    assert.equal(res.status, 201, res.message);
    const tenant = tables.tenant!.find((t) => t.id === res.data.tenantId)!;
    assert.equal(tenant.fullName, "Ali Valiyev");
    assert.equal(tenant.phone, "+998901112233");
    assert.equal(tenant.workspaceId, "hotel");
    assert.equal(tenant.login, null);
    assert.equal(tenant.password, null);

    assert.equal(tables.booking!.length, 1);
    const b = res.data.booking;
    assert.equal(b.propertyId, roomA);
    assert.equal(b.tenantId, tenant.id);
    assert.equal(b.guestCount, 3);
    assert.equal(b.checkInDate, TODAY);
    assert.equal(b.checkOutDate, day(4));
    assert.equal(b.nights, 4);
    assert.equal(b.nightlyRate, 500_000);
    assert.equal(b.totalAmount, 2_000_000);
    assert.equal(b.status, "CHECKED_IN");
    assert.equal(b.notes, "Deraza tomondagi xona");
  });

  it("total is server-computed: a client-sent total is ignored", async () => {
    const res = await create("hotel", guest(roomA, { totalAmount: 1, nights: 99 }));
    assert.equal(res.data.booking.totalAmount, 2_000_000);
    assert.equal(res.data.booking.nights, 4);
  });

  it("future arrival → CONFIRMED", async () => {
    const res = await create("hotel", guest(roomA, { checkInDate: day(3), checkOutDate: day(5) }));
    assert.equal(res.status, 201);
    assert.equal(res.data.booking.status, "CONFIRMED");
  });

  it("never creates a Contract and never stores credentials or monthly-rent fields", async () => {
    await create("hotel", guest(roomA, { login: "x", password: "123456", contractDuration: 12, rentAmount: 9 }));
    assert.equal(tables.contract!.length, 0);
    const t = tables.tenant![0]!;
    assert.equal(t.login, null);
    assert.equal(t.password, null);
    assert.equal(t.rentAmount, 0);
    assert.equal(t.contractDuration, undefined);
  });

  it("guest/customer record (client base) is synced", async () => {
    const res = await create("hotel", guest(roomA));
    assert.ok(tables.client!.some((c) => c.tenantId === res.data.tenantId));
  });
});

describe("hotel guest payment", () => {
  it("no payment → UNPAID, no source payment", async () => {
    const res = await create("hotel", guest(roomA));
    assert.equal(res.data.payment.status, "UNPAID");
    assert.equal(tables.sourcePayment!.length, 0);
  });

  it("partial payment → real source payment, PARTIAL, remaining 1m", async () => {
    const res = await create("hotel", guest(roomA, { paymentAmount: 1_000_000, paymentMethod: "CARD" }));
    assert.equal(res.status, 201, res.message);
    assert.deepEqual(res.data.payment, { total: 2_000_000, paid: 1_000_000, remaining: 1_000_000, status: "PARTIAL" });
    const p = tables.sourcePayment![0]!;
    assert.equal(p.bookingId, res.data.booking.id);
    assert.equal(p.sourceType, "BOOKING");
    assert.equal(p.amount, 1_000_000);
    assert.equal(p.paymentMethod, "CARD");
    assert.equal(p.workspaceId, "hotel");
  });

  it("full payment → PAID", async () => {
    const res = await create("hotel", guest(roomA, { paymentAmount: 2_000_000 }));
    assert.equal(res.data.payment.status, "PAID");
    assert.equal(res.data.payment.remaining, 0);
  });

  it("overpayment → 400, nothing written", async () => {
    const res = await create("hotel", guest(roomA, { paymentAmount: 2_000_001 }));
    assert.equal(res.status, 400);
    assert.equal(tables.tenant!.length + tables.booking!.length + tables.sourcePayment!.length, 0);
  });

  it("EMPLOYEE can place a guest but cannot record money", async () => {
    users.set("emp", { role: "EMPLOYEE", workspaceId: "hotel" });
    const denied = await create("hotel", guest(roomA, { paymentAmount: 100_000 }), "emp");
    assert.equal(denied.status, 403);
    assert.equal(tables.tenant!.length, 0);
    const ok = await create("hotel", guest(roomA), "emp");
    assert.equal(ok.status, 201);
  });
});

describe("hotel guest room rules and isolation", () => {
  it("room from another workspace → 404, guest rolled back", async () => {
    const res = await create("hotel", guest(otherRoom));
    assert.equal(res.status, 404);
    assert.equal(res.code, "PROPERTY_NOT_FOUND");
    assert.equal(tables.tenant!.length, 0);
    assert.equal(tables.booking!.length, 0);
  });

  it("overlapping stay in the same room → 409 PROPERTY_NOT_AVAILABLE, second guest rolled back", async () => {
    await create("hotel", guest(roomA));
    const res = await create("hotel", guest(roomA, { fullName: "Boshqa", checkInDate: day(2), checkOutDate: day(6) }));
    assert.equal(res.status, 409);
    assert.equal(res.code, "PROPERTY_NOT_AVAILABLE");
    assert.equal(tables.tenant!.length, 1);
    const back = await create("hotel", guest(roomA, { fullName: "Keyingi", checkInDate: day(4), checkOutDate: day(6) }));
    assert.equal(back.status, 201, "checkout day is free for the next guest");
  });

  it("room under maintenance → 409", async () => {
    const r = addRoom("hotel", "Ta'mir", "MAINTENANCE");
    assert.equal((await create("hotel", guest(r))).status, 409);
  });

  it("guest edit from another workspace → 404 and nothing changes", async () => {
    const res = await create("hotel", guest(roomA));
    const id = res.data.booking.id;
    const cross = await edit("other", id, { fullName: "Hacker", guestCount: 9 });
    assert.equal(cross.status, 404);
    assert.equal(tables.tenant![0]!.fullName, "Ali Valiyev");
    assert.equal(tables.booking![0]!.guestCount, 3);
  });

  it("other workspace list does not see the guest", async () => {
    await create("hotel", guest(roomA));
    assert.equal((await list("other")).rows.length, 0);
  });

  it("only HOTEL_HOSTEL: VILLA and OFFICE get 403", async () => {
    assert.equal((await create("villa", guest(roomA))).status, 403);
    assert.equal((await create("office", guest(roomA))).status, 403);
  });

  it("validation: people ≥ 1, checkout after checkin, rate > 0, ended stay rejected", async () => {
    assert.equal((await create("hotel", guest(roomA, { guestCount: 0 }))).status, 400);
    assert.equal((await create("hotel", guest(roomA, { checkOutDate: TODAY }))).status, 400);
    assert.equal((await create("hotel", guest(roomA, { nightlyRate: 0 }))).status, 400);
    assert.equal((await create("hotel", guest(roomA, { checkInDate: day(-5), checkOutDate: day(-1) }))).status, 400);
    assert.equal((await create("hotel", guest(""))).status, 400);
    assert.equal(tables.tenant!.length, 0);
  });
});

describe("hotel guest list, edit, checkout, dashboard", () => {
  it("guest list shows room, people, dates, status, paid and remaining", async () => {
    await create("hotel", guest(roomA, { paymentAmount: 1_000_000 }));
    const { rows, unplaced } = await list("hotel");
    assert.equal(rows.length, 1);
    const r = rows[0]!;
    assert.equal(r.fullName, "Ali Valiyev");
    assert.equal(r.phone, "+998901112233");
    assert.equal(r.propertyName, "101");
    assert.equal(r.guestCount, 3);
    assert.equal(r.checkInDate, TODAY);
    assert.equal(r.checkOutDate, day(4));
    assert.equal(r.status, "CHECKED_IN");
    assert.equal(r.paid, 1_000_000);
    assert.equal(r.remaining, 1_000_000);
    assert.equal(r.paymentStatus, "PARTIAL");
    assert.equal(unplaced.length, 0);
  });

  it("edit updates FIO, phone, people, room, dates, rate and notes", async () => {
    const res = await create("hotel", guest(roomA));
    const id = res.data.booking.id;
    const e = await edit("hotel", id, {
      fullName: "Ali Valiyev Jr", phone: "+998907776655", guestCount: 2, propertyId: roomB,
      checkInDate: TODAY, checkOutDate: day(2), nightlyRate: 600_000, notes: "Yangilandi",
    });
    assert.equal(e.status, 200, e.message);
    const b = tables.booking![0]!;
    assert.equal(b.propertyId, roomB);
    assert.equal(b.guestCount, 2);
    assert.equal(b.nights, 2);
    assert.equal(b.totalAmount, 1_200_000);
    assert.equal(b.notes, "Yangilandi");
    const t = tables.tenant![0]!;
    assert.equal(t.fullName, "Ali Valiyev Jr");
    assert.equal(t.phone, "+998907776655");
    assert.equal(tables.contract!.length, 0);
  });

  it("edit moving into an occupied room → 409 PROPERTY_NOT_AVAILABLE, guest name unchanged", async () => {
    await create("hotel", guest(roomB, { fullName: "Band" }));
    const res = await create("hotel", guest(roomA));
    const e = await edit("hotel", res.data.booking.id, { fullName: "O'zgardi", propertyId: roomB });
    assert.equal(e.status, 409);
    assert.equal(e.code, "PROPERTY_NOT_AVAILABLE");
    assert.equal(tables.tenant!.find((t) => t.id === res.data.tenantId)!.fullName, "Ali Valiyev");
  });

  it("check-out closes the stay, keeps booking + payment history and frees the room", async () => {
    const res = await create("hotel", guest(roomA, { paymentAmount: 500_000 }));
    const id = res.data.booking.id;
    const out = await setStatus("hotel", id, "CHECKED_OUT");
    assert.equal(out.status, 200, out.message);
    assert.equal(tables.booking![0]!.status, "CHECKED_OUT");
    assert.equal(tables.tenant!.length, 1);
    assert.equal(tables.sourcePayment!.length, 1);
    const { rows } = await list("hotel");
    assert.equal(rows[0]!.status, "CHECKED_OUT");
    const next = await create("hotel", guest(roomA, { fullName: "Yangi mehmon" }));
    assert.equal(next.status, 201, "room is free after check-out");
    assert.equal((await edit("hotel", id, { guestCount: 5 })).code, "BOOKING_CLOSED");
  });

  it("dashboard selectors see the new guest immediately (occupied, guests, check-ins, upcoming)", async () => {
    await create("hotel", guest(roomA));
    await create("hotel", guest(roomB, { fullName: "Kelajak", guestCount: 2, checkInDate: day(2), checkOutDate: day(3) }));
    const bookings = await bookingsOf("hotel");
    assert.equal(bookings.length, 2);
    assert.deepEqual([...selectOccupiedPropertyIds(bookings, TODAY)], [roomA]);
    assert.equal(countCurrentGuests(bookings), 3);
    assert.equal(selectTodayCheckIns(bookings, TODAY).length, 1);
    assert.equal(selectUpcomingArrivals(bookings, TODAY).length, 1);
  });
});

describe("hotel guest helpers and form", () => {
  it("industry gate is HOTEL_HOSTEL only", () => {
    assert.equal(isHotelGuestIndustry("HOTEL_HOSTEL"), true);
    for (const i of ["VILLA_RENTAL", "OFFICE_RENTAL", "APARTMENT_RENTAL", undefined]) assert.equal(isHotelGuestIndustry(i), false);
  });

  it("initial status: started stay → CHECKED_IN, future → CONFIRMED, ended → error", () => {
    assert.equal(initialGuestStatus({ checkInDate: "2026-10-06", checkOutDate: "2026-10-08" }, "2026-10-06").data, "CHECKED_IN");
    assert.equal(initialGuestStatus({ checkInDate: "2026-10-07", checkOutDate: "2026-10-08" }, "2026-10-06").data, "CONFIRMED");
    assert.ok(initialGuestStatus({ checkInDate: "2026-10-01", checkOutDate: "2026-10-06" }, "2026-10-06").error);
  });

  it("parser rejects payment above the computed total", () => {
    const r = parseHotelGuestInput(guest("room", { checkInDate: "2026-10-06", checkOutDate: "2026-10-08", paymentAmount: 1_000_001 }));
    assert.ok(r.error);
  });

  const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

  it("hotel form: required fields in order, no credentials, no long-term rental fields", () => {
    const src = read("src/components/tenants/hotel-guest-dialog.tsx");
    for (const banned of ["Login", "Parol", "password", "Ijara summasi", "Arenda to", "Shartnoma muddati", "Depozit", "Qarzga", "contractDuration"]) {
      assert.equal(src.includes(banned), false, `${banned} must not appear`);
    }
    const order = [
      "F.I.O *", "Telefon *", "Xona / Domik *", "Odam soni *", "Kelish sanasi *", "Ketish sanasi *",
      "Tunlik narx", "Jami summa", "To‘lov summasi", "To‘lov turi", "Izoh",
    ].map((label) => src.indexOf(label));
    assert.ok(order.every((i) => i > 0), "all labels present");
    assert.deepEqual([...order].sort((a, b) => a - b), order, "labels in the requested order");
    assert.match(src, /Yangi mehmon/);
    assert.match(src, /Mehmon ma’lumotlari va joylashuvini kiriting\./);
    assert.match(src, /Xona yoki domikni tanlang/);
    assert.match(src, /Mehmonni joylashtirish/);
  });

  it("/tenants routes HOTEL_HOSTEL to the guest view and keeps the rental page for others", () => {
    const src = read("src/app/(dashboard)/tenants/page.tsx");
    assert.match(src, /if \(isHotelGuestIndustry\(workspace\?\.industry\)\) return <HotelGuestsView \/>;/);
    assert.match(src, /return <RentalTenantsPage \/>;/);
    const view = read("src/components/tenants/hotel-guests-view.tsx");
    for (const banned of [" oy", "Ijara", "To'lov muddati", "Butunlay o"]) {
      assert.equal(view.includes(banned), false, `${banned} must not appear in the hotel view`);
    }
    for (const col of ["Xona / Domik", "Odam soni", "Kelish", "Ketish", "Holat", "To‘langan / Qolgan", "Check-out"]) {
      assert.ok(view.includes(col), col);
    }
  });
});
