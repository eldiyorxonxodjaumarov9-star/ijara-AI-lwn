import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";

import { getIndustryNavigation } from "@/config/industry-navigation";
import {
  countBookingInventory,
  getIndustryDashboardConfig,
  industryBlockMode,
  resolveIndustryInventory,
  resolveIndustryKpiValue,
} from "@/lib/dashboard-industry";
import {
  addDays,
  availableBookingActions,
  bookingNights,
  bookingRangesOverlap,
  bookingTerms,
  bookingTotal,
  canTransition,
  countCurrentGuests,
  isBookingIndustry,
  arrivalBadge,
  ARRIVAL_STATUS_LABELS,
  parseBookingInput,
  parseBookingUpdate,
  selectCurrentStays,
  selectExpectedArrivals,
  selectOverdueArrivals,
  selectTodayArrivals,
  selectTodayCheckIns,
  selectTodayCheckOuts,
  selectUpcomingArrivals,
  selectUpcomingDepartures,
  tashkentToday,
  type Booking,
  type BookingInput,
} from "@/lib/bookings";
import { RENTAL_INDUSTRIES } from "@/lib/rental-industry";

import {
  assertBookingIndustry,
  BookingError,
  createBooking,
  deleteBooking,
  getBooking,
  listBookings,
  propertyBookingHistoryResponse,
  tenantBookingHistoryResponse,
  updateBooking,
  type BookingDb,
} from "./bookings";

const NOW = new Date("2026-10-06T10:00:00+05:00");
const TODAY = tashkentToday(NOW);
const day = (offset: number) => addDays(TODAY, offset);
const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

type Row = Record<string, unknown> & { id: string };
type Cond = Record<string, unknown>;

function matches(row: Row, where: Cond): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "NOT") return !matches(row, cond as Cond);
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; lt?: Date; gt?: Date };
      if (c.in && !c.in.includes(value)) return false;
      if (c.lt && !((value as Date).getTime() < c.lt.getTime())) return false;
      if (c.gt && !((value as Date).getTime() > c.gt.getTime())) return false;
      return true;
    }
    return value === cond;
  });
}

/** In-memory prisma stand-in. `$queryRaw` acts as a per-property row lock held until the tx ends. */
function fakeDb() {
  const t: Record<"booking" | "property" | "tenant", Row[]> = { booking: [], property: [], tenant: [] };
  const locks = new Map<string, Promise<void>>();
  const payments: Row[] = [];
  let seq = 0;
  const withInclude = (row: Row, include?: unknown) => {
    if (!include) return { ...row };
    const p = t.property.find((x) => x.id === row.propertyId);
    const g = t.tenant.find((x) => x.id === row.tenantId);
    return { ...row, property: p && { title: p.title }, tenant: g && { fullName: g.fullName } };
  };
  const model = (name: keyof typeof t) => ({
    findFirst: async ({ where, include }: { where: Cond; include?: unknown }) => {
      const row = t[name].find((r) => matches(r, where));
      return row ? withInclude(row, include) : null;
    },
    findMany: async ({ where, include }: { where: Cond; include?: unknown }) =>
      t[name].filter((r) => matches(r, where)).map((r) => withInclude(r, include)),
    count: async ({ where }: { where: Cond }) => t[name].filter((r) => matches(r, where)).length,
    create: async ({ data }: { data: Row }) => {
      const defaults = name === "booking" ? { arrivalStatus: "EXPECTED" } : {};
      const row = { createdAt: new Date(), ...defaults, ...data, id: data.id ?? `${name}-${++seq}` } as Row;
      t[name].push(row);
      return row;
    },
    updateMany: async ({ where, data }: { where: Cond; data: Cond }) => {
      const hit = t[name].filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    deleteMany: async ({ where }: { where: Cond }) => {
      const before = t[name].length;
      t[name] = t[name].filter((r) => !matches(r, where));
      return { count: before - t[name].length };
    },
  });

  /** Runs `fn` like prisma.$transaction: row locks taken via $queryRaw are released at the end. */
  async function transaction<T>(fn: (db: BookingDb) => Promise<T>): Promise<T> {
    const releases: (() => void)[] = [];
    const db = {
      $queryRaw: async (_s: TemplateStringsArray, propertyId: string) => {
        while (locks.has(propertyId)) await locks.get(propertyId);
        let release!: () => void;
        locks.set(propertyId, new Promise<void>((r) => (release = r)));
        releases.push(() => {
          locks.delete(propertyId);
          release();
        });
        await new Promise((r) => setTimeout(r, 5));
        return [];
      },
      booking: model("booking"),
      property: model("property"),
      tenant: model("tenant"),
      sourcePayment: {
        aggregate: async ({ where }: { where: Cond }) => {
          const rows = payments.filter((p) => matches(p, where));
          return { _sum: { amount: rows.length ? rows.reduce((s, p) => s + (p.amount as number), 0) : null } };
        },
      },
    } as unknown as BookingDb;
    try {
      return await fn(db);
    } finally {
      releases.forEach((r) => r());
    }
  }

  const addProperty = (workspaceId: string, status = "AVAILABLE") => {
    const row = { id: `prop-${++seq}`, workspaceId, title: `Room ${seq}`, status };
    t.property.push(row);
    return row;
  };
  const addGuest = (workspaceId: string) => {
    const row = { id: `guest-${++seq}`, workspaceId, fullName: `Guest ${seq}` };
    t.tenant.push(row);
    return row;
  };
  const addPayment = (workspaceId: string, bookingId: string, amount: number) =>
    payments.push({ id: `pay-${++seq}`, workspaceId, bookingId, amount });
  return { t, transaction, addProperty, addGuest, addPayment };
}

describe("Stage 10: booking total cannot drop below paid", () => {
  it("total 3m, paid 2m: 1.5m → 409 TOTAL_BELOW_PAID; 2m and 4m allowed", async () => {
    const { transaction, addProperty, addGuest, addPayment } = fakeDb();
    const p = addProperty("A");
    const g = addGuest("A");
    const b = await transaction((db) =>
      createBooking(db, "A", input(p.id, g.id, day(1), day(4), { nightlyRate: 1_000_000 }))
    );
    assert.equal(b.totalAmount, 3_000_000);
    addPayment("A", b.id, 2_000_000);
    await assert.rejects(
      transaction((db) => updateBooking(db, "A", b.id, { nightlyRate: 500_000 }, NOW)),
      (e: unknown) => e instanceof BookingError && e.status === 409 && e.code === "TOTAL_BELOW_PAID"
    );
    assert.equal((await transaction((db) => getBooking(db, "A", b.id))).totalAmount, 3_000_000);
    const two = await transaction((db) => updateBooking(db, "A", b.id, { checkInDate: day(1), checkOutDate: day(3) }, NOW));
    assert.equal(two.totalAmount, 2_000_000);
    const four = await transaction((db) => updateBooking(db, "A", b.id, { checkInDate: day(1), checkOutDate: day(5) }, NOW));
    assert.equal(four.totalAmount, 4_000_000);
  });
});

const input = (
  propertyId: string,
  tenantId: string | null,
  checkInDate: string,
  checkOutDate: string,
  extra: Partial<BookingInput> = {}
): BookingInput => ({
  propertyId,
  tenantId,
  guestName: "",
  guestPhone: null,
  checkInDate,
  checkOutDate,
  nightlyRate: 400_000,
  guestCount: 2,
  status: "CONFIRMED",
  notes: null,
  ...extra,
});

async function rejects(p: Promise<unknown>, status: number, code: string) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof BookingError, String(err));
    assert.equal(err.code, code);
    assert.equal(err.status, status);
    return true;
  });
}

function setup() {
  const f = fakeDb();
  const room = f.addProperty("A");
  const guest = f.addGuest("A");
  const create = (i: BookingInput, ws = "A") => f.transaction((db) => createBooking(db, ws, i));
  const update = (id: string, body: Parameters<typeof updateBooking>[3], ws = "A") =>
    f.transaction((db) => updateBooking(db, ws, id, body, NOW));
  const remove = (id: string, ws = "A") => f.transaction((db) => deleteBooking(db, ws, id));
  return { ...f, room, guest, create, update, remove };
}

describe("pricing / nights (hotel convention)", () => {
  it("10→11 = 1 night, 10→13 = 3 nights, total = nights × rate", () => {
    assert.equal(bookingNights("2026-10-10", "2026-10-11"), 1);
    assert.equal(bookingNights("2026-10-10", "2026-10-13"), 3);
    assert.equal(bookingNights("2026-12-31", "2027-01-02"), 2);
    assert.equal(bookingTotal(3, 450_000), 1_350_000);
  });

  it("same date and reversed dates are rejected", () => {
    assert.equal(bookingNights("2026-10-10", "2026-10-10"), null);
    assert.equal(bookingNights("2026-10-11", "2026-10-10"), null);
    const base = { propertyId: "p", tenantId: "t", checkInDate: day(0), checkOutDate: day(2), nightlyRate: 100 };
    assert.match(parseBookingInput({ ...base, checkOutDate: day(0) }).error ?? "", /kamida 1 tun/);
    assert.match(parseBookingInput({ ...base, checkOutDate: day(-1) }).error ?? "", /kamida 1 tun/);
    assert.match(parseBookingInput({ ...base, checkInDate: "10.10.2026" }).error ?? "", /Kirish/);
    assert.match(parseBookingInput({ ...base, nightlyRate: 0 }).error ?? "", /0 dan katta/);
    assert.match(parseBookingInput({ ...base, nightlyRate: -1 }).error ?? "", /0 dan katta/);
    assert.match(parseBookingInput({ ...base, guestCount: 0 }).error ?? "", /Mehmonlar soni/);
    assert.match(parseBookingInput({ ...base, checkOutDate: day(400) }).error ?? "", /365/);
    assert.match(parseBookingInput({ ...base, status: "CHECKED_IN" }).error ?? "", /Yangi bron/);
    assert.equal(parseBookingInput(base).data?.status, "CONFIRMED");
    assert.equal(parseBookingInput({ ...base, tenantId: undefined, customerId: "c" }).data?.tenantId, "c");
    assert.equal("workspaceId" in (parseBookingInput({ ...base, workspaceId: "B" }).data ?? {}), false);
    assert.equal("industry" in (parseBookingInput({ ...base, industry: "HOTEL_HOSTEL" }).data ?? {}), false);
    assert.equal("propertyId" in (parseBookingUpdate({ propertyId: "other" }).data ?? {}), false);
    assert.match(parseBookingUpdate({ checkInDate: day(1) }).error ?? "", /Chiqish/);
  });

  it("server computes nights and total, ignoring any client total", async () => {
    const s = setup();
    const b = await s.create({ ...input(s.room.id, s.guest.id, day(0), day(3)), totalAmount: 1 } as BookingInput);
    assert.equal(b.nights, 3);
    assert.equal(b.totalAmount, 1_200_000);
    assert.equal(s.t.booking[0].totalAmount, 1_200_000);
  });
});

describe("availability", () => {
  it("overlap rejects; adjacent checkout/check-in is allowed", async () => {
    assert.equal(bookingRangesOverlap({ checkInDate: "2026-10-10", checkOutDate: "2026-10-12" }, { checkInDate: "2026-10-12", checkOutDate: "2026-10-14" }), false);
    assert.equal(bookingRangesOverlap({ checkInDate: "2026-10-10", checkOutDate: "2026-10-12" }, { checkInDate: "2026-10-11", checkOutDate: "2026-10-14" }), true);
    const s = setup();
    await s.create(input(s.room.id, s.guest.id, day(0), day(2)));
    await rejects(s.create(input(s.room.id, s.guest.id, day(1), day(3))), 409, "PROPERTY_NOT_AVAILABLE");
    await rejects(s.create(input(s.room.id, s.guest.id, day(-1), day(5))), 409, "PROPERTY_NOT_AVAILABLE");
    const adjacent = await s.create(input(s.room.id, s.guest.id, day(2), day(4)));
    assert.equal(adjacent.status, "CONFIRMED");
    const before = await s.create(input(s.room.id, s.guest.id, day(-2), day(0)));
    assert.equal(before.nights, 2);
  });

  it("PENDING blocks; CANCELLED and CHECKED_OUT do not", async () => {
    const s = setup();
    const pending = await s.create(input(s.room.id, s.guest.id, day(5), day(7), { status: "PENDING" }));
    await rejects(s.create(input(s.room.id, s.guest.id, day(6), day(8))), 409, "PROPERTY_NOT_AVAILABLE");
    await s.update(pending.id, { status: "CANCELLED" });
    await s.create(input(s.room.id, s.guest.id, day(6), day(8)));

    const stay = await s.create(input(s.room.id, s.guest.id, day(0), day(2)));
    await s.update(stay.id, { status: "CHECKED_IN" });
    await rejects(s.create(input(s.room.id, s.guest.id, day(1), day(2))), 409, "PROPERTY_NOT_AVAILABLE");
    await s.update(stay.id, { status: "CHECKED_OUT" });
    await s.create(input(s.room.id, s.guest.id, day(1), day(2)));
  });

  it("different rooms do not block each other; date edit re-checks availability", async () => {
    const s = setup();
    const other = s.addProperty("A");
    await s.create(input(s.room.id, s.guest.id, day(0), day(3)));
    const b = await s.create(input(other.id, s.guest.id, day(0), day(3)));
    await s.create(input(s.room.id, s.guest.id, day(5), day(6)));
    const moved = await s.update(b.id, { checkInDate: day(1), checkOutDate: day(4), nightlyRate: 500_000 });
    assert.equal(moved.nights, 3);
    assert.equal(moved.totalAmount, 1_500_000);
    const third = await s.create(input(other.id, s.guest.id, day(4), day(6)));
    await rejects(s.update(third.id, { checkInDate: day(3), checkOutDate: day(6) }), 409, "PROPERTY_NOT_AVAILABLE");
  });

  it("parallel creates for the same room and dates: exactly one wins, the other gets 409", async () => {
    const s = setup();
    const results = await Promise.allSettled([
      s.create(input(s.room.id, s.guest.id, day(10), day(12))),
      s.create(input(s.room.id, s.guest.id, day(10), day(12))),
      s.create(input(s.room.id, s.guest.id, day(11), day(13))),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const losers = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    assert.equal(losers.length, 2);
    for (const l of losers) assert.equal((l.reason as BookingError).code, "PROPERTY_NOT_AVAILABLE");
    assert.equal(s.t.booking.length, 1);
  });

  it("maintenance rooms cannot be booked", async () => {
    const s = setup();
    const broken = s.addProperty("A", "MAINTENANCE");
    await rejects(s.create(input(broken.id, s.guest.id, day(0), day(1))), 409, "PROPERTY_NOT_BOOKABLE");
  });

  it("creating a booking never writes property.status", async () => {
    const s = setup();
    const b = await s.create(input(s.room.id, s.guest.id, day(0), day(2)));
    await s.update(b.id, { status: "CHECKED_IN" });
    assert.equal(s.room.status, "AVAILABLE");
  });
});

describe("status flow", () => {
  it("transition table", () => {
    assert.ok(canTransition("PENDING", "CONFIRMED"));
    assert.ok(canTransition("PENDING", "CANCELLED"));
    assert.ok(canTransition("CONFIRMED", "CHECKED_IN"));
    assert.ok(canTransition("CONFIRMED", "CANCELLED"));
    assert.ok(canTransition("CHECKED_IN", "CHECKED_OUT"));
    assert.ok(!canTransition("PENDING", "CHECKED_IN"));
    assert.ok(!canTransition("CHECKED_IN", "CANCELLED"));
    assert.ok(!canTransition("CHECKED_OUT", "CHECKED_IN"));
    assert.ok(!canTransition("CANCELLED", "CONFIRMED"));
  });

  it("pending → confirmed → checked-in → checked-out", async () => {
    const s = setup();
    const b = await s.create(input(s.room.id, s.guest.id, day(0), day(2), { status: "PENDING" }));
    assert.equal(b.status, "PENDING");
    assert.equal((await s.update(b.id, { status: "CONFIRMED" })).status, "CONFIRMED");
    assert.equal((await s.update(b.id, { status: "CHECKED_IN" })).status, "CHECKED_IN");
    assert.equal((await s.update(b.id, { status: "CHECKED_OUT" })).status, "CHECKED_OUT");
  });

  it("cancel is valid from PENDING and CONFIRMED", async () => {
    const s = setup();
    const a = await s.create(input(s.room.id, s.guest.id, day(0), day(1), { status: "PENDING" }));
    const b = await s.create(input(s.room.id, s.guest.id, day(1), day(2)));
    assert.equal((await s.update(a.id, { status: "CANCELLED" })).status, "CANCELLED");
    assert.equal((await s.update(b.id, { status: "CANCELLED" })).status, "CANCELLED");
  });

  it("invalid transitions → 409 INVALID_TRANSITION; check-in before arrival day → 409", async () => {
    const s = setup();
    const p = await s.create(input(s.room.id, s.guest.id, day(0), day(1), { status: "PENDING" }));
    await rejects(s.update(p.id, { status: "CHECKED_IN" }), 409, "INVALID_TRANSITION");
    await rejects(s.update(p.id, { status: "CHECKED_OUT" }), 409, "INVALID_TRANSITION");
    const c = await s.create(input(s.room.id, s.guest.id, day(1), day(2)));
    await rejects(s.update(c.id, { status: "PENDING" }), 409, "INVALID_TRANSITION");
    const future = await s.create(input(s.room.id, s.guest.id, day(5), day(6)));
    await rejects(s.update(future.id, { status: "CHECKED_IN" }), 409, "CHECK_IN_TOO_EARLY");
    await s.update(c.id, { status: "CANCELLED" });
    const now = await s.create(input(s.room.id, s.guest.id, day(1), day(2)));
    await rejects(s.update(now.id, { status: "CHECKED_IN" }), 409, "CHECK_IN_TOO_EARLY");
    const inHouse = await s.create(input(s.addProperty("A").id, s.guest.id, day(-1), day(1)));
    await s.update(inHouse.id, { status: "CHECKED_IN" });
    await rejects(s.update(inHouse.id, { status: "CANCELLED" }), 409, "INVALID_TRANSITION");
  });

  it("closed bookings cannot be edited (any field) → 409 BOOKING_CLOSED", async () => {
    const s = setup();
    const b = await s.create(input(s.room.id, s.guest.id, day(0), day(1)));
    await s.update(b.id, { status: "CANCELLED" });
    await rejects(s.update(b.id, { notes: "x" }), 409, "BOOKING_CLOSED");
    await rejects(s.update(b.id, { status: "CONFIRMED" }), 409, "BOOKING_CLOSED");
    const c = await s.create(input(s.room.id, s.guest.id, day(0), day(1)));
    await s.update(c.id, { status: "CHECKED_IN" });
    await s.update(c.id, { status: "CHECKED_OUT" });
    await rejects(s.update(c.id, { nightlyRate: 1 }), 409, "BOOKING_CLOSED");
  });

  it("delete: only PENDING or CANCELLED; confirmed/stayed bookings stay as history", async () => {
    const s = setup();
    const confirmed = await s.create(input(s.room.id, s.guest.id, day(0), day(1)));
    await rejects(s.remove(confirmed.id), 409, "BOOKING_NOT_DELETABLE");
    await s.update(confirmed.id, { status: "CHECKED_IN" });
    await s.update(confirmed.id, { status: "CHECKED_OUT" });
    await rejects(s.remove(confirmed.id), 409, "BOOKING_NOT_DELETABLE");
    const pending = await s.create(input(s.room.id, s.guest.id, day(3), day(4), { status: "PENDING" }));
    assert.deepEqual(await s.remove(pending.id), { id: pending.id });
    const cancelled = await s.create(input(s.room.id, s.guest.id, day(3), day(4)));
    await s.update(cancelled.id, { status: "CANCELLED" });
    await s.remove(cancelled.id);
    assert.equal(s.t.booking.length, 1);
  });
});

describe("security", () => {
  it("cross-workspace property and guest are rejected; client workspaceId is never used", async () => {
    const s = setup();
    const roomB = s.addProperty("B");
    const guestB = s.addGuest("B");
    await rejects(s.create(input(s.room.id, guestB.id, day(0), day(1)), "B"), 404, "PROPERTY_NOT_FOUND");
    await rejects(s.create(input(roomB.id, s.guest.id, day(0), day(1)), "B"), 404, "CUSTOMER_NOT_FOUND");
    const own = await s.create(input(roomB.id, guestB.id, day(0), day(1)), "B");
    assert.equal(s.t.booking.find((b) => b.id === own.id)?.workspaceId, "B");
    await rejects(s.update(own.id, { tenantId: s.guest.id }, "B"), 404, "CUSTOMER_NOT_FOUND");
  });

  it("workspace B cannot read, update or delete A's booking", async () => {
    const s = setup();
    const a = await s.create(input(s.room.id, s.guest.id, day(0), day(2), { status: "PENDING" }));
    await rejects(s.transaction((db) => getBooking(db, "B", a.id)), 404, "NOT_FOUND");
    await rejects(s.update(a.id, { status: "CANCELLED" }, "B"), 404, "NOT_FOUND");
    await rejects(s.remove(a.id, "B"), 404, "NOT_FOUND");
    assert.deepEqual(await s.transaction((db) => listBookings(db, "B")), []);
    assert.equal(s.t.booking[0].status, "PENDING");
  });

  it("only HOTEL_HOSTEL and VILLA_RENTAL pass the industry guard (from the DB row)", () => {
    for (const industry of [...RENTAL_INDUSTRIES, null, "hotel_hostel"]) {
      const ok = industry === "HOTEL_HOSTEL" || industry === "VILLA_RENTAL";
      assert.equal(isBookingIndustry(industry), ok, String(industry));
      const run = () => assertBookingIndustry({ workspace: { industry } } as never);
      if (ok) assert.doesNotThrow(run);
      else assert.throws(run, (e: unknown) => e instanceof BookingError && e.status === 403 && e.code === "INDUSTRY_NOT_SUPPORTED");
    }
  });

  it("unauthenticated requests get 401 on every booking route", async () => {
    process.env.DATABASE_URL ??= "postgresql://unit-test/none";
    const list = await import("@/app/api/bookings/route");
    const item = await import("@/app/api/bookings/[id]/route");
    const req = (method: string) =>
      new NextRequest("http://localhost/api/bookings/x", {
        method,
        headers: { "content-type": "application/json" },
        body: method === "GET" || method === "DELETE" ? undefined : "{}",
      });
    const params = { params: Promise.resolve({ id: "x" }) };
    for (const res of [
      await list.GET(req("GET")),
      await list.POST(req("POST")),
      await item.GET(req("GET"), params),
      await item.PATCH(req("PATCH"), params),
      await item.PUT(req("PUT"), params),
      await item.DELETE(req("DELETE"), params),
    ]) {
      assert.equal(res.status, 401);
    }
  });

  it("routes use the booking guard, server workspace, transactions and a row lock", () => {
    const list = read("src/app/api/bookings/route.ts");
    const item = read("src/app/api/bookings/[id]/route.ts");
    assert.equal(list.match(/requireBookingWorkspace\(req/g)?.length, 2);
    assert.equal(item.match(/requireBookingWorkspace\(req/g)?.length, 3);
    for (const src of [list, item]) {
      assert.match(src, /guard\.ctx\.workspace\.id/);
      assert.doesNotMatch(src, /body\.workspaceId|body\.industry/);
    }
    assert.match(list, /prisma\.\$transaction\(\(tx\) => createBooking/);
    const service = read("src/lib/api-server/bookings.ts");
    assert.match(service, /FROM properties WHERE id = \$\{propertyId\} AND "workspaceId" = \$\{workspaceId\} FOR UPDATE/);
    assert.match(service, /requireResourceAccess\(req, "bookings", method\)/);
  });
});

describe("delete/history safety", () => {
  it("FKs: property and tenant NO ACTION (history survives), workspace CASCADE", () => {
    const sql = read("server/prisma/migrations/20261006030000_bookings/migration.sql");
    assert.match(sql, /REFERENCES "properties"\("id"\)\s+ON DELETE NO ACTION/);
    assert.match(sql, /REFERENCES "tenants"\("id"\)\s+ON DELETE NO ACTION/);
    assert.match(sql, /REFERENCES "workspaces"\("id"\)\s+ON DELETE CASCADE/);
    assert.match(sql, /CHECK \("checkOutDate" > "checkInDate"\)/);
    const schema = read("server/prisma/schema.prisma");
    const model = schema.slice(schema.indexOf("model Booking {"), schema.indexOf('@@map("bookings")'));
    assert.match(model, /property\s+Property\s+@relation\([^)]*onDelete: NoAction\)/);
    assert.match(model, /tenant\s+Tenant\?\s+@relation\([^)]*onDelete: NoAction\)/);
  });

  it("property/tenant delete guards return 409 when history exists", async () => {
    const db = { booking: { count: async ({ where }: { where: Cond }) => ("propertyId" in where || "tenantId" in where ? 1 : 0) } };
    const p = await propertyBookingHistoryResponse(db as never, "p1");
    assert.equal(p?.status, 409);
    assert.equal((await p!.json()).error.code, "PROPERTY_HAS_BOOKING_HISTORY");
    const t = await tenantBookingHistoryResponse(db as never, "t1");
    assert.equal((await t!.json()).error.code, "TENANT_HAS_BOOKING_HISTORY");
    const empty = { booking: { count: async () => 0 } };
    assert.equal(await propertyBookingHistoryResponse(empty as never, "p1"), null);
    assert.equal(await tenantBookingHistoryResponse(empty as never, "t1"), null);
  });

  it("existing property, tenant and client delete routes check booking history first", () => {
    const prop = read("src/app/api/properties/[id]/route.ts");
    assert.ok(prop.indexOf("propertyBookingHistoryResponse(prisma, id)") < prop.indexOf("prisma.property.delete("));
    const generic = read("src/app/api/[resource]/[id]/route.ts");
    assert.ok(generic.indexOf("tenantBookingHistoryResponse(prisma, id)") < generic.indexOf("deleteTenantAndLinkedClients(id)"));
    const clients = read("src/app/api/clients/[id]/route.ts");
    assert.ok(clients.indexOf("tenantBookingHistoryResponse(prisma, existing.tenantId)") < clients.indexOf("deleteTenantAndClientsForClient(id)"));
  });
});

describe("navigation and /bookings UI", () => {
  const items = (industry: string) => getIndustryNavigation(industry).flatMap((s) => s.items);
  const view = read("src/components/bookings/bookings-view.tsx");
  const dialog = read("src/components/bookings/booking-dialog.tsx");
  const page = read("src/app/(dashboard)/bookings/page.tsx");

  it("Bronlar is clickable for HOTEL and VILLA, absent elsewhere", () => {
    for (const industry of RENTAL_INDUSTRIES) {
      const item = items(industry).find((i) => i.label === "Bronlar");
      if (industry === "HOTEL_HOSTEL" || industry === "VILLA_RENTAL") {
        assert.equal(item?.href, "/bookings", industry);
        assert.equal(item?.comingSoon, undefined, industry);
      } else {
        assert.equal(item, undefined, industry);
      }
    }
  });

  it("page guards other industries before mounting the view (no API call)", () => {
    assert.match(page, /if \(!isBookingIndustry\(industry\)\)/);
    assert.match(page, /Bu bo‘lim mavjud emas/);
    assert.ok(page.indexOf("isBookingIndustry(industry)") < page.indexOf("<BookingsView"));
    assert.doesNotMatch(page, /useBookings|apiFetch/);
  });

  it("HOTEL wording: Xona / Mehmon, VILLA wording: Dacha / Villa / Mijoz", () => {
    assert.deepEqual(bookingTerms("HOTEL_HOSTEL"), {
      unit: "Xona",
      guest: "Mehmon",
      subtitle: "Mehmonxona bronlari va joylashuvlarini boshqaring",
    });
    const villa = bookingTerms("VILLA_RENTAL");
    assert.equal(villa.unit, "Dacha / Villa");
    assert.equal(villa.guest, "Mijoz");
    assert.match(view, /title="Bronlar"/);
    assert.match(view, /description=\{terms\.subtitle\}/);
    assert.match(view, /<TableHead>\{terms\.unit\}<\/TableHead>/);
    assert.match(view, /<TableHead>\{terms\.guest\}<\/TableHead>/);
    for (const column of ["Kirish", "Chiqish", "Tunlar", "Jami", "Status"]) {
      assert.match(view, new RegExp(`<TableHead[^>]*>${column}</TableHead>`), column);
    }
    assert.match(view, /Tunlik narx<\/TableHead>/);
    assert.match(view, /sr-only">Amallar/);
  });

  it("actions: create, edit, confirm, check-in, check-out, cancel follow the transition table", async () => {
    for (const label of ["Bron yaratish", "Tahrirlash", "Tasdiqlash", "Check-in", "Check-out", "Bekor qilish"]) {
      assert.ok(view.includes(label), label);
    }
    assert.match(view, /availableBookingActions\(booking\.status\)/);
    assert.deepEqual(availableBookingActions("PENDING"), ["confirm", "cancel", "delete"]);
    assert.deepEqual(availableBookingActions("CONFIRMED"), ["checkIn", "cancel"]);
    assert.deepEqual(availableBookingActions("CHECKED_IN"), ["checkOut"]);
    assert.deepEqual(availableBookingActions("CHECKED_OUT"), []);
    assert.deepEqual(availableBookingActions("CANCELLED"), ["delete"]);
  });

  it("dialog fields, live nights/total, manual nightly rate (monthly rentPrice is never used)", () => {
    for (const label of ["terms.unit", "terms.guest", "Kirish sanasi", "Chiqish sanasi", "Mehmonlar soni", "Tunlik narx", "Jami", "Izoh"]) {
      assert.ok(dialog.includes(label), label);
    }
    assert.match(dialog, /bookingNights\(form\.checkInDate, form\.checkOutDate\)/);
    assert.match(dialog, /bookingTotal\(nights, form\.nightlyRate\)/);
    assert.doesNotMatch(dialog, /\b(p|property|selected)\.price\b/);
    assert.match(dialog, /setError\(err instanceof Error \? err\.message/);
  });
});

describe("dashboard booking data", () => {
  const b = (id: string, status: Booking["status"], inOff: number, outOff: number, propertyId = id, guestCount = 2) =>
    ({ id, status, checkInDate: day(inOff), checkOutDate: day(outOff), propertyId, guestCount }) as Booking;
  const list = [
    b("inhouse", "CHECKED_IN", -1, 2, "r1", 3),
    b("arrive", "CONFIRMED", 0, 2, "r2"),
    b("leave", "CHECKED_IN", -2, 0, "r3", 1),
    b("left", "CHECKED_OUT", -3, 0, "r4"),
    b("pending", "PENDING", 3, 5, "r5"),
    b("cancel", "CANCELLED", 0, 1, "r6"),
    b("later", "CONFIRMED", 10, 12, "r7"),
  ];

  it("HOTEL: today's check-in, check-out and current guests are real", () => {
    assert.deepEqual(selectTodayCheckIns(list, TODAY).map((x) => x.id), ["arrive"]);
    assert.deepEqual(selectTodayCheckOuts(list, TODAY).map((x) => x.id), ["leave", "left"]);
    assert.equal(countCurrentGuests(list), 4);
    const hotel = getIndustryDashboardConfig("HOTEL_HOSTEL")!;
    assert.equal(hotel.useBookingInventory, true);
    const keys = hotel.stats.map((s) => s.key);
    for (const k of ["todayGuests", "todayCheckIns", "todayCheckOuts", "occupiedUnits", "todayIncome"]) assert.ok(keys.includes(k as never), k);
    const kpi = (key: Parameters<typeof resolveIndustryKpiValue>[0]) =>
      resolveIndustryKpiValue(key, {
        inventory: { total: 3, occupied: 2, vacant: 1 },
        monthlyIncome: 0,
        debtCount: 0,
        todayIncome: 0,
        todayGuests: 4,
        todayCheckIns: 1,
        todayCheckOuts: 2,
      });
    assert.equal(kpi("todayGuests"), 4);
    assert.equal(kpi("todayCheckIns"), 1);
    assert.equal(kpi("todayCheckOuts"), 2);
    assert.equal(kpi("todayIncome"), 0, "booking totals are never income");
    assert.equal(industryBlockMode("todayCheckIn", true, false, true), "todayCheckIns");
    assert.equal(industryBlockMode("todayCheckOut", true, false, true), "todayCheckOuts");
    assert.equal(industryBlockMode("roomStatus", true, false, true), "bookingUnits");
    assert.equal(industryBlockMode("upcomingBookings", true, false, true), "upcomingArrivals");
  });

  it("occupancy comes from bookings, not property.status", () => {
    const properties = ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"].map((id) => ({
      id,
      status: id === "r4" ? "rented" : id === "r8" ? "maintenance" : "available",
    }));
    const inv = countBookingInventory(properties, list, TODAY);
    assert.deepEqual(inv, { total: 8, occupied: 3, vacant: 4, maintenance: 1 });
    const hotel = getIndustryDashboardConfig("HOTEL_HOSTEL");
    assert.deepEqual(resolveIndustryInventory(hotel, properties, [], { bookings: list, today: TODAY }), inv);
    const office = getIndustryDashboardConfig("OFFICE_RENTAL");
    assert.equal(resolveIndustryInventory(office, properties, [], { bookings: list, today: TODAY }).occupied, 1);
  });

  it("VILLA: active and upcoming bookings are real", () => {
    assert.deepEqual(selectCurrentStays(list, TODAY).map((x) => x.id), ["leave", "inhouse", "arrive"]);
    assert.deepEqual(selectUpcomingArrivals(list, TODAY).map((x) => x.id), ["arrive", "pending"]);
    assert.deepEqual(selectUpcomingDepartures(list, TODAY).map((x) => x.id), ["leave", "inhouse", "arrive"]);
    const villa = getIndustryDashboardConfig("VILLA_RENTAL")!;
    assert.equal(villa.customerLabel, "Mijoz");
    assert.equal(villa.entityLabel, "Dacha / Villa");
    assert.ok(villa.stats.some((s) => s.key === "monthlyIncome"));
    const blocks = villa.blocks.map((x) => industryBlockMode(x.key, villa.usePropertyInventory, false, true));
    assert.deepEqual(blocks, ["bookingUnits", "activeBookings", "upcomingArrivals", "upcomingDepartures", "payments"]);
    assert.equal(
      resolveIndustryKpiValue("activeBookings", { inventory: { total: 0, occupied: 0, vacant: 0 }, monthlyIncome: 0, debtCount: 0, todayIncome: 0, activeBookings: 3 }),
      3
    );
  });

  it("other industries never get booking modes; dashboard fetches bookings only when enabled", () => {
    assert.equal(industryBlockMode("todayCheckIn", true, false, false), "empty");
    assert.equal(industryBlockMode("roomStatus", true, false, false), "units");
    for (const industry of RENTAL_INDUSTRIES) {
      const cfg = getIndustryDashboardConfig(industry);
      assert.equal(cfg?.useBookingInventory === true, industry === "HOTEL_HOSTEL" || industry === "VILLA_RENTAL", industry);
    }
    const src = read("src/app/(dashboard)/dashboard/page.tsx");
    assert.match(src, /useBookings\(\s*industryConfig\?\.useBookingInventory === true\s*\)/);
    assert.match(src, /todayIncome=\{todayIncome\}/);
    assert.match(src, /monthlyIncome=\{industryMonthlyIncome\}/);
    assert.match(src, /usesSourcePayments\s*\?\s*metrics\.monthlyIncomeActual \+ sourceIncome\.month\s*:\s*metrics\.monthlyIncome;/);
  });
});

describe("smart booking: reservation without a guest record", () => {
  it("guestName is required without a tenant; phone is optional and stored", () => {
    const base = { propertyId: "p", checkInDate: day(0), checkOutDate: day(2), nightlyRate: 100, guestCount: 3 };
    assert.match(parseBookingInput(base).error ?? "", /Mehmon F\.I\.O/);
    assert.match(parseBookingInput({ ...base, guestName: " a " }).error ?? "", /Mehmon F\.I\.O/);
    const ok = parseBookingInput({ ...base, guestName: "  Ali   Valiyev ", guestPhone: "+998 90 123 45 67" }).data!;
    assert.equal(ok.guestName, "Ali Valiyev");
    assert.equal(ok.guestPhone, "+998 90 123 45 67");
    assert.equal(ok.tenantId, null);
    assert.equal(ok.guestCount, 3);
    assert.equal(parseBookingInput({ ...base, guestName: "Ali" }).data?.guestPhone, null);
    assert.match(parseBookingInput({ ...base, guestName: "Ali", guestPhone: "12" }).error ?? "", /Telefon/);
  });

  it("creates the booking with tenantId null and no tenant row; view shows guestName", async () => {
    const s = setup();
    const tenantsBefore = s.t.tenant.length;
    const b = await s.create(input(s.room.id, null, day(0), day(2), { guestName: "Ali Valiyev", guestPhone: "+998901234567", guestCount: 3 }));
    assert.equal(b.tenantId, null);
    assert.equal(b.guestName, "Ali Valiyev");
    assert.equal(b.guestPhone, "+998901234567");
    assert.equal(b.arrivalStatus, "EXPECTED");
    assert.equal(b.guestCount, 3);
    assert.equal(s.t.tenant.length, tenantsBefore, "no guest record before arrival");
    assert.deepEqual((await s.transaction((db) => listBookings(db, "A"))).map((x) => x.guestName), ["Ali Valiyev"]);
  });

  it("an expected reservation blocks the room (half-open); NO_SHOW + CANCELLED frees it", async () => {
    const s = setup();
    const b = await s.create(input(s.room.id, null, day(0), day(2), { guestName: "Ali" }));
    await rejects(s.create(input(s.room.id, null, day(1), day(3), { guestName: "Vali" })), 409, "PROPERTY_NOT_AVAILABLE");
    await s.create(input(s.room.id, null, day(2), day(3), { guestName: "Adjacent" }));
    Object.assign(s.t.booking.find((r) => r.id === b.id)!, { status: "CANCELLED", arrivalStatus: "NO_SHOW" });
    const next = await s.create(input(s.room.id, null, day(0), day(2), { guestName: "Vali" }));
    assert.equal(next.status, "CONFIRMED");
  });

  it("direct check-in without a linked guest → 409 ARRIVAL_REQUIRED; with a guest it marks ARRIVED", async () => {
    const s = setup();
    const b = await s.create(input(s.room.id, null, day(0), day(2), { guestName: "Ali" }));
    await rejects(s.update(b.id, { status: "CHECKED_IN" }), 409, "ARRIVAL_REQUIRED");
    const linked = await s.update(b.id, { tenantId: s.guest.id, status: "CHECKED_IN" });
    assert.equal(linked.status, "CHECKED_IN");
    assert.equal(linked.arrivalStatus, "ARRIVED");
    assert.equal(linked.tenantId, s.guest.id);
    assert.equal(linked.guestName, s.guest.fullName, "linking a guest record adopts its name");
    assert.equal((await s.update(b.id, { status: "CHECKED_OUT" })).status, "CHECKED_OUT");
  });

  it("arrival selectors: today expected, future excluded, overdue stays actionable", () => {
    const row = (id: string, inOff: number, status: Booking["status"], arrivalStatus: Booking["arrivalStatus"]) =>
      ({ id, status, arrivalStatus, checkInDate: day(inOff), checkOutDate: day(inOff + 2) }) as Booking;
    const rows = [
      row("today", 0, "CONFIRMED", "EXPECTED"),
      row("todayPending", 0, "PENDING", "EXPECTED"),
      row("future", 1, "CONFIRMED", "EXPECTED"),
      row("late2", -2, "CONFIRMED", "EXPECTED"),
      row("late1", -1, "PENDING", "EXPECTED"),
      row("arrived", 0, "CHECKED_IN", "ARRIVED"),
      row("noShow", 0, "CANCELLED", "NO_SHOW"),
      row("cancelled", 0, "CANCELLED", "EXPECTED"),
    ];
    assert.deepEqual(selectExpectedArrivals(rows, TODAY).map((x) => x.id), ["today", "todayPending"]);
    assert.deepEqual(selectOverdueArrivals(rows, TODAY).map((x) => x.id), ["late2", "late1"]);
    assert.deepEqual(selectTodayArrivals(rows, TODAY).map((x) => x.id), ["today", "todayPending", "arrived", "noShow"]);
    assert.deepEqual(
      selectTodayArrivals(rows, TODAY).map((x) => ARRIVAL_STATUS_LABELS[arrivalBadge(x)!]),
      ["Kutilmoqda", "Kutilmoqda", "Keldi", "Kelmadi"]
    );
    assert.equal(arrivalBadge(row("x", 0, "CANCELLED", "EXPECTED")), null);
    assert.equal(countCurrentGuests([{ ...rows[5], guestCount: 3 }, { ...rows[0], guestCount: 4 }] as Booking[]), 3);
  });

  it("migration is additive, idempotent and backfills from tenants without deleting data", () => {
    const sql = read("server/prisma/migrations/20261006110000_smart_booking_arrivals/migration.sql");
    assert.match(sql, /CREATE TYPE "BookingArrivalStatus" AS ENUM \('EXPECTED', 'ARRIVED', 'NO_SHOW'\)/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "guestName" TEXT NOT NULL DEFAULT ''/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "guestPhone" TEXT/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "arrivalStatus" "BookingArrivalStatus" NOT NULL DEFAULT 'EXPECTED'/);
    assert.match(sql, /ALTER COLUMN "tenantId" DROP NOT NULL/);
    assert.match(sql, /FROM "tenants"/);
    assert.doesNotMatch(sql, /\b(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)\b/i);
    const runtime = read("src/lib/api-server/workspace-schema-sql.ts");
    assert.match(runtime, /"arrivalStatus" "BookingArrivalStatus"/);
  });

  it("HOTEL booking dialog asks for name + phone (no guest dropdown); VILLA keeps the select", () => {
    const dialog = read("src/components/bookings/booking-dialog.tsx");
    const view = read("src/components/bookings/bookings-view.tsx");
    assert.match(dialog, /smartGuest \?/);
    assert.match(dialog, /id="booking-guest-name"/);
    assert.match(dialog, /id="booking-guest-phone"/);
    assert.match(dialog, /\{terms\.guest\} F\.I\.O \*/);
    assert.doesNotMatch(dialog, /Mehmonni tanlang/);
    assert.match(view, /smartGuest=\{smart\}/);
    assert.match(view, /isHotelGuestIndustry\(industry\)/);
    assert.match(view, /Kelish holati/);
    for (const label of ["Kirish sanasi", "Chiqish sanasi", "Mehmonlar soni", "Tunlik narx", "Jami", "Holat", "Izoh", "Bron yaratish"]) {
      assert.ok(dialog.includes(label) || view.includes(label), label);
    }
  });
});
