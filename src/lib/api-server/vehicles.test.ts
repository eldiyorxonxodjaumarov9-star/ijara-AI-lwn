import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";

import {
  getIndustryDashboardConfig,
  resolveIndustryInventory,
  resolveIndustryKpiValue,
} from "@/lib/dashboard-industry";
import { RENTAL_INDUSTRIES } from "@/lib/rental-industry";
import { countVehicleInventory, normalizePlateNumber, parseVehicleInput } from "@/lib/vehicles";

import { getPlanLimits } from "./plans";
import { canAccessResource } from "./rbac";
import {
  assertVehicleIndustry,
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  updateVehicle,
  VehicleError,
} from "./vehicles";

const NOW = new Date("2026-10-06T10:00:00+05:00");
const valid = {
  brand: "Chevrolet",
  model: "Cobalt",
  year: 2023,
  plateNumber: "01 a 123 bc",
  mileage: 1000,
  dailyRate: 350000,
  status: "AVAILABLE",
};

type Row = Record<string, unknown> & { id: string; workspaceId: string; plateNumber: string };

/** In-memory stand-in for prisma.vehicle honoring the where-shapes the service uses. */
function fakeDb() {
  const rows: Row[] = [];
  let seq = 0;
  type Where = { id?: string; workspaceId?: string; plateNumber?: string; NOT?: { id: string } };
  const match = (r: Row, w: Where) =>
    (w.id === undefined || r.id === w.id) &&
    (w.workspaceId === undefined || r.workspaceId === w.workspaceId) &&
    (w.plateNumber === undefined || r.plateNumber === w.plateNumber) &&
    (!w.NOT || r.id !== w.NOT.id);
  const vehicle = {
    findMany: async ({ where }: { where: Where }) => rows.filter((r) => match(r, where)),
    findFirst: async ({ where }: { where: Where }) => rows.find((r) => match(r, where)) ?? null,
    create: async ({ data }: { data: Omit<Row, "id"> }) => {
      if (rows.some((r) => r.workspaceId === data.workspaceId && r.plateNumber === data.plateNumber)) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      const row = { ...data, id: `v${++seq}` } as Row;
      rows.push(row);
      return row;
    },
    updateMany: async ({ where, data }: { where: Where; data: Partial<Row> }) => {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    deleteMany: async ({ where }: { where: Where }) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
  };
  const vehicleRental = { count: async () => 0 };
  return { db: { vehicle, vehicleRental } as unknown as Parameters<typeof listVehicles>[0], rows };
}

const input = (overrides: Record<string, unknown> = {}) => {
  const parsed = parseVehicleInput({ ...valid, ...overrides }, { now: NOW });
  assert.ok(parsed.data, parsed.error);
  return parsed.data;
};

async function rejects(p: Promise<unknown>, status: number, code: string) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof VehicleError);
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });
}

describe("vehicle validation", () => {
  it("accepts a valid vehicle, normalizes plate and defaults name", () => {
    const data = input();
    assert.equal(data.plateNumber, "01 A 123 BC");
    assert.equal(data.name, "Chevrolet Cobalt");
    assert.equal(data.vin, null);
    assert.equal(normalizePlateNumber("  01  a 123   bc "), "01 A 123 BC");
  });

  it("rejects missing brand, model, plate in Uzbek", () => {
    assert.equal(parseVehicleInput({ ...valid, brand: " " }).error, "Markani kiriting");
    assert.equal(parseVehicleInput({ ...valid, model: "" }).error, "Modelni kiriting");
    assert.equal(parseVehicleInput({ ...valid, plateNumber: "" }).error, "Davlat raqamini kiriting");
  });

  it("rejects invalid year, negative mileage, negative rate, bad status", () => {
    for (const year of [1900, 2030, "abc", 2020.5]) {
      assert.match(parseVehicleInput({ ...valid, year }, { now: NOW }).error ?? "", /Yil 1980–2027/);
    }
    assert.equal(parseVehicleInput({ ...valid, mileage: -1 }).error, "Probeg manfiy bo‘lishi mumkin emas");
    assert.equal(parseVehicleInput({ ...valid, dailyRate: -5 }).error, "Kunlik narx manfiy bo‘lishi mumkin emas");
    assert.equal(parseVehicleInput({ ...valid, status: "STOLEN" }).error, "Status noto‘g‘ri");
  });

  it("ignores client workspaceId and id", () => {
    const data = input({ workspaceId: "other", id: "x" }) as Record<string, unknown>;
    assert.equal("workspaceId" in data, false);
    assert.equal("id" in data, false);
  });

  it("partial update validates only present keys", () => {
    assert.deepEqual(parseVehicleInput({ mileage: 5 }, { partial: true }).data, { mileage: 5 });
    assert.equal(parseVehicleInput({ year: 1 }, { partial: true }).error?.startsWith("Yil"), true);
  });
});

describe("vehicle CRUD service", () => {
  it("list, create, update, delete within one workspace", async () => {
    const { db } = fakeDb();
    const created = await createVehicle(db, "A", input());
    assert.equal((await listVehicles(db, "A")).length, 1);
    const updated = await updateVehicle(db, "A", created.id, { status: "MAINTENANCE", mileage: 2000 });
    assert.equal(updated.status, "MAINTENANCE");
    assert.equal(updated.mileage, 2000);
    assert.deepEqual(await deleteVehicle(db, "A", created.id), { id: created.id });
    assert.equal((await listVehicles(db, "A")).length, 0);
  });

  it("RENTED is derived from ACTIVE rentals: manual RENTED without a rental falls back to AVAILABLE", async () => {
    const { db, rows } = fakeDb();
    const created = await createVehicle(db, "A", input({ status: "RENTED" }));
    assert.equal(created.status, "AVAILABLE", "new vehicle never starts RENTED");
    const updated = await updateVehicle(db, "A", created.id, { status: "RENTED" });
    assert.equal(updated.status, "AVAILABLE");
    rows[0].status = "INACTIVE";
    assert.equal((await updateVehicle(db, "A", created.id, { mileage: 5 })).status, "INACTIVE", "manual state kept");
  });

  it("rejects duplicate plate in the same workspace (create and update)", async () => {
    const { db } = fakeDb();
    await createVehicle(db, "A", input());
    await rejects(createVehicle(db, "A", input({ plateNumber: "01 A 123 BC" })), 409, "DUPLICATE_PLATE");
    const second = await createVehicle(db, "A", input({ plateNumber: "01 B 555 CC" }));
    await rejects(updateVehicle(db, "A", second.id, { plateNumber: "01 A 123 BC" }), 409, "DUPLICATE_PLATE");
    assert.equal((await updateVehicle(db, "A", second.id, { plateNumber: "01 B 555 CC" })).plateNumber, "01 B 555 CC");
  });

  it("allows the same plate in a different workspace", async () => {
    const { db } = fakeDb();
    await createVehicle(db, "A", input());
    const b = await createVehicle(db, "B", input());
    assert.equal(b.plateNumber, "01 A 123 BC");
  });

  it("invalid id is a safe 404", async () => {
    const { db } = fakeDb();
    await rejects(getVehicle(db, "A", "nope"), 404, "NOT_FOUND");
    await rejects(updateVehicle(db, "A", "nope", { mileage: 1 }), 404, "NOT_FOUND");
    await rejects(deleteVehicle(db, "A", "nope"), 404, "NOT_FOUND");
  });
});

describe("workspace isolation (critical)", () => {
  it("workspace B cannot list, get, update or delete workspace A's vehicle", async () => {
    const { db, rows } = fakeDb();
    const a = await createVehicle(db, "A", input());
    assert.equal((await listVehicles(db, "B")).length, 0);
    await rejects(getVehicle(db, "B", a.id), 404, "NOT_FOUND");
    await rejects(updateVehicle(db, "B", a.id, { status: "INACTIVE" }), 404, "NOT_FOUND");
    await rejects(deleteVehicle(db, "B", a.id), 404, "NOT_FOUND");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "AVAILABLE");
    assert.equal(rows[0].workspaceId, "A");
  });
});

describe("industry guard and RBAC", () => {
  it("only CAR_RENTAL passes; everything else is 403 INDUSTRY_NOT_SUPPORTED", () => {
    for (const industry of [...RENTAL_INDUSTRIES, "BOGUS"]) {
      const ctx = { workspace: { industry } } as Parameters<typeof assertVehicleIndustry>[0];
      if (industry === "CAR_RENTAL") {
        assert.doesNotThrow(() => assertVehicleIndustry(ctx));
      } else {
        assert.throws(
          () => assertVehicleIndustry(ctx),
          (e: unknown) => e instanceof VehicleError && e.status === 403 && e.code === "INDUSTRY_NOT_SUPPORTED"
        );
      }
    }
  });

  it("vehicles follow the properties RBAC row", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "TENANT"] as const) {
      for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"] as const) {
        assert.equal(
          canAccessResource(role as never, "vehicles", method),
          canAccessResource(role as never, "properties", method),
          `${role} ${method}`
        );
      }
    }
  });

  it("DEMO plan limits vehicles to 3", () => {
    assert.equal(getPlanLimits("FREE").vehicles, 3);
    assert.equal(getPlanLimits("PREMIUM").vehicles, null);
  });

  it("unauthenticated requests get 401 on every vehicle route", async () => {
    process.env.DATABASE_URL ??= "postgresql://unit-test/none";
    const list = await import("@/app/api/vehicles/route");
    const item = await import("@/app/api/vehicles/[id]/route");
    const req = (method: string) =>
      new NextRequest("http://localhost/api/vehicles/x", {
        method,
        headers: { "content-type": "application/json" },
        body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(valid),
      });
    const params = { params: Promise.resolve({ id: "x" }) };
    const responses = [
      await list.GET(req("GET")),
      await list.POST(req("POST")),
      await item.GET(req("GET"), params),
      await item.PATCH(req("PATCH"), params),
      await item.PUT(req("PUT"), params),
      await item.DELETE(req("DELETE"), params),
    ];
    for (const res of responses) assert.equal(res.status, 401);
  });

  it("every route handler goes through the vehicle guard and the plan limit", () => {
    const list = readFileSync(join(process.cwd(), "src/app/api/vehicles/route.ts"), "utf8");
    const item = readFileSync(join(process.cwd(), "src/app/api/vehicles/[id]/route.ts"), "utf8");
    assert.equal(list.match(/requireVehicleWorkspace\(req/g)?.length, 2);
    assert.equal(item.match(/requireVehicleWorkspace\(req/g)?.length, 3);
    assert.match(list, /createWithinPlanLimit\(guard\.ctx, "vehicles"/);
    for (const src of [list, item]) {
      assert.match(src, /guard\.ctx\.workspace\.id/);
      assert.doesNotMatch(src, /body\.workspaceId|searchParams\.get\("workspaceId"\)/);
    }
  });
});

describe("dashboard vehicle KPIs", () => {
  const vehicles = [
    { status: "AVAILABLE" },
    { status: "AVAILABLE" },
    { status: "RENTED" },
    { status: "MAINTENANCE" },
    { status: "INACTIVE" },
  ];
  const properties = Array.from({ length: 9 }, () => ({ status: "rented" }));

  it("CAR_RENTAL KPIs come from vehicles, not properties", () => {
    const config = getIndustryDashboardConfig("CAR_RENTAL");
    assert.equal(config?.useVehicleInventory, true);
    assert.equal(config?.usePropertyInventory, false);
    const inv = resolveIndustryInventory(config, properties, vehicles);
    assert.deepEqual(inv, { total: 5, occupied: 1, vacant: 2, maintenance: 1 });
    const value = (key: Parameters<typeof resolveIndustryKpiValue>[0]) =>
      resolveIndustryKpiValue(key, { inventory: inv, monthlyIncome: 7, debtCount: 0, todayIncome: 0 });
    assert.equal(value("totalUnits"), 5);
    assert.equal(value("occupiedUnits"), 1);
    assert.equal(value("vacantUnits"), 2);
    assert.equal(value("maintenanceUnits"), 1);
    assert.equal(value("todayRentals"), 0);
    assert.equal(value("monthlyIncome"), 7);
    const labels = config!.stats.map((s) => s.label);
    assert.ok(labels.includes("Texnik xizmatdagilar"));
    assert.ok(labels.includes("Oylik tushum"));
  });

  it("empty vehicles stay 0 even with many properties", () => {
    const inv = resolveIndustryInventory(getIndustryDashboardConfig("CAR_RENTAL"), properties, []);
    assert.deepEqual(inv, { total: 0, occupied: 0, vacant: 0, maintenance: 0 });
  });

  it("other industries ignore vehicles", () => {
    const inv = resolveIndustryInventory(getIndustryDashboardConfig("OFFICE_RENTAL"), properties, vehicles);
    assert.deepEqual(inv, { total: 9, occupied: 9, vacant: 0, maintenance: 0 });
    assert.deepEqual(countVehicleInventory([]), { total: 0, available: 0, rented: 0, maintenance: 0 });
  });

  it("dashboard fetches vehicles only for the vehicle-inventory industry", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"), "utf8");
    assert.match(src, /useVehicles\(\s*industryConfig\?\.useVehicleInventory === true\s*\)/);
    assert.match(src, /resolveIndustryInventory\(industryConfig, properties, vehicles[,)]/);
  });
});

describe("vehicles page guard", () => {
  it("renders a safe state for non-CAR_RENTAL workspaces and fetches only for CAR_RENTAL", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(dashboard)/vehicles/page.tsx"), "utf8");
    assert.match(src, /workspace\?\.industry === "CAR_RENTAL"/);
    assert.match(src, /useVehicles\(isCarRental\)/);
    assert.match(src, /Ijara parkidagi avtomobillarni boshqaring/);
  });
});
