import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  countPropertyInventory,
  getIndustryDashboardConfig,
  resolveDashboardIndustry,
  resolveIndustryKpiValue,
  selectUpcomingContracts,
  sumPaymentsOnTashkentDay,
} from "@/lib/dashboard-industry";

const properties = [
  { status: "rented" },
  { status: "available" },
  { status: "reserved" },
];

describe("industry dashboard config", () => {
  it("OFFICE_RENTAL title", () => {
    const config = getIndustryDashboardConfig("OFFICE_RENTAL");
    assert.equal(config?.title, "Ofis ijarasi boshqaruvi");
    assert.equal(config?.usePropertyInventory, true);
  });

  it("HOTEL_HOSTEL title and no guest count from tenants", () => {
    const config = getIndustryDashboardConfig("HOTEL_HOSTEL");
    assert.equal(config?.title, "Mehmonxona boshqaruvi");
    const guests = resolveIndustryKpiValue("todayGuests", {
      inventory: countPropertyInventory(properties, true),
      monthlyIncome: 1000,
      debtCount: 2,
      todayIncome: 50,
    });
    assert.equal(guests, 0);
  });

  it("CAR_RENTAL title and does not treat properties as cars", () => {
    const config = getIndustryDashboardConfig("CAR_RENTAL");
    assert.equal(config?.title, "Avtomobil ijarasi boshqaruvi");
    const inventory = countPropertyInventory(properties, config?.usePropertyInventory ?? true);
    assert.deepEqual(inventory, { total: 0, occupied: 0, vacant: 0 });
    assert.equal(
      resolveIndustryKpiValue("todayRentals", {
        inventory,
        monthlyIncome: 500,
        debtCount: 0,
        todayIncome: 0,
      }),
      0
    );
    assert.equal(
      resolveIndustryKpiValue("monthlyIncome", {
        inventory,
        monthlyIncome: 500,
        debtCount: 0,
        todayIncome: 0,
      }),
      500
    );
  });

  it("OTHER and invalid industry use the generic dashboard", () => {
    assert.equal(getIndustryDashboardConfig("OTHER"), null);
    assert.equal(getIndustryDashboardConfig(undefined), null);
    assert.equal(getIndustryDashboardConfig("NOT_REAL"), null);
    assert.equal(getIndustryDashboardConfig(null), null);
    assert.equal(resolveDashboardIndustry("OTHER"), "OTHER");
    assert.equal(resolveDashboardIndustry("nope"), "OTHER");
  });

  it("property industries count rented and reserved as occupied", () => {
    assert.deepEqual(countPropertyInventory(properties, true), {
      total: 3,
      occupied: 2,
      vacant: 1,
    });
  });

  it("villa bookings stay zero", () => {
    assert.equal(getIndustryDashboardConfig("VILLA_RENTAL")?.title, "Dacha va villalar boshqaruvi");
    assert.equal(
      resolveIndustryKpiValue("todayBookings", {
        inventory: { total: 4, occupied: 1, vacant: 3 },
        monthlyIncome: 0,
        debtCount: 0,
        todayIncome: 0,
      }),
      0
    );
  });
});

describe("industry dashboard dates", () => {
  it("sums only payments on the same Tashkent day", () => {
    const now = new Date("2026-10-05T12:00:00+05:00");
    const total = sumPaymentsOnTashkentDay(
      [
        { date: "2026-10-05T01:00:00+05:00", amount: 10 },
        { date: "2026-10-04T23:00:00+05:00", amount: 99 },
      ],
      now
    );
    assert.equal(total, 10);
  });

  it("selects active contracts ending within 30 days", () => {
    const now = new Date("2026-10-05T12:00:00+05:00");
    const rows = selectUpcomingContracts(
      [
        { status: "active", endDate: "2026-10-20T00:00:00+05:00", id: "soon" },
        { status: "active", endDate: "2026-12-01T00:00:00+05:00", id: "later" },
        { status: "terminated", endDate: "2026-10-10T00:00:00+05:00", id: "closed" },
      ],
      now
    );
    assert.deepEqual(rows.map((row) => row.id), ["soon"]);
  });
});

describe("dashboard wiring", () => {
  it("reads industry from the existing workspace context", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"),
      "utf8"
    );
    assert.match(src, /workspace\?\.industry/);
    assert.match(src, /getIndustryDashboardConfig/);
    assert.equal(/\/workspace\/me/.test(src), false);
    assert.match(src, /t\("dashboard\.greeting"\)/);
  });

  it("workspace view falls back to OTHER", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/api-server/workspace.ts"),
      "utf8"
    );
    assert.match(src, /industry: isRentalIndustry/);
    assert.match(src, /: "OTHER"/);
  });
});
