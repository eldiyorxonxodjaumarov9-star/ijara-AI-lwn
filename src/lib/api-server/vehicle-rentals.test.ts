import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";

import { getIndustryDashboardConfig, industryBlockMode, resolveIndustryKpiValue } from "@/lib/dashboard-industry";
import {
  addDays,
  dayIndex,
  initialRentalStatus,
  parseRentalInput,
  parseRentalUpdate,
  rentalDays,
  rentalRangesOverlap,
  rentalTotal,
  selectActiveRentals,
  selectTodayRentals,
  selectUpcomingReturns,
  tashkentToday,
} from "@/lib/vehicle-rentals";

import {
  createRental,
  deleteRental,
  getRental,
  listRentals,
  promoteDueRentals,
  tenantRentalHistoryResponse,
  updateRental,
  type RentalDb,
} from "./vehicle-rentals";
import { deleteVehicle, syncVehicleRentalStatus, VehicleError } from "./vehicles";

const NOW = new Date("2026-10-06T10:00:00+05:00");
const TODAY = tashkentToday(NOW);
const day = (offset: number) => addDays(TODAY, offset);

type Row = Record<string, unknown> & { id: string };
type Cond = Record<string, unknown>;

function matches(row: Row, where: Cond): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "NOT") return !matches(row, cond as Cond);
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { in?: unknown[]; lte?: Date; gte?: Date };
      if (c.in && !c.in.includes(value)) return false;
      if (c.lte && !((value as Date).getTime() <= c.lte.getTime())) return false;
      if (c.gte && !((value as Date).getTime() >= c.gte.getTime())) return false;
      return true;
    }
    return value === cond;
  });
}

/** In-memory prisma stand-in for vehicle / vehicleRental / tenant. */
function fakeDb() {
  const t: Record<"vehicle" | "vehicleRental" | "tenant", Row[]> = { vehicle: [], vehicleRental: [], tenant: [] };
  let seq = 0;
  const withInclude = (row: Row, include?: unknown) => {
    if (!include) return { ...row };
    const v = t.vehicle.find((x) => x.id === row.vehicleId);
    const c = t.tenant.find((x) => x.id === row.tenantId);
    return { ...row, vehicle: v && { name: v.name, plateNumber: v.plateNumber }, tenant: c && { fullName: c.fullName } };
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
      const row = { createdAt: new Date(), ...data, id: data.id ?? `${name}-${++seq}` } as Row;
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
  const payments: Row[] = [];
  const db = {
    $queryRaw: async () => [],
    vehicle: model("vehicle"),
    vehicleRental: model("vehicleRental"),
    tenant: model("tenant"),
    sourcePayment: {
      aggregate: async ({ where }: { where: Cond }) => {
        const rows = payments.filter((p) => matches(p, where));
        return { _sum: { amount: rows.length ? rows.reduce((s, p) => s + (p.amount as number), 0) : null } };
      },
    },
  } as unknown as RentalDb;
  const addPayment = (workspaceId: string, vehicleRentalId: string, amount: number) =>
    payments.push({ id: `pay-${++seq}`, workspaceId, vehicleRentalId, amount });
  const addVehicle = (workspaceId: string, status = "AVAILABLE", dailyRate = 300_000) => {
    const row = { id: `veh-${++seq}`, workspaceId, name: `Car ${seq}`, plateNumber: `01 A ${seq}`, status, dailyRate };
    t.vehicle.push(row);
    return row;
  };
  const addCustomer = (workspaceId: string) => {
    const row = { id: `cus-${++seq}`, workspaceId, fullName: `Customer ${seq}` };
    t.tenant.push(row);
    return row;
  };
  const vehicleStatus = (id: string) => t.vehicle.find((v) => v.id === id)?.status;
  return { db, t, addVehicle, addCustomer, vehicleStatus, addPayment };
}

const input = (vehicleId: string, tenantId: string, start: string, end: string, dailyRate = 300_000) => ({
  vehicleId,
  tenantId,
  startDate: start,
  endDate: end,
  dailyRate,
  notes: null,
});

async function rejects(p: Promise<unknown>, status: number, code: string) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof VehicleError, String(err));
    assert.equal(err.code, code);
    assert.equal(err.status, status);
    return true;
  });
}

describe("pricing convention", () => {
  it("inclusive calendar days: same day = 1, 1st→3rd = 3", () => {
    assert.equal(rentalDays("2026-10-06", "2026-10-06"), 1);
    assert.equal(rentalDays("2026-10-01", "2026-10-03"), 3);
    assert.equal(rentalDays("2026-12-31", "2027-01-01"), 2);
    assert.equal(rentalDays("2026-10-05", "2026-10-04"), null);
    assert.equal(rentalTotal(3, 350_000), 1_050_000);
  });

  it("rejects invalid dates, reversed range, zero/negative rate", () => {
    assert.equal(dayIndex("2026-02-30"), null);
    const base = { vehicleId: "v", tenantId: "t", startDate: day(0), endDate: day(2), dailyRate: 100 };
    assert.match(parseRentalInput({ ...base, startDate: "06.10.2026" }).error ?? "", /Boshlanish/);
    assert.match(parseRentalInput({ ...base, endDate: day(-1) }).error ?? "", /oldin/);
    assert.match(parseRentalInput({ ...base, dailyRate: 0 }).error ?? "", /0 dan katta/);
    assert.match(parseRentalInput({ ...base, dailyRate: -5 }).error ?? "", /0 dan katta/);
    assert.match(parseRentalInput({ ...base, endDate: day(400) }).error ?? "", /365/);
    assert.equal(parseRentalInput({ ...base, vehicleId: "" }).error, "Avtomobilni tanlang");
    assert.equal(parseRentalInput({ ...base, tenantId: "" }).error, "Mijozni tanlang");
    assert.equal(parseRentalInput({ ...base, tenantId: undefined, customerId: "c1" }).data?.tenantId, "c1");
    assert.equal("workspaceId" in (parseRentalInput({ ...base, workspaceId: "B" }).data ?? {}), false);
    assert.equal(parseRentalUpdate({ status: "ACTIVE" }).error, "Status noto‘g‘ri");
  });

  it("status from dates: past COMPLETED, covering today ACTIVE, future PLANNED", () => {
    assert.equal(initialRentalStatus(day(-5), day(-1), TODAY), "COMPLETED");
    assert.equal(initialRentalStatus(day(0), day(0), TODAY), "ACTIVE");
    assert.equal(initialRentalStatus(day(1), day(3), TODAY), "PLANNED");
  });

  it("overlap is inclusive (same-day handover blocks)", () => {
    const a = { startDate: day(0), endDate: day(3) };
    assert.equal(rentalRangesOverlap(a, { startDate: day(3), endDate: day(5) }), true);
    assert.equal(rentalRangesOverlap(a, { startDate: day(4), endDate: day(5) }), false);
  });
});

describe("create", () => {
  it("available vehicle + customer → ACTIVE rental with correct total; vehicle RENTED", async () => {
    const { db, addVehicle, addCustomer, vehicleStatus } = fakeDb();
    const v = addVehicle("A");
    const c = addCustomer("A");
    const r = await createRental(db, "A", input(v.id, c.id, day(0), day(2), 350_000), NOW);
    assert.equal(r.status, "ACTIVE");
    assert.equal(r.days, 3);
    assert.equal(r.totalAmount, 1_050_000);
    assert.equal(r.startDate, day(0));
    assert.equal(r.vehicleName, v.name);
    assert.equal(r.customerName, c.fullName);
    assert.equal(vehicleStatus(v.id), "RENTED");
  });

  it("same-day rental = 1 day", async () => {
    const { db, addVehicle, addCustomer } = fakeDb();
    const r = await createRental(db, "A", input(addVehicle("A").id, addCustomer("A").id, day(0), day(0), 500_000), NOW);
    assert.equal(r.days, 1);
    assert.equal(r.totalAmount, 500_000);
  });

  it("future rental is PLANNED and does not mark the vehicle RENTED until its day", async () => {
    const { db, addVehicle, addCustomer, vehicleStatus } = fakeDb();
    const v = addVehicle("A");
    const r = await createRental(db, "A", input(v.id, addCustomer("A").id, day(3), day(5)), NOW);
    assert.equal(r.status, "PLANNED");
    assert.equal(vehicleStatus(v.id), "AVAILABLE");
    assert.equal(await promoteDueRentals(db, "A", NOW), 0);
    const later = new Date(NOW.getTime() + 3 * 86_400_000);
    assert.equal(await promoteDueRentals(db, "A", later), 1);
    assert.equal((await getRental(db, "A", r.id)).status, "ACTIVE");
    assert.equal(vehicleStatus(v.id), "RENTED");
  });

  it("maintenance and inactive vehicles cannot be rented", async () => {
    const { db, addVehicle, addCustomer } = fakeDb();
    const c = addCustomer("A");
    for (const status of ["MAINTENANCE", "INACTIVE"]) {
      const v = addVehicle("A", status);
      await rejects(createRental(db, "A", input(v.id, c.id, day(1), day(2)), NOW), 409, "VEHICLE_NOT_RENTABLE");
    }
  });
});

describe("availability", () => {
  it("overlapping active/planned rental → 409 VEHICLE_NOT_AVAILABLE; non-overlap allowed", async () => {
    const { db, addVehicle, addCustomer } = fakeDb();
    const v = addVehicle("A");
    const c = addCustomer("A");
    await createRental(db, "A", input(v.id, c.id, day(0), day(3)), NOW);
    await rejects(createRental(db, "A", input(v.id, c.id, day(2), day(6)), NOW), 409, "VEHICLE_NOT_AVAILABLE");
    await rejects(createRental(db, "A", input(v.id, c.id, day(3), day(4)), NOW), 409, "VEHICLE_NOT_AVAILABLE");
    const planned = await createRental(db, "A", input(v.id, c.id, day(4), day(6)), NOW);
    assert.equal(planned.status, "PLANNED");
    await rejects(createRental(db, "A", input(v.id, c.id, day(5), day(5)), NOW), 409, "VEHICLE_NOT_AVAILABLE");
  });

  it("cancelled and completed rentals do not block", async () => {
    const { db, addVehicle, addCustomer } = fakeDb();
    const v = addVehicle("A");
    const c = addCustomer("A");
    const first = await createRental(db, "A", input(v.id, c.id, day(1), day(3)), NOW);
    await updateRental(db, "A", first.id, { status: "CANCELLED" }, NOW);
    const second = await createRental(db, "A", input(v.id, c.id, day(0), day(2)), NOW);
    await updateRental(db, "A", second.id, { status: "COMPLETED" }, NOW);
    const third = await createRental(db, "A", input(v.id, c.id, day(0), day(3)), NOW);
    assert.equal(third.status, "ACTIVE");
  });

  it("a different vehicle on the same dates is fine", async () => {
    const { db, addVehicle, addCustomer } = fakeDb();
    const c = addCustomer("A");
    await createRental(db, "A", input(addVehicle("A").id, c.id, day(0), day(3)), NOW);
    await createRental(db, "A", input(addVehicle("A").id, c.id, day(0), day(3)), NOW);
  });
});

describe("vehicle status sync", () => {
  it("complete → AVAILABLE", async () => {
    const { db, addVehicle, addCustomer, vehicleStatus } = fakeDb();
    const v = addVehicle("A");
    const r = await createRental(db, "A", input(v.id, addCustomer("A").id, day(0), day(2)), NOW);
    assert.equal((await updateRental(db, "A", r.id, { status: "COMPLETED" }, NOW)).status, "COMPLETED");
    assert.equal(vehicleStatus(v.id), "AVAILABLE");
  });

  it("cancel → AVAILABLE only if no other active rental remains", async () => {
    const { db, t, addVehicle, addCustomer, vehicleStatus } = fakeDb();
    const v = addVehicle("A");
    const c = addCustomer("A");
    const a = await createRental(db, "A", input(v.id, c.id, day(0), day(1)), NOW);
    // A second ACTIVE row on the same vehicle (e.g. an overdue return) keeps it RENTED.
    t.vehicleRental.push({ ...t.vehicleRental[0], id: "extra", startDate: new Date(0), endDate: new Date(0) });
    await updateRental(db, "A", a.id, { status: "CANCELLED" }, NOW);
    assert.equal(vehicleStatus(v.id), "RENTED");
    await updateRental(db, "A", "extra", { status: "CANCELLED" }, NOW);
    assert.equal(vehicleStatus(v.id), "AVAILABLE");
  });

  it("only ACTIVE rentals can be completed; closed rentals cannot change", async () => {
    const { db, addVehicle, addCustomer } = fakeDb();
    const r = await createRental(db, "A", input(addVehicle("A").id, addCustomer("A").id, day(2), day(3)), NOW);
    await rejects(updateRental(db, "A", r.id, { status: "COMPLETED" }, NOW), 409, "INVALID_TRANSITION");
    await updateRental(db, "A", r.id, { status: "CANCELLED" }, NOW);
    await rejects(updateRental(db, "A", r.id, { notes: "x" }, NOW), 409, "RENTAL_CLOSED");
  });

  it("editing dates/rate recalculates total and re-checks availability", async () => {
    const { db, addVehicle, addCustomer } = fakeDb();
    const v = addVehicle("A");
    const c = addCustomer("A");
    const r = await createRental(db, "A", input(v.id, c.id, day(1), day(2), 100_000), NOW);
    const other = await createRental(db, "A", input(v.id, c.id, day(5), day(6)), NOW);
    const edited = await updateRental(db, "A", r.id, { startDate: day(1), endDate: day(4), dailyRate: 200_000 }, NOW);
    assert.equal(edited.days, 4);
    assert.equal(edited.totalAmount, 800_000);
    await rejects(
      updateRental(db, "A", r.id, { startDate: day(1), endDate: day(5) }, NOW),
      409,
      "VEHICLE_NOT_AVAILABLE"
    );
    assert.equal((await getRental(db, "A", other.id)).status, "PLANNED");
  });

  it("deleting the active rental frees the vehicle", async () => {
    const { db, addVehicle, addCustomer, vehicleStatus } = fakeDb();
    const v = addVehicle("A");
    const r = await createRental(db, "A", input(v.id, addCustomer("A").id, day(0), day(1)), NOW);
    await deleteRental(db, "A", r.id);
    assert.equal(vehicleStatus(v.id), "AVAILABLE");
    assert.equal((await listRentals(db, "A")).length, 0);
  });
});

describe("Stage 10: total-below-paid, tenant history, central status sync", () => {
  it("total 3m, paid 2m: lowering to 1.5m → 409 TOTAL_BELOW_PAID; 2m and 4m allowed", async () => {
    const { db, addVehicle, addCustomer, addPayment } = fakeDb();
    const v = addVehicle("A");
    const r = await createRental(db, "A", input(v.id, addCustomer("A").id, day(0), day(2), 1_000_000), NOW);
    assert.equal(r.totalAmount, 3_000_000);
    addPayment("A", r.id, 2_000_000);
    await rejects(updateRental(db, "A", r.id, { dailyRate: 500_000 }, NOW), 409, "TOTAL_BELOW_PAID");
    await rejects(updateRental(db, "A", r.id, { startDate: day(0), endDate: day(0) }, NOW), 409, "TOTAL_BELOW_PAID");
    assert.equal((await getRental(db, "A", r.id)).totalAmount, 3_000_000, "rejected edit left the row unchanged");
    assert.equal((await updateRental(db, "A", r.id, { startDate: day(0), endDate: day(1) }, NOW)).totalAmount, 2_000_000);
    assert.equal((await updateRental(db, "A", r.id, { startDate: day(0), endDate: day(3) }, NOW)).totalAmount, 4_000_000);
  });

  it("another workspace's payments never count toward paid", async () => {
    const { db, addVehicle, addCustomer, addPayment } = fakeDb();
    const r = await createRental(db, "A", input(addVehicle("A").id, addCustomer("A").id, day(0), day(2), 1_000_000), NOW);
    addPayment("B", r.id, 2_900_000);
    assert.equal((await updateRental(db, "A", r.id, { dailyRate: 100_000 }, NOW)).totalAmount, 300_000);
  });

  it("tenant with rental history (any status) → 409 TENANT_HAS_RENTAL_HISTORY", async () => {
    const { db, addVehicle, addCustomer } = fakeDb();
    const c = addCustomer("A");
    const r = await createRental(db, "A", input(addVehicle("A").id, c.id, day(1), day(2)), NOW);
    await updateRental(db, "A", r.id, { status: "CANCELLED" }, NOW);
    const res = await tenantRentalHistoryResponse(db, c.id);
    assert.equal(res?.status, 409);
    assert.equal((await res!.json()).error.code, "TENANT_HAS_RENTAL_HISTORY");
    assert.equal(await tenantRentalHistoryResponse(db, addCustomer("A").id), null);
  });

  it("syncVehicleRentalStatus: ACTIVE → RENTED, none/PLANNED only → AVAILABLE, manual states untouched", async () => {
    const { db, t, addVehicle, addCustomer, vehicleStatus } = fakeDb();
    const v = addVehicle("A", "RENTED");
    const c = addCustomer("A");
    await syncVehicleRentalStatus(db, "A", v.id);
    assert.equal(vehicleStatus(v.id), "AVAILABLE", "stale RENTED without ACTIVE rental is repaired");
    await createRental(db, "A", input(v.id, c.id, day(5), day(6)), NOW);
    await syncVehicleRentalStatus(db, "A", v.id);
    assert.equal(vehicleStatus(v.id), "AVAILABLE", "future PLANNED keeps AVAILABLE");
    t.vehicleRental.push({ id: "act", workspaceId: "A", vehicleId: v.id, tenantId: c.id, status: "ACTIVE" });
    await syncVehicleRentalStatus(db, "A", v.id);
    assert.equal(vehicleStatus(v.id), "RENTED");
    for (const manual of ["MAINTENANCE", "INACTIVE"]) {
      const m = addVehicle("A", manual);
      t.vehicleRental.push({ id: `act-${manual}`, workspaceId: "A", vehicleId: m.id, tenantId: c.id, status: "ACTIVE" });
      await syncVehicleRentalStatus(db, "A", m.id);
      assert.equal(vehicleStatus(m.id), manual);
    }
    await syncVehicleRentalStatus(db, "B", v.id);
    assert.equal(vehicleStatus(v.id), "RENTED", "other workspace cannot touch the vehicle");
  });

  it("FK + guards: schema/migration/mirror keep rental history; delete routes call the guard", () => {
    const schema = readFileSync(join(process.cwd(), "server/prisma/schema.prisma"), "utf8");
    assert.match(schema, /tenant\s+Tenant\s+@relation\(fields: \[tenantId\], references: \[id\], onDelete: NoAction\)\n\s+payments\s+SourcePayment\[\]/);
    const mig = readFileSync(join(process.cwd(), "server/prisma/migrations/20261006050000_vehicle_rental_tenant_no_action/migration.sql"), "utf8");
    const mirror = readFileSync(join(process.cwd(), "src/lib/api-server/workspace-schema-sql.ts"), "utf8");
    for (const sql of [mig, mirror]) {
      assert.match(sql, /confdeltype = 'c'/);
      assert.match(sql, /vehicle_rentals_tenantId_fkey"\s+FOREIGN KEY \("tenantId"\) REFERENCES "tenants"\("id"\)\s+ON DELETE NO ACTION/);
    }
    assert.doesNotMatch(mirror, /vehicle_rentals_tenantId_fkey"\s+FOREIGN KEY \("tenantId"\) REFERENCES "tenants"\("id"\)\s+ON DELETE CASCADE/);
    for (const p of ["src/app/api/[resource]/[id]/route.ts", "src/app/api/clients/[id]/route.ts"]) {
      assert.match(readFileSync(join(process.cwd(), p), "utf8"), /tenantRentalHistoryResponse\(prisma, /, p);
    }
    const vehiclesRoute = readFileSync(join(process.cwd(), "src/app/api/vehicles/route.ts"), "utf8");
    assert.match(vehiclesRoute, /reconcileVehicleStatuses\(prisma, guard\.ctx\.workspace\.id\)/);
  });
});

describe("vehicle delete rules", () => {
  it("open rental → 409 VEHICLE_IN_USE; history only → 409 VEHICLE_HAS_HISTORY", async () => {
    const { db, t, addVehicle, addCustomer } = fakeDb();
    const v = addVehicle("A");
    const r = await createRental(db, "A", input(v.id, addCustomer("A").id, day(1), day(2)), NOW);
    await rejects(deleteVehicle(db, "A", v.id), 409, "VEHICLE_IN_USE");
    await updateRental(db, "A", r.id, { status: "CANCELLED" }, NOW);
    await rejects(deleteVehicle(db, "A", v.id), 409, "VEHICLE_HAS_HISTORY");
    assert.equal(t.vehicle.length, 1);
    const free = addVehicle("A");
    assert.deepEqual(await deleteVehicle(db, "A", free.id), { id: free.id });
  });
});

describe("workspace isolation (critical)", () => {
  it("B cannot rent A's vehicle or A's customer, nor see/update/delete A's rental", async () => {
    const { db, t, addVehicle, addCustomer, vehicleStatus } = fakeDb();
    const vA = addVehicle("A");
    const cA = addCustomer("A");
    const vB = addVehicle("B");
    const cB = addCustomer("B");
    const rentalA = await createRental(db, "A", input(vA.id, cA.id, day(0), day(2)), NOW);

    await rejects(createRental(db, "B", input(vA.id, cB.id, day(5), day(6)), NOW), 404, "NOT_FOUND");
    await rejects(createRental(db, "B", input(vB.id, cA.id, day(5), day(6)), NOW), 404, "CUSTOMER_NOT_FOUND");
    assert.equal((await listRentals(db, "B")).length, 0);
    await rejects(getRental(db, "B", rentalA.id), 404, "NOT_FOUND");
    await rejects(updateRental(db, "B", rentalA.id, { status: "CANCELLED" }, NOW), 404, "NOT_FOUND");
    await rejects(deleteRental(db, "B", rentalA.id), 404, "NOT_FOUND");

    const rentalB = await createRental(db, "B", input(vB.id, cB.id, day(0), day(1)), NOW);
    await rejects(updateRental(db, "B", rentalB.id, { tenantId: cA.id }, NOW), 404, "CUSTOMER_NOT_FOUND");

    const row = t.vehicleRental.find((r) => r.id === rentalA.id)!;
    assert.equal(row.status, "ACTIVE");
    assert.equal(row.workspaceId, "A");
    assert.equal(vehicleStatus(vA.id), "RENTED");
  });

  it("unauthenticated requests get 401 on every rental route", async () => {
    process.env.DATABASE_URL ??= "postgresql://unit-test/none";
    const list = await import("@/app/api/vehicle-rentals/route");
    const item = await import("@/app/api/vehicle-rentals/[id]/route");
    const req = (method: string) =>
      new NextRequest("http://localhost/api/vehicle-rentals/x", {
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
      await item.DELETE(req("DELETE"), params),
    ]) {
      assert.equal(res.status, 401);
    }
  });

  it("rental routes use the CAR_RENTAL guard, server workspace and a transaction", () => {
    const list = readFileSync(join(process.cwd(), "src/app/api/vehicle-rentals/route.ts"), "utf8");
    const item = readFileSync(join(process.cwd(), "src/app/api/vehicle-rentals/[id]/route.ts"), "utf8");
    assert.equal(list.match(/requireVehicleWorkspace\(req/g)?.length, 2);
    assert.equal(item.match(/requireVehicleWorkspace\(req/g)?.length, 3);
    for (const src of [list, item]) {
      assert.match(src, /guard\.ctx\.workspace\.id/);
      assert.doesNotMatch(src, /body\.workspaceId/);
    }
    assert.match(list, /prisma\.\$transaction\(\(tx\) => createRental/);
    const service = readFileSync(join(process.cwd(), "src/lib/api-server/vehicle-rentals.ts"), "utf8");
    assert.match(service, /FOR UPDATE/);
  });
});

describe("dashboard rental data", () => {
  const rentals = [
    { id: "1", status: "ACTIVE", startDate: day(0), endDate: day(2) },
    { id: "2", status: "ACTIVE", startDate: day(-5), endDate: day(-1) },
    { id: "3", status: "ACTIVE", startDate: day(-1), endDate: day(20) },
    { id: "4", status: "PLANNED", startDate: day(0), endDate: day(1) },
    { id: "5", status: "CANCELLED", startDate: day(0), endDate: day(1) },
    { id: "6", status: "COMPLETED", startDate: day(-9), endDate: day(-8) },
  ] as const;
  const list = rentals.map((r) => ({ ...r }));

  it("Bugungi ijara counts rentals starting today (not cancelled)", () => {
    assert.deepEqual(selectTodayRentals(list, TODAY).map((r) => r.id), ["1", "4"]);
    const value = resolveIndustryKpiValue("todayRentals", {
      inventory: { total: 0, occupied: 0, vacant: 0 },
      monthlyIncome: 0,
      debtCount: 0,
      todayIncome: 0,
      todayRentals: 2,
    });
    assert.equal(value, 2);
  });

  it("Faol ijaralar = ACTIVE only; Yaqin qaytarishlar = ACTIVE due within 7 days, overdue first", () => {
    assert.deepEqual(selectActiveRentals(list).map((r) => r.id), ["2", "1", "3"]);
    assert.deepEqual(selectUpcomingReturns(list, TODAY).map((r) => r.id), ["2", "1"]);
  });

  it("CAR_RENTAL blocks render rental data; other industries stay empty", () => {
    const car = getIndustryDashboardConfig("CAR_RENTAL")!;
    assert.equal(industryBlockMode("activeRentals", car.usePropertyInventory, car.useVehicleInventory), "activeRentals");
    assert.equal(industryBlockMode("upcomingReturns", car.usePropertyInventory, car.useVehicleInventory), "upcomingReturns");
    assert.equal(industryBlockMode("activeRentals", true, false), "empty");
    const src = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"), "utf8");
    assert.match(src, /useVehicleRentals\(\s*industryConfig\?\.useVehicleInventory === true\s*\)/);
    assert.match(src, /monthlyIncome=\{industryMonthlyIncome\}/);
  });
});

describe("/contracts UI", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx"), "utf8");
  const view = readFileSync(join(process.cwd(), "src/components/vehicle-rentals/car-rentals-view.tsx"), "utf8");

  it("CAR_RENTAL renders the rentals view, everything else the unchanged contracts page", () => {
    assert.match(page, /if \(workspace\?\.industry === "CAR_RENTAL"\) return <CarRentalsView \/>;/);
    assert.match(page, /return <PropertyContractsPage \/>;/);
    assert.match(page, /function PropertyContractsPage\(\)[\s\S]*useCollection<Contract>\("contracts"\)/);
  });

  it("rentals view: title, create button and required columns", () => {
    assert.match(view, /title="Ijaralar"/);
    assert.match(view, /Ijara yaratish/);
    for (const column of ["Avtomobil", "Mijoz", "Boshlanish", "Tugash", "Kunlik narx", "Jami", "Status"]) {
      assert.match(view, new RegExp(`<TableHead[^>]*>${column}</TableHead>`), column);
    }
    assert.match(view, /sr-only">Amallar/);
  });

  it("dialog pre-fills the vehicle daily rate and shows a live total", () => {
    const dialog = readFileSync(join(process.cwd(), "src/components/vehicle-rentals/vehicle-rental-dialog.tsx"), "utf8");
    assert.match(dialog, /dailyRate: vehicle\?\.dailyRate \?\? prev\.dailyRate/);
    assert.match(dialog, /rentalTotal\(days, form\.dailyRate\)/);
    for (const label of ["Avtomobil", "Mijoz", "Boshlanish sanasi", "Tugash sanasi", "Kunlik narx", "Jami summa", "Izoh"]) {
      assert.ok(dialog.includes(label), label);
    }
  });
});
