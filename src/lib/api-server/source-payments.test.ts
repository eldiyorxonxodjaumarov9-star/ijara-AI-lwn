import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getPaymentSummary,
  isPayableSource,
  mergeRecentPayments,
  toDashboardPaymentRow,
  parseSourcePaymentInput,
  parseSourcePaymentUpdate,
  sourcePaymentTerms,
  sourceTypeForIndustry,
} from "@/lib/source-payments";
import { RENTAL_INDUSTRIES } from "@/lib/rental-industry";

import {
  allowedSourceType,
  createSourcePayment,
  deleteSourcePayment,
  getSourcePaymentIncome,
  incomeWindows,
  listSourcePayments,
  SourcePaymentError,
  sourcePaymentHistoryResponse,
  updateSourcePayment,
  type SourcePaymentDb,
} from "./source-payments";

const NOW = new Date("2026-10-15T09:00:00+05:00");
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

type Row = Record<string, unknown>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "NOT") return !matches(row, v as Row);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const c = v as { gte?: Date; lt?: Date; in?: unknown[] };
      const val = row[k] as Date;
      if (c.gte && !(val >= c.gte)) return false;
      if (c.lt && !(val < c.lt)) return false;
      if (c.in && !c.in.includes(row[k])) return false;
      return true;
    }
    return row[k] === v;
  });
}

function fakeDb() {
  const rentals: Row[] = [];
  const bookings: Row[] = [];
  const payments: Row[] = [];
  const calls: Record<string, number> = {};
  const hit = (name: string) => (calls[name] = (calls[name] ?? 0) + 1);
  let seq = 0;

  const source = (rows: Row[], name: string) => ({
    findFirst: async ({ where }: { where: Row }) => {
      hit(`${name}.findFirst`);
      return rows.find((r) => matches(r, where)) ?? null;
    },
    findMany: async ({ where }: { where: Row }) => {
      hit(`${name}.findMany`);
      return rows.filter((r) => matches(r, where));
    },
  });

  const sum = (where: Row) => payments.filter((p) => matches(p, where)).reduce((s, p) => s + (p.amount as number), 0);

  const db = {
    $queryRaw: async () => {
      hit("$queryRaw");
      return [];
    },
    vehicleRental: source(rentals, "vehicleRental"),
    booking: source(bookings, "booking"),
    sourcePayment: {
      aggregate: async ({ where }: { where: Row }) => {
        hit("sourcePayment.aggregate");
        const rows = payments.filter((p) => matches(p, where));
        return { _sum: { amount: rows.length ? sum(where) : null } };
      },
      create: async ({ data }: { data: Row }) => {
        hit("sourcePayment.create");
        const row = { id: `pay${++seq}`, vehicleRentalId: null, bookingId: null, createdAt: NOW, ...data };
        payments.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: Row }) => payments.find((p) => matches(p, where)) ?? null,
      findMany: async ({ where }: { where: Row }) => {
        hit("sourcePayment.findMany");
        return payments.filter((p) => matches(p, where));
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const rows = payments.filter((p) => matches(p, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      deleteMany: async ({ where }: { where: Row }) => {
        const before = payments.length;
        for (let i = payments.length - 1; i >= 0; i--) if (matches(payments[i], where)) payments.splice(i, 1);
        return { count: before - payments.length };
      },
      count: async ({ where }: { where: Row }) => payments.filter((p) => matches(p, where)).length,
      groupBy: async ({ by, where }: { by: string[]; where: Row }) => {
        hit("sourcePayment.groupBy");
        const key = by[0];
        const groups = new Map<string, Row[]>();
        for (const p of payments.filter((x) => matches(x, where))) {
          const id = p[key] as string;
          groups.set(id, [...(groups.get(id) ?? []), p]);
        }
        return [...groups].map(([id, rows]) => ({
          [key]: id,
          _sum: { amount: rows.reduce((s, r) => s + (r.amount as number), 0) },
          _max: { paymentDate: rows.map((r) => r.paymentDate as Date).sort((a, b) => +b - +a)[0] },
          _count: { _all: rows.length },
        }));
      },
    },
  };

  const addRental = (id: string, workspaceId: string, totalAmount: number, status = "ACTIVE") =>
    rentals.push({
      id,
      workspaceId,
      totalAmount,
      status,
      startDate: new Date("2026-10-13T00:00:00+05:00"),
      endDate: new Date("2026-10-18T00:00:00+05:00"),
      vehicle: { name: "Chevrolet Tracker", plateNumber: "01 A 123 BC" },
      tenant: { fullName: "Otabek" },
    });
  const addBooking = (id: string, workspaceId: string, totalAmount: number, status = "CONFIRMED") =>
    bookings.push({
      id,
      workspaceId,
      totalAmount,
      status,
      checkInDate: new Date("2026-10-14T00:00:00+05:00"),
      checkOutDate: new Date("2026-10-17T00:00:00+05:00"),
      property: { title: "101 Standard" },
      tenant: { fullName: "Jasur" },
    });

  return { db: db as unknown as SourcePaymentDb, payments, calls, addRental, addBooking };
}

const input = (sourceId: string, amount: number, extra: Row = {}) => {
  const parsed = parseSourcePaymentInput({ sourceId, amount, ...extra });
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);
  return parsed.value;
};

async function rejects(p: Promise<unknown>, code: string, status?: number) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof SourcePaymentError, String(err));
    assert.equal(err.code, code);
    if (status) assert.equal(err.status, status);
    return true;
  });
}

// ---------- summary / status ----------

test("payment summary: UNPAID / PARTIAL / PAID, remaining never negative", () => {
  assert.deepEqual(getPaymentSummary(3_300_000, 0), { total: 3_300_000, paid: 0, remaining: 3_300_000, status: "UNPAID" });
  assert.deepEqual(getPaymentSummary(3_300_000, 2_000_000), {
    total: 3_300_000,
    paid: 2_000_000,
    remaining: 1_300_000,
    status: "PARTIAL",
  });
  assert.deepEqual(getPaymentSummary(1_500_000, 500_000).remaining, 1_000_000);
  assert.equal(getPaymentSummary(1_500_000, 1_500_000).status, "PAID");
  assert.equal(getPaymentSummary(100, 150).remaining, 0);
  assert.equal(isPayableSource("CANCELLED", 100), false);
  assert.equal(isPayableSource("ACTIVE", 0), false);
  assert.equal(isPayableSource("COMPLETED", 10), true);
});

test("industry decides the only source type; property industries have none", () => {
  for (const industry of RENTAL_INDUSTRIES) {
    const expected =
      industry === "CAR_RENTAL" ? "VEHICLE_RENTAL" : industry === "HOTEL_HOSTEL" || industry === "VILLA_RENTAL" ? "BOOKING" : null;
    assert.equal(sourceTypeForIndustry(industry), expected, industry);
  }
  assert.throws(
    () => allowedSourceType({ workspace: { industry: "OFFICE_RENTAL" } } as never),
    (e: unknown) => e instanceof SourcePaymentError && e.status === 403 && e.code === "INDUSTRY_NOT_SUPPORTED"
  );
});

test("UI terminology per industry", () => {
  const car = sourcePaymentTerms("CAR_RENTAL");
  assert.deepEqual([car.customer, car.unit, car.period, car.total], ["Mijoz", "Avtomobil", "Ijara muddati", "Jami ijara"]);
  const hotel = sourcePaymentTerms("HOTEL_HOSTEL");
  assert.deepEqual([hotel.customer, hotel.unit, hotel.period, hotel.total], ["Mehmon", "Xona", "Bron sanalari", "Jami"]);
  const villa = sourcePaymentTerms("VILLA_RENTAL");
  assert.deepEqual([villa.customer, villa.unit, villa.period], ["Mijoz", "Dacha / Villa", "Bron sanalari"]);
});

// ---------- integrity / parsing ----------

test("integrity: source required, two sources rejected, legacy/workspace fields rejected", () => {
  assert.equal(parseSourcePaymentInput({ amount: 100 }).ok, false);
  assert.equal(parseSourcePaymentInput({ vehicleRentalId: "r1", bookingId: "b1", amount: 100 }).ok, false);
  assert.equal(parseSourcePaymentInput({ sourceId: "a", bookingId: "b", amount: 100 }).ok, false);
  assert.equal(parseSourcePaymentInput({ sourceId: "a", contractId: "c", amount: 100 }).ok, false);
  assert.equal(parseSourcePaymentInput({ sourceId: "a", workspaceId: "w", amount: 100 }).ok, false);
  assert.equal(parseSourcePaymentInput({ bookingId: "b", sourceType: "VEHICLE_RENTAL", amount: 100 }).ok, false);
  assert.equal(parseSourcePaymentInput({ sourceId: "a", sourceType: "CONTRACT", amount: 100 }).ok, false);
  assert.equal(parseSourcePaymentInput({ sourceId: "a", amount: 0 }).ok, false);
  assert.equal(parseSourcePaymentInput({ sourceId: "a", amount: -5 }).ok, false);
  assert.equal(parseSourcePaymentInput({ sourceId: "a", amount: 10, paymentMethod: "PAYME" }).ok, false);
  assert.equal(parseSourcePaymentInput({ sourceId: "a", amount: 10, paymentDate: "2026-13-45" }).ok, false);
  const ok = parseSourcePaymentInput({ bookingId: "b1", amount: "500 000", paymentMethod: "card" });
  assert.ok(ok.ok && ok.value.sourceType === "BOOKING" && ok.value.amount === 500_000 && ok.value.paymentMethod === "CARD");
  assert.equal(parseSourcePaymentUpdate({ bookingId: "x" }).ok, false);
  assert.equal(parseSourcePaymentUpdate({ sourceId: "x" }).ok, false);
});

test("DB CHECK enforces exactly one matching source and amount > 0 (migration + runtime mirror)", () => {
  const migration = read("server/prisma/migrations/20261006040000_source_payments/migration.sql");
  const mirror = read("src/lib/api-server/workspace-schema-sql.ts");
  for (const sql of [migration, mirror]) {
    assert.match(sql, /source_payments_one_source_check/);
    assert.match(sql, /"sourceType" = 'VEHICLE_RENTAL' AND "vehicleRentalId" IS NOT NULL AND "bookingId" IS NULL/);
    assert.match(sql, /"sourceType" = 'BOOKING' AND "bookingId" IS NOT NULL AND "vehicleRentalId" IS NULL/);
    assert.match(sql, /"amount" > 0/);
    assert.match(sql, /source_payments_vehicleRentalId_fkey[\s\S]*?ON DELETE NO ACTION/);
    assert.match(sql, /source_payments_bookingId_fkey[\s\S]*?ON DELETE NO ACTION/);
  }
});

// ---------- legacy contract payments ----------

test("legacy Contract payment flow untouched: contractId still required, generic route still validates it", () => {
  const schema = read("server/prisma/schema.prisma");
  const payment = schema.slice(schema.indexOf("model Payment {"), schema.indexOf("}", schema.indexOf("model Payment {")));
  assert.match(payment, /contractId\s+String\n/);
  assert.doesNotMatch(payment, /vehicleRentalId|bookingId|sourceType/);
  const route = read("src/app/api/[resource]/route.ts");
  assert.match(route, /Shartnomani tanlang/);
  assert.match(route, /prisma\.payment\.create/);
  assert.doesNotMatch(route, /sourcePayment/);
  const page = read("src/app/(dashboard)/payments/page.tsx");
  assert.match(page, /isSourcePaymentIndustry\(workspace\?\.industry\)/);
  assert.match(page, /function ContractPaymentsPage\(\)[\s\S]*selectCanonicalDebts/);
});

// ---------- CAR ----------

test("CAR: partial → full → overpay rejected; remaining recalculated", async () => {
  const { db, addRental, payments } = fakeDb();
  addRental("r1", "A", 3_300_000);
  const first = await createSourcePayment(db, "A", "VEHICLE_RENTAL", input("r1", 2_000_000), NOW);
  assert.deepEqual(first.summary, { total: 3_300_000, paid: 2_000_000, remaining: 1_300_000, status: "PARTIAL" });
  assert.equal(first.payment.customerName, "Otabek");
  assert.match(first.payment.unitName, /Tracker/);
  assert.equal(payments[0].vehicleRentalId, "r1");
  assert.equal(payments[0].bookingId, null);
  assert.equal(payments[0].sourceType, "VEHICLE_RENTAL");

  await rejects(createSourcePayment(db, "A", "VEHICLE_RENTAL", input("r1", 1_300_001), NOW), "OVERPAYMENT", 409);
  const full = await createSourcePayment(db, "A", "VEHICLE_RENTAL", input("r1", 1_300_000), NOW);
  assert.equal(full.summary.status, "PAID");
  assert.equal(full.summary.remaining, 0);
  await rejects(createSourcePayment(db, "A", "VEHICLE_RENTAL", input("r1", 1), NOW), "OVERPAYMENT");
});

test("CAR: wrong workspace, wrong industry source, cancelled source, future date", async () => {
  const { db, addRental, addBooking, payments } = fakeDb();
  addRental("r1", "A", 1_000_000);
  addRental("rc", "A", 1_000_000, "CANCELLED");
  addBooking("b1", "A", 1_000_000);
  await rejects(createSourcePayment(db, "B", "VEHICLE_RENTAL", input("r1", 100), NOW), "SOURCE_NOT_FOUND", 404);
  await rejects(
    createSourcePayment(db, "A", "VEHICLE_RENTAL", input("b1", 100, { sourceType: "BOOKING" }), NOW),
    "SOURCE_NOT_ALLOWED",
    400
  );
  await rejects(createSourcePayment(db, "A", "VEHICLE_RENTAL", input("b1", 100), NOW), "SOURCE_NOT_FOUND");
  await rejects(createSourcePayment(db, "A", "VEHICLE_RENTAL", input("rc", 100), NOW), "SOURCE_CLOSED", 409);
  await rejects(
    createSourcePayment(db, "A", "VEHICLE_RENTAL", input("r1", 100, { paymentDate: "2026-10-16" }), NOW),
    "VALIDATION_ERROR",
    400
  );
  await rejects(createSourcePayment(db, "A", "VEHICLE_RENTAL", input("missing", 100), NOW), "SOURCE_NOT_FOUND");
  assert.equal(payments.length, 0);
});

// ---------- BOOKING ----------

test("BOOKING: partial → full, overpay rejected; CONFIRMED booking can stay unpaid", async () => {
  const { db, addBooking } = fakeDb();
  addBooking("b1", "A", 1_500_000, "CONFIRMED");
  const list0 = await listSourcePayments(db, "A", "BOOKING", NOW);
  assert.equal(list0.balances[0].status, "UNPAID");
  assert.equal(list0.balances[0].sourceStatus, "CONFIRMED");

  const p1 = await createSourcePayment(db, "A", "BOOKING", input("b1", 500_000), NOW);
  assert.deepEqual(p1.summary, { total: 1_500_000, paid: 500_000, remaining: 1_000_000, status: "PARTIAL" });
  await rejects(createSourcePayment(db, "A", "BOOKING", input("b1", 1_000_001), NOW), "OVERPAYMENT");
  const p2 = await createSourcePayment(db, "A", "BOOKING", input("b1", 1_000_000), NOW);
  assert.equal(p2.summary.status, "PAID");
});

test("BOOKING: cross-workspace create/update/delete blocked; HOTEL cannot use VEHICLE_RENTAL", async () => {
  const { db, addBooking, addRental } = fakeDb();
  addBooking("b1", "A", 1_000_000);
  addRental("r1", "A", 1_000_000);
  await rejects(createSourcePayment(db, "B", "BOOKING", input("b1", 100), NOW), "SOURCE_NOT_FOUND");
  await rejects(
    createSourcePayment(db, "A", "BOOKING", input("r1", 100, { sourceType: "VEHICLE_RENTAL" }), NOW),
    "SOURCE_NOT_ALLOWED"
  );
  await rejects(createSourcePayment(db, "A", "BOOKING", input("r1", 100), NOW), "SOURCE_NOT_FOUND");

  const { payment } = await createSourcePayment(db, "A", "BOOKING", input("b1", 300_000), NOW);
  await rejects(updateSourcePayment(db, "B", "BOOKING", payment.id, { amount: 1 }, NOW), "NOT_FOUND", 404);
  await rejects(deleteSourcePayment(db, "B", "BOOKING", payment.id), "NOT_FOUND", 404);
  await rejects(deleteSourcePayment(db, "A", "VEHICLE_RENTAL", payment.id), "NOT_FOUND", 404);
  const listB = await listSourcePayments(db, "B", "BOOKING", NOW);
  assert.equal(listB.payments.length, 0);
});

test("update re-checks remaining (excluding itself); delete recalculates paid/remaining", async () => {
  const { db, addBooking } = fakeDb();
  addBooking("b1", "A", 1_000_000);
  const a = await createSourcePayment(db, "A", "BOOKING", input("b1", 400_000), NOW);
  await createSourcePayment(db, "A", "BOOKING", input("b1", 300_000), NOW);
  await rejects(updateSourcePayment(db, "A", "BOOKING", a.payment.id, { amount: 700_001 }, NOW), "OVERPAYMENT");
  const up = await updateSourcePayment(db, "A", "BOOKING", a.payment.id, { amount: 700_000 }, NOW);
  assert.equal(up.summary.status, "PAID");
  const del = await deleteSourcePayment(db, "A", "BOOKING", a.payment.id);
  assert.deepEqual(del.summary, { total: 1_000_000, paid: 300_000, remaining: 700_000, status: "PARTIAL" });
});

// ---------- list / income ----------

test("list aggregates on the server with a fixed number of queries (no N+1)", async () => {
  const { db, addRental, calls } = fakeDb();
  for (let i = 0; i < 25; i++) addRental(`r${i}`, "A", 1_000_000);
  for (let i = 0; i < 25; i++) await createSourcePayment(db, "A", "VEHICLE_RENTAL", input(`r${i}`, 100_000), NOW);
  for (const k of Object.keys(calls)) delete calls[k];
  const list = await listSourcePayments(db, "A", "VEHICLE_RENTAL", NOW);
  assert.equal(list.balances.length, 25);
  assert.ok(list.balances.every((b) => b.paid === 100_000 && b.remaining === 900_000 && b.paymentCount === 1));
  assert.equal(calls["sourcePayment.groupBy"], 1);
  assert.equal(calls["vehicleRental.findMany"], 1);
  assert.equal(calls["sourcePayment.findMany"], 1);
  assert.equal(calls["vehicleRental.findFirst"] ?? 0, 0);
});

test("income: real payments only (today / month windows in Tashkent), totalAmount is never revenue", async () => {
  const { db, addBooking, payments } = fakeDb();
  addBooking("b1", "A", 9_000_000);
  assert.deepEqual(await getSourcePaymentIncome(db, "A", "BOOKING", NOW), { today: 0, month: 0 });
  await createSourcePayment(db, "A", "BOOKING", input("b1", 500_000), NOW);
  await createSourcePayment(db, "A", "BOOKING", input("b1", 200_000, { paymentDate: "2026-10-02" }), NOW);
  payments.push({
    id: "old",
    workspaceId: "A",
    sourceType: "BOOKING",
    bookingId: "b1",
    amount: 999,
    paymentDate: new Date("2026-09-30T23:00:00+05:00"),
  });
  payments.push({ id: "other", workspaceId: "B", sourceType: "BOOKING", bookingId: "x", amount: 777, paymentDate: NOW });
  assert.deepEqual(await getSourcePaymentIncome(db, "A", "BOOKING", NOW), { today: 500_000, month: 700_000 });
  assert.deepEqual(await getSourcePaymentIncome(db, "A", "VEHICLE_RENTAL", NOW), { today: 0, month: 0 });
});

test("income windows follow Asia/Tashkent midnight, incl. year rollover", () => {
  const w = incomeWindows(new Date("2026-12-31T20:30:00Z"));
  assert.equal(w.dayStart.toISOString(), "2026-12-31T19:00:00.000Z");
  assert.equal(w.monthStart.toISOString(), "2026-12-31T19:00:00.000Z");
  assert.equal(w.monthEnd.toISOString(), "2027-01-31T19:00:00.000Z");
});

// ---------- history ----------

test("history guard: rental/booking/tenant with payments cannot be deleted", async () => {
  const counts: Row[] = [];
  const db = {
    sourcePayment: {
      count: async ({ where }: { where: Row }) => {
        counts.push(where);
        return 1;
      },
    },
  };
  const r = await sourcePaymentHistoryResponse(db as never, { vehicleRentalId: "r1" }, "A");
  assert.equal(r?.status, 409);
  assert.deepEqual(counts[0], { vehicleRentalId: "r1", workspaceId: "A" });
  assert.equal((await sourcePaymentHistoryResponse(db as never, { bookingId: "b1" }, "A"))?.status, 409);
  assert.equal((await sourcePaymentHistoryResponse(db as never, { tenantId: "t1" }))?.status, 409);
  const none = { sourcePayment: { count: async () => 0 } };
  assert.equal(await sourcePaymentHistoryResponse(none as never, { bookingId: "b1" }), null);
});

test("delete routes wire the payment-history guard; schema keeps NoAction to sources", () => {
  assert.match(read("src/app/api/vehicle-rentals/[id]/route.ts"), /sourcePaymentHistoryResponse\(prisma, \{ vehicleRentalId: id \}, workspaceId\)/);
  assert.match(read("src/app/api/bookings/[id]/route.ts"), /sourcePaymentHistoryResponse\(prisma, \{ bookingId: id \}, workspaceId\)/);
  assert.match(read("src/app/api/[resource]/[id]/route.ts"), /sourcePaymentHistoryResponse\(prisma, \{ tenantId: id \}\)/);
  assert.match(read("src/app/api/clients/[id]/route.ts"), /sourcePaymentHistoryResponse\(prisma, \{ tenantId: existing\.tenantId \}\)/);
  const schema = read("server/prisma/schema.prisma");
  assert.match(schema, /vehicleRental VehicleRental\?\s+@relation\(fields: \[vehicleRentalId\], references: \[id\], onDelete: NoAction\)/);
  assert.match(schema, /booking\s+Booking\?\s+@relation\(fields: \[bookingId\], references: \[id\], onDelete: NoAction\)/);
});

test("dashboard: CAR/HOTEL/VILLA add real source payment income; property industries unchanged", () => {
  const page = read("src/app/(dashboard)/dashboard/page.tsx");
  assert.match(page, /useSourcePaymentIncome\(usesSourcePayments\)/);
  assert.match(page, /metrics\.monthlyIncomeActual \+ sourceIncome\.month/);
  assert.match(page, /: metrics\.monthlyIncome;/);
  assert.match(page, /contractTodayIncome \+ sourceIncome\.today/);
  assert.doesNotMatch(page, /totalAmount/);
});

test("recent payments: source rows map to the legacy dashboard shape and merge newest-first", () => {
  const src = {
    id: "s1",
    sourceType: "BOOKING" as const,
    sourceId: "b1",
    amount: 500_000,
    paymentDate: "2026-10-15T04:00:00.000Z",
    paymentMethod: "CARD" as const,
    notes: null,
    customerName: "Jasur",
    unitName: "101 Standard",
    createdAt: "2026-10-15T04:00:00.000Z",
  };
  const row = toDashboardPaymentRow(src);
  assert.deepEqual(
    { tenantName: row.tenantName, propertyName: row.propertyName, method: row.method, amount: row.amount, date: row.date },
    { tenantName: "Jasur", propertyName: "101 Standard", method: "card", amount: 500_000, date: src.paymentDate }
  );
  assert.equal(row.id, "sp:s1", "ids never collide with legacy payment ids");
  const legacy = [{ id: "p1", amount: 1, date: "2026-10-14T00:00:00.000Z", method: "cash" as const, createdAt: "x" }];
  const merged = mergeRecentPayments(legacy, [src, { ...src, id: "s0", paymentDate: "2026-10-01T00:00:00.000Z" }], 2);
  assert.deepEqual(merged.map((m) => m.id), ["sp:s1", "p1"]);
  const page = read("src/app/(dashboard)/dashboard/page.tsx");
  assert.match(page, /usesSourcePayments \? mergeRecentPayments\(payments, sourceIncome\.recent\) : payments/);
  assert.match(page, /payments=\{industryPayments\}/);
  assert.match(read("src/app/api/source-payments/income/route.ts"), /listRecentSourcePayments/);
});

test("payments UI: industry columns and 'To‘lov qo‘shish' action", () => {
  const view = read("src/components/payments/source-payments-view.tsx");
  for (const s of ["terms.customer", "terms.unit", "terms.period", "terms.total", "To‘langan", "Qolgan", "Oxirgi to‘lov", "Holat", "To‘lov qo‘shish"]) {
    assert.ok(view.includes(s), s);
  }
  assert.match(view, /isCar && <TableHead[^>]*>Oxirgi to‘lov/);
});
