import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Contract, Payment, Tenant } from "@/types";
import { LWN_BUILDING } from "@/lib/constants";
import { selectCanonicalDebts } from "@/lib/debts/canonical-debts";
import { countPropertyInventory, sumPaymentsOnTashkentDay } from "@/lib/dashboard-industry";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import { RENTAL_INDUSTRIES } from "@/lib/rental-industry";
import { bookingNights, fromStoredDate, tashkentToday } from "@/lib/bookings";

import { buildDemoSeedPlan, type DemoSeedPlan } from "./demo-seed-plan";
import { seedDemoWorkspace } from "./demo-seed";
import { incomeWindows } from "./source-payments";
import { getPaymentSummary } from "@/lib/source-payments";
import { getPlanLimits } from "./plans";

const NOW = new Date("2026-10-15T09:00:00+05:00");
const LIMITS = getPlanLimits("FREE");
const plan = (industry: unknown, now = NOW) => buildDemoSeedPlan(industry, now, LIMITS);
const titles = (p: DemoSeedPlan) => p.properties.map((x) => x.title);
const names = (p: DemoSeedPlan) => p.tenants.map((x) => x.fullName);

function toFrontend(p: DemoSeedPlan) {
  const contracts: Contract[] = p.contracts.map((c) => ({
    id: c.key,
    propertyId: c.propertyKey,
    tenantId: c.tenantKey,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    monthlyPayment: c.monthlyRent,
    status: "active",
    createdAt: NOW.toISOString(),
  }));
  const payments: Payment[] = p.payments.map((x, i) => ({
    id: `pay${i}`,
    contractId: x.contractKey,
    amount: x.amount,
    date: x.paymentDate.toISOString(),
    periodYear: x.periodYear,
    periodMonth: x.periodMonth,
    method: "bank",
    createdAt: NOW.toISOString(),
  }));
  const tenants: Tenant[] = p.tenants.map((t) => ({
    id: t.key,
    fullName: t.fullName,
    phone: t.phone,
    passport: t.passport,
    rentAmount: t.rentAmount,
    entryDate: t.entryDate?.toISOString(),
    paymentDueDate: t.paymentDueDate?.toISOString(),
    createdAt: NOW.toISOString(),
  }));
  const properties = p.properties.map((x) => ({ status: x.status.toLowerCase() }));
  return { contracts, payments, tenants, properties };
}

test("every industry respects DEMO plan limits and links records consistently", () => {
  for (const industry of RENTAL_INDUSTRIES) {
    const p = plan(industry);
    assert.ok(p.properties.length <= (LIMITS.properties ?? Infinity), industry);
    assert.ok(p.tenants.length <= (LIMITS.tenants ?? Infinity), industry);
    const propertyKeys = new Set(p.properties.map((x) => x.key));
    const tenantKeys = new Set(p.tenants.map((x) => x.key));
    for (const c of p.contracts) {
      assert.ok(propertyKeys.has(c.propertyKey) && tenantKeys.has(c.tenantKey), industry);
      const prop = p.properties.find((x) => x.key === c.propertyKey)!;
      assert.equal(prop.status, "RENTED", industry);
    }
    assert.equal(p.properties.filter((x) => x.status === "RENTED").length, p.contracts.length, industry);
    for (const x of p.properties) {
      assert.equal(x.building, LWN_BUILDING);
      assert.doesNotMatch(x.title, /demo/i);
    }
    for (const t of p.tenants) assert.doesNotMatch(t.fullName, /demo/i);
  }
});

test("office: Business Center rooms, mixed status, income, one debt, expenses", () => {
  const p = plan("OFFICE_RENTAL");
  assert.deepEqual(titles(p), ["101", "102", "103"]);
  assert.equal(p.properties[0].address, "Demo Business Center");
  assert.deepEqual(names(p), ["Nova Design", "Atlas Logistics", "Legal Partners"]);
  const f = toFrontend(p);
  assert.deepEqual(countPropertyInventory(f.properties, true), { total: 3, occupied: 2, vacant: 1 });
  const today = getTashkentDateParts(NOW);
  for (const pay of p.payments) {
    const parts = getTashkentDateParts(pay.paymentDate);
    assert.equal(parts.month, today.month);
    assert.equal(pay.periodMonth, today.month);
  }
  assert.ok(p.payments.reduce((s, x) => s + x.amount, 0) > 0);
  const debts = selectCanonicalDebts(f.contracts, f.payments, f.tenants, NOW);
  assert.equal(debts.length, 1);
  assert.deepEqual(p.expenses.map((e) => e.title), ["Internet", "Kommunal", "Tozalash"]);
});

test("apartment: occupied and vacant non-zero, contracts and payments", () => {
  const p = plan("APARTMENT_RENTAL");
  assert.deepEqual(titles(p), ["Chilonzor 2 xonali", "Yunusobod 3 xonali", "Mirzo Ulug‘bek 2 xonali"]);
  const inv = countPropertyInventory(toFrontend(p).properties, true);
  assert.ok(inv.occupied > 0 && inv.vacant > 0);
  assert.ok(p.contracts.length > 0 && p.payments.length > 0);
});

test("hotel: rooms and guests kept, stays are real bookings (no fake short contracts/payments)", () => {
  const p = plan("HOTEL_HOSTEL");
  assert.deepEqual(titles(p), ["101 Standard", "102 Standard", "201 Deluxe"]);
  assert.ok(p.tenants.length >= 2);
  assert.equal(p.contracts.length, 0);
  assert.equal(p.payments.length, 0);
  assert.equal(sumPaymentsOnTashkentDay(toFrontend(p).payments, NOW), 0, "booking total is never income");
  assert.ok(p.properties.every((x) => x.status === "AVAILABLE"), "property.status is not written from bookings");
  const f = toFrontend(p);
  assert.equal(selectCanonicalDebts(f.contracts, f.payments, f.tenants, NOW).length, 0);

  const statuses = p.bookings.map((b) => b.status);
  assert.ok(statuses.includes("CONFIRMED"));
  assert.ok(statuses.includes("CHECKED_IN"));
  const today = tashkentToday(NOW);
  const checkedIn = p.bookings.find((b) => b.status === "CHECKED_IN")!;
  assert.ok(fromStoredDate(checkedIn.checkInDate) <= today && today < fromStoredDate(checkedIn.checkOutDate));
  for (const b of p.bookings) {
    assert.equal(b.nights, bookingNights(fromStoredDate(b.checkInDate), fromStoredDate(b.checkOutDate)));
    assert.equal(b.totalAmount, b.nights * b.nightlyRate);
    assert.ok(b.nights >= 1 && b.nightlyRate > 0);
  }
});

test("villa: one current booking from real Booking rows, no short contracts", () => {
  const p = plan("VILLA_RENTAL");
  assert.equal(p.contracts.length, 0);
  assert.equal(p.payments.length, 0);
  assert.ok(p.bookings.length >= 1);
  const today = tashkentToday(NOW);
  assert.ok(
    p.bookings.some(
      (b) =>
        (b.status === "CHECKED_IN" || b.status === "CONFIRMED") &&
        fromStoredDate(b.checkInDate) <= today &&
        today < fromStoredDate(b.checkOutDate)
    )
  );
});

test("bookings are seeded only for HOTEL_HOSTEL and VILLA_RENTAL, never overlapping", () => {
  for (const industry of RENTAL_INDUSTRIES) {
    const p = plan(industry);
    assert.equal(p.bookings.length > 0, industry === "HOTEL_HOSTEL" || industry === "VILLA_RENTAL", industry);
    const keys = new Set(p.properties.map((x) => x.key));
    const tenants = new Set(p.tenants.map((x) => x.key));
    for (const b of p.bookings) assert.ok(keys.has(b.propertyKey) && tenants.has(b.tenantKey), industry);
    for (const a of p.bookings) {
      for (const b of p.bookings) {
        if (a === b || a.propertyKey !== b.propertyKey) continue;
        assert.ok(!(a.checkInDate < b.checkOutDate && b.checkInDate < a.checkOutDate), `${industry} overlap`);
      }
    }
  }
});

test("hotel on the 1st of month: short stay creates no false debt", () => {
  const firstDay = new Date("2026-11-01T08:00:00+05:00");
  const f = toFrontend(plan("HOTEL_HOSTEL", firstDay));
  assert.equal(selectCanonicalDebts(f.contracts, f.payments, f.tenants, firstDay).length, 0);
});

test("car rental: 3 real vehicles, customers kept, no fake properties or vehicle contracts", () => {
  const p = plan("CAR_RENTAL");
  assert.equal(p.properties.length, 0);
  assert.equal(p.contracts.length, 0);
  assert.equal(p.payments.length, 0);
  assert.deepEqual(names(p), ["Otabek Ergashev", "Nodira Saidova"]);
  assert.deepEqual(
    p.vehicles.map((v) => [v.name, v.status]),
    [
      ["Chevrolet Cobalt", "AVAILABLE"],
      ["Chevrolet Tracker", "RENTED"],
      ["Kia K5", "MAINTENANCE"],
    ]
  );
  assert.ok(p.vehicles.length <= (LIMITS.vehicles ?? Infinity));
  assert.equal(new Set(p.vehicles.map((v) => v.plateNumber)).size, 3);
  for (const v of p.vehicles) assert.doesNotMatch(v.plateNumber, /demo/i);
  const other = buildDemoSeedPlan("CAR_RENTAL", NOW, LIMITS, 424242).vehicles.map((v) => v.plateNumber);
  assert.notDeepEqual(other, p.vehicles.map((v) => v.plateNumber));
});

test("vehicles are seeded only for CAR_RENTAL", () => {
  for (const industry of RENTAL_INDUSTRIES) {
    assert.equal(plan(industry).vehicles.length > 0, industry === "CAR_RENTAL", industry);
  }
});

test("retail, warehouse, villa, commercial and other seed expected units", () => {
  assert.deepEqual(titles(plan("RETAIL_RENTAL")), ["A-01", "A-02", "B-01"]);
  assert.deepEqual(names(plan("RETAIL_RENTAL")), ["Coffee Point", "Mobile Store", "Kids Fashion"]);
  assert.deepEqual(titles(plan("WAREHOUSE_RENTAL")), ["Ombor A", "Ombor B", "Ombor C"]);
  assert.deepEqual(names(plan("WAREHOUSE_RENTAL")), ["Orient Logistics", "Market Distribution", "Express Cargo"]);
  assert.ok(plan("WAREHOUSE_RENTAL").expenses.length > 0);
  assert.deepEqual(titles(plan("VILLA_RENTAL")), ["Chorvoq Villa 1", "Chorvoq Villa 2", "Family Dacha"]);
  assert.deepEqual(titles(plan("COMMERCIAL_RENTAL")), ["Business Center A", "Store 1", "Warehouse Block"]);
  const other = plan("OTHER");
  assert.equal(other.properties.length, 3);
  assert.equal(other.tenants.length, 2);
  assert.equal(other.contracts.length, 2);
  assert.equal(other.payments.length, 2);
});

test("invalid industry falls back to OTHER", () => {
  assert.equal(plan("HACKED").industry, "OTHER");
  assert.equal(plan(undefined).industry, "OTHER");
});

type Row = Record<string, unknown> & { workspaceId?: string };
type Ws = {
  id: string;
  industry: string;
  isInternal: boolean;
  subscription: { status: string; plan: string } | null;
  demoSeededAt?: Date | null;
  demoDataClearedAt?: Date | null;
};

function fakeClient(workspaces: Ws[]) {
  const tables: Record<string, Row[]> = {
    property: [], tenant: [], contract: [], payment: [], expense: [], vehicle: [], vehicleRental: [], booking: [],
    sourcePayment: [],
  };
  const model = (name: string) => ({
    count: async ({ where }: { where: { workspaceId: string } }) =>
      tables[name].filter((r) => r.workspaceId === where.workspaceId).length,
    createMany: async ({ data }: { data: Row[] }) => {
      tables[name].push(...data);
      return { count: data.length };
    },
  });
  const db = {
    $queryRaw: async () => [],
    workspace: {
      findUnique: async ({ where }: { where: { id: string } }) => workspaces.find((w) => w.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Ws> }) =>
        Object.assign(workspaces.find((w) => w.id === where.id)!, data),
    },
    property: model("property"),
    tenant: model("tenant"),
    contract: model("contract"),
    payment: model("payment"),
    expense: model("expense"),
    vehicle: model("vehicle"),
    vehicleRental: model("vehicleRental"),
    booking: model("booking"),
    sourcePayment: model("sourcePayment"),
  };
  const client = { $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) };
  return { client: client as unknown as Parameters<typeof seedDemoWorkspace>[1], tables };
}

const demoWs = (id: string, industry = "OFFICE_RENTAL"): Ws => ({
  id,
  industry,
  isInternal: false,
  subscription: { status: "DEMO", plan: "demo" },
});

test("seed records demoSeededAt and never runs once demo data was cleared", async () => {
  const seededWs = demoWs("s1");
  const { client } = fakeClient([seededWs]);
  assert.equal((await seedDemoWorkspace({ workspaceId: "s1", now: NOW }, client)).seeded, true);
  assert.equal(seededWs.demoSeededAt?.getTime(), NOW.getTime());

  const cleared = { ...demoWs("c1"), demoDataClearedAt: NOW };
  const { client: c2, tables } = fakeClient([cleared]);
  assert.deepEqual(await seedDemoWorkspace({ workspaceId: "c1", now: NOW }, c2), { seeded: false, reason: "CLEARED" });
  assert.ok(Object.values(tables).every((rows) => rows.length === 0));
});

test("seed is idempotent: second run does not add records", async () => {
  const { client, tables } = fakeClient([demoWs("w1")]);
  const first = await seedDemoWorkspace({ workspaceId: "w1", now: NOW }, client);
  assert.equal(first.seeded, true);
  const snapshot = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  const second = await seedDemoWorkspace({ workspaceId: "w1", now: NOW }, client);
  assert.deepEqual(second, { seeded: false, reason: "NOT_EMPTY" });
  assert.deepEqual(Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])), snapshot);
  for (const rows of Object.values(tables)) for (const r of rows) assert.equal(r.workspaceId, "w1");
});

test("CAR_RENTAL seed writes 3 vehicles, 0 properties, and a rerun adds nothing", async () => {
  const { client, tables } = fakeClient([demoWs("car", "CAR_RENTAL")]);
  const first = await seedDemoWorkspace({ workspaceId: "car", now: NOW }, client);
  assert.equal(first.seeded && first.counts.vehicles, 3);
  assert.equal(tables.vehicle.length, 3);
  assert.equal(tables.property.length, 0);
  assert.equal(tables.contract.length, 0);
  assert.equal(tables.payment.length, 0);
  assert.equal(tables.vehicleRental.length, 2);
  const vehicleIds = new Set(tables.vehicle.map((v) => v.id));
  const tenantIds = new Set(tables.tenant.map((t) => t.id));
  for (const r of tables.vehicleRental) {
    assert.ok(vehicleIds.has(r.vehicleId as string), "rental points at a seeded vehicle");
    assert.ok(tenantIds.has(r.tenantId as string), "rental points at a seeded customer");
    assert.equal(r.workspaceId, "car");
  }
  const second = await seedDemoWorkspace({ workspaceId: "car", now: NOW }, client);
  assert.deepEqual(second, { seeded: false, reason: "NOT_EMPTY" });
  assert.equal(tables.vehicle.length, 3);
  assert.equal(tables.vehicleRental.length, 2);
});

test("car rental plan: active Tracker rental + planned Cobalt rental, consistent statuses", () => {
  const p = plan("CAR_RENTAL");
  const byKey = new Map(p.vehicles.map((v) => [v.key, v]));
  const summary = p.rentals.map((r) => [byKey.get(r.vehicleKey)?.name, r.status]);
  assert.deepEqual(summary, [
    ["Chevrolet Tracker", "ACTIVE"],
    ["Chevrolet Cobalt", "PLANNED"],
  ]);
  const tracker = p.rentals[0];
  assert.equal(tracker.days, 6);
  assert.equal(tracker.totalAmount, 6 * 550_000);
  assert.equal(byKey.get(tracker.vehicleKey)?.status, "RENTED");
  assert.equal(byKey.get(p.rentals[1].vehicleKey)?.status, "AVAILABLE");
  for (const industry of RENTAL_INDUSTRIES) {
    if (industry !== "CAR_RENTAL") assert.equal(plan(industry).rentals.length, 0, industry);
  }
});

test("a workspace that already has only vehicles is not seeded", async () => {
  const { client, tables } = fakeClient([demoWs("v", "CAR_RENTAL")]);
  tables.vehicle.push({ workspaceId: "v", plateNumber: "01 A 777 AA" });
  assert.deepEqual(await seedDemoWorkspace({ workspaceId: "v", now: NOW }, client), {
    seeded: false,
    reason: "NOT_EMPTY",
  });
});

test("PRO, ACTIVE, internal and unknown workspaces are never seeded", async () => {
  const { client, tables } = fakeClient([
    { ...demoWs("pro"), subscription: { status: "ACTIVE", plan: "PRO" } },
    { ...demoWs("free"), subscription: { status: "ACTIVE", plan: "FREE" } },
    { ...demoWs("proDemo"), subscription: { status: "DEMO", plan: "PRO" } },
    { ...demoWs("internal"), isInternal: true },
    { ...demoWs("nosub"), subscription: null },
  ]);
  for (const id of ["pro", "free", "proDemo", "internal", "nosub"]) {
    const r = await seedDemoWorkspace({ workspaceId: id, now: NOW }, client);
    assert.deepEqual(r, { seeded: false, reason: "NOT_DEMO" }, id);
  }
  assert.deepEqual(await seedDemoWorkspace({ workspaceId: "missing", now: NOW }, client), {
    seeded: false,
    reason: "NOT_FOUND",
  });
  assert.ok(Object.values(tables).every((rows) => rows.length === 0));
});

test("seeding one workspace never writes into another", async () => {
  const { client, tables } = fakeClient([demoWs("a", "RETAIL_RENTAL"), demoWs("b", "HOTEL_HOSTEL")]);
  await seedDemoWorkspace({ workspaceId: "a", now: NOW }, client);
  assert.ok(Object.values(tables).every((rows) => rows.every((r) => r.workspaceId === "a")));
  const r = await seedDemoWorkspace({ workspaceId: "b", now: NOW }, client);
  assert.equal(r.seeded, true);
  assert.equal(r.seeded && r.industry, "HOTEL_HOSTEL");
});

for (const industry of ["HOTEL_HOSTEL", "VILLA_RENTAL"] as const) {
  test(`${industry} seed writes bookings linked to seeded rooms/guests; second run adds no duplicates`, async () => {
    const { client, tables } = fakeClient([demoWs("h", industry)]);
    const first = await seedDemoWorkspace({ workspaceId: "h", now: NOW }, client);
    assert.equal(first.seeded, true);
    assert.ok(tables.booking.length >= 1);
    assert.equal(first.seeded && first.counts.bookings, tables.booking.length);
    assert.equal(tables.contract.length, 0);
    assert.equal(tables.payment.length, 0);
    const propertyIds = new Set(tables.property.map((x) => x.id));
    const tenantIds = new Set(tables.tenant.map((x) => x.id));
    for (const b of tables.booking) {
      assert.ok(propertyIds.has(b.propertyId as string));
      assert.ok(tenantIds.has(b.tenantId as string));
      assert.equal(b.workspaceId, "h");
    }
    const count = tables.booking.length;
    assert.deepEqual(await seedDemoWorkspace({ workspaceId: "h", now: NOW }, client), {
      seeded: false,
      reason: "NOT_EMPTY",
    });
    assert.equal(tables.booking.length, count);
  });
}

test("a workspace that already has only bookings is not seeded", async () => {
  const { client, tables } = fakeClient([demoWs("b", "HOTEL_HOSTEL")]);
  tables.booking.push({ workspaceId: "b" });
  assert.deepEqual(await seedDemoWorkspace({ workspaceId: "b", now: NOW }, client), {
    seeded: false,
    reason: "NOT_EMPTY",
  });
});

const inWindow = (d: Date, from: Date, to: Date) => d >= from && d < to;

test("source payments: CAR month > 0, HOTEL today+month > 0, VILLA month > 0; never above totals", () => {
  const w = incomeWindows(NOW);
  const income = (industry: string) => {
    const pays = plan(industry).sourcePayments;
    return {
      today: pays.filter((x) => inWindow(x.paymentDate, w.dayStart, w.dayEnd)).reduce((s, x) => s + x.amount, 0),
      month: pays.filter((x) => inWindow(x.paymentDate, w.monthStart, w.monthEnd)).reduce((s, x) => s + x.amount, 0),
    };
  };
  assert.equal(income("CAR_RENTAL").month, 2_000_000);
  assert.ok(income("HOTEL_HOSTEL").today > 0 && income("HOTEL_HOSTEL").month > 0);
  assert.ok(income("VILLA_RENTAL").month > 0);

  const car = plan("CAR_RENTAL");
  const tracker = car.rentals[0];
  const trackerPaid = car.sourcePayments.filter((x) => x.sourceKey === tracker.key);
  assert.deepEqual(getPaymentSummary(tracker.totalAmount, trackerPaid[0].amount), {
    total: 3_300_000,
    paid: 2_000_000,
    remaining: 1_300_000,
    status: "PARTIAL",
  });
  const hotel = plan("HOTEL_HOSTEL");
  const checkedIn = hotel.bookings.find((b) => b.status === "CHECKED_IN")!;
  assert.ok(hotel.sourcePayments.some((x) => x.sourceKey === checkedIn.key));

  for (const industry of RENTAL_INDUSTRIES) {
    const p = plan(industry);
    const totals = new Map<string, number>([
      ...p.rentals.map((r) => [r.key, r.totalAmount] as const),
      ...p.bookings.map((b) => [b.key, b.totalAmount] as const),
    ]);
    const paid = new Map<string, number>();
    for (const x of p.sourcePayments) {
      assert.ok(totals.has(x.sourceKey), `${industry} payment points at a seeded source`);
      assert.equal(x.sourceType === "VEHICLE_RENTAL", industry === "CAR_RENTAL", industry);
      paid.set(x.sourceKey, (paid.get(x.sourceKey) ?? 0) + x.amount);
      assert.ok(x.paymentDate <= NOW, "no future payments");
    }
    for (const [k, v] of paid) assert.ok(v <= totals.get(k)!, `${industry} no overpayment`);
    if (!["CAR_RENTAL", "HOTEL_HOSTEL", "VILLA_RENTAL"].includes(industry)) {
      assert.equal(p.sourcePayments.length, 0, industry);
    }
  }
});

test("source payments on the 1st of month still land in the current month", () => {
  const first = new Date("2026-11-01T08:00:00+05:00");
  const w = incomeWindows(first);
  for (const industry of ["CAR_RENTAL", "HOTEL_HOSTEL", "VILLA_RENTAL"]) {
    const pays = plan(industry, first).sourcePayments;
    assert.ok(pays.length > 0 && pays.every((x) => inWindow(x.paymentDate, w.monthStart, w.monthEnd)), industry);
  }
});

for (const industry of ["CAR_RENTAL", "HOTEL_HOSTEL", "VILLA_RENTAL"] as const) {
  test(`${industry} seed writes source payments with exactly one matching source id; rerun adds none`, async () => {
    const { client, tables } = fakeClient([demoWs("s", industry)]);
    const first = await seedDemoWorkspace({ workspaceId: "s", now: NOW }, client);
    assert.ok(first.seeded && first.counts.sourcePayments > 0);
    const rentalIds = new Set(tables.vehicleRental.map((x) => x.id));
    const bookingIds = new Set(tables.booking.map((x) => x.id));
    for (const p of tables.sourcePayment) {
      assert.equal(p.workspaceId, "s");
      if (p.sourceType === "VEHICLE_RENTAL") {
        assert.ok(rentalIds.has(p.vehicleRentalId as string) && p.bookingId === undefined);
      } else {
        assert.ok(bookingIds.has(p.bookingId as string) && p.vehicleRentalId === undefined);
      }
    }
    const count = tables.sourcePayment.length;
    assert.deepEqual(await seedDemoWorkspace({ workspaceId: "s", now: NOW }, client), {
      seeded: false,
      reason: "NOT_EMPTY",
    });
    assert.equal(tables.sourcePayment.length, count);
  });
}

test("a workspace that already has only source payments is not seeded", async () => {
  const { client, tables } = fakeClient([demoWs("sp", "CAR_RENTAL")]);
  tables.sourcePayment.push({ workspaceId: "sp" });
  assert.deepEqual(await seedDemoWorkspace({ workspaceId: "sp", now: NOW }, client), {
    seeded: false,
    reason: "NOT_EMPTY",
  });
});

test("industry comes from the DB row, invalid stored value falls back to OTHER", async () => {
  const { client } = fakeClient([demoWs("x", "NOT_AN_INDUSTRY")]);
  const r = await seedDemoWorkspace({ workspaceId: "x", now: NOW }, client);
  assert.equal(r.seeded && r.industry, "OTHER");
});

test("register route seeds server-side after DEMO workspace creation, without PII logs", () => {
  const src = readFileSync(join(process.cwd(), "src/app/api/auth/register/route.ts"), "utf8");
  assert.match(src, /seedDemoWorkspace\(\{ workspaceId: workspace\.id \}\)/);
  assert.ok(src.indexOf("createDemoWorkspaceForUser(") < src.indexOf("seedDemoWorkspace("));
  assert.ok(src.indexOf("seedDemoWorkspace(") < src.indexOf("signTokens("));
  assert.doesNotMatch(src, /seedDemoWorkspace\([^)]*industry/);
  assert.doesNotMatch(src, /demo seed failed[^;]*(email|phone|password)/);
  const seedSrc = readFileSync(join(process.cwd(), "src/lib/api-server/demo-seed.ts"), "utf8");
  assert.match(seedSrc, /FOR UPDATE/);
  assert.doesNotMatch(seedSrc, /console\./);
});
