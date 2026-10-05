import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getIndustryNavigation,
  getIndustryNavigationConfig,
  BOOKINGS_HREF,
  INTEGRATIONS_HREF,
  VEHICLES_HREF,
} from "@/config/industry-navigation";
import { navigation, type NavItem } from "@/config/navigation";
import { RENTAL_INDUSTRIES } from "@/lib/rental-industry";

const root = process.cwd();

function items(industry: unknown): NavItem[] {
  return getIndustryNavigation(industry).flatMap((s) => s.items);
}

function byLabel(industry: unknown, label: string): NavItem | undefined {
  return items(industry).find((i) => i.label === label);
}

function routeExists(href: string): boolean {
  const path = href.split("?")[0].replace(/^\//, "");
  return existsSync(join(root, "src/app/(dashboard)", path, "page.tsx"));
}

describe("industry navigation labels", () => {
  it("OFFICE_RENTAL", () => {
    assert.equal(byLabel("OFFICE_RENTAL", "Xonalar")?.href, "/lwn-rooms");
    assert.equal(byLabel("OFFICE_RENTAL", "Ijarachilar")?.href, "/tenants");
    assert.ok(items("OFFICE_RENTAL").some((i) => i.href === "/contracts"));
  });

  it("APARTMENT_RENTAL", () => {
    assert.equal(byLabel("APARTMENT_RENTAL", "Obyektlar")?.href, "/lwn-rooms");
    assert.equal(byLabel("APARTMENT_RENTAL", "Ijarachilar")?.href, "/tenants");
  });

  it("HOTEL_HOSTEL: Bronlar links to the real bookings route", () => {
    assert.equal(byLabel("HOTEL_HOSTEL", "Xonalar")?.href, "/lwn-rooms");
    assert.equal(byLabel("HOTEL_HOSTEL", "Mehmonlar")?.href, "/tenants");
    const bookings = byLabel("HOTEL_HOSTEL", "Bronlar");
    assert.equal(bookings?.comingSoon, undefined);
    assert.equal(bookings?.href, BOOKINGS_HREF);
    assert.equal(BOOKINGS_HREF, "/bookings");
    assert.ok(routeExists(bookings!.href));
  });

  it("CAR_RENTAL: Avtomobillar links to the real vehicles route, Ijaralar uses existing route", () => {
    const cars = byLabel("CAR_RENTAL", "Avtomobillar");
    assert.equal(cars?.comingSoon, undefined);
    assert.equal(cars?.href, VEHICLES_HREF);
    assert.equal(VEHICLES_HREF, "/vehicles");
    assert.ok(routeExists(cars!.href));
    assert.equal(byLabel("CAR_RENTAL", "Mijozlar")?.href, "/tenants");
    const rentals = byLabel("CAR_RENTAL", "Ijaralar");
    assert.equal(rentals?.href, "/contracts");
    assert.ok(routeExists(rentals!.href));
    assert.equal(items("CAR_RENTAL").some((i) => i.href === "/lwn-rooms"), false);
  });

  it("vehicles item appears only for CAR_RENTAL", () => {
    for (const industry of [...RENTAL_INDUSTRIES, undefined, "BOGUS"]) {
      const hasVehicles = items(industry).some(
        (i) => i.href === VEHICLES_HREF || i.label === "Avtomobillar"
      );
      assert.equal(hasVehicles, industry === "CAR_RENTAL", String(industry));
    }
  });

  it("WAREHOUSE_RENTAL and VILLA_RENTAL", () => {
    assert.equal(byLabel("WAREHOUSE_RENTAL", "Omborlar")?.href, "/lwn-rooms");
    assert.equal(byLabel("VILLA_RENTAL", "Dacha / Villalar")?.href, "/lwn-rooms");
    const villaBookings = byLabel("VILLA_RENTAL", "Bronlar");
    assert.equal(villaBookings?.comingSoon, undefined);
    assert.equal(villaBookings?.href, BOOKINGS_HREF);
  });

  it("Bronlar only for HOTEL_HOSTEL and VILLA_RENTAL", () => {
    for (const industry of [...RENTAL_INDUSTRIES, null]) {
      const has = items(industry).some((i) => i.href === BOOKINGS_HREF);
      assert.equal(has, industry === "HOTEL_HOSTEL" || industry === "VILLA_RENTAL", String(industry));
    }
  });

  it("RETAIL and COMMERCIAL", () => {
    assert.equal(byLabel("RETAIL_RENTAL", "Savdo joylari")?.href, "/lwn-rooms");
    assert.equal(byLabel("COMMERCIAL_RENTAL", "Obyektlar")?.href, "/lwn-rooms");
  });
});

describe("fallback", () => {
  it("OTHER returns the exact generic navigation", () => {
    assert.equal(getIndustryNavigation("OTHER"), navigation);
    assert.equal(getIndustryNavigationConfig("OTHER"), null);
  });

  it("invalid or missing industry falls back to generic", () => {
    for (const v of [undefined, null, "", "NOPE", 42]) {
      assert.equal(getIndustryNavigation(v), navigation);
    }
  });
});

describe("no broken links", () => {
  it("every linkable item points to an existing page", () => {
    for (const industry of RENTAL_INDUSTRIES) {
      for (const item of items(industry)) {
        if (item.comingSoon) {
          assert.equal(item.href, "", `${industry} ${item.label}`);
          continue;
        }
        assert.ok(routeExists(item.href), `${industry} ${item.href}`);
      }
    }
  });

  it("integrations link targets the existing settings tab", () => {
    assert.equal(byLabel("OFFICE_RENTAL", "Integratsiyalar")?.href, INTEGRATIONS_HREF);
    const settings = readFileSync(
      join(root, "src/app/(dashboard)/settings/page.tsx"),
      "utf8"
    );
    assert.match(settings, /TabsContent value="integrations"/);
  });
});

describe("plan gating is untouched", () => {
  it("feature and roles survive for every industry", () => {
    const baseGated = navigation
      .flatMap((s) => s.items)
      .filter((i) => i.feature || i.roles);
    for (const industry of RENTAL_INDUSTRIES) {
      const out = items(industry);
      for (const base of baseGated) {
        const found = out.find((i) => i.href === base.href);
        if (!found) continue;
        assert.equal(found.feature, base.feature, `${industry} ${base.href}`);
        assert.deepEqual(found.roles, base.roles, `${industry} ${base.href}`);
      }
      const ai = out.find((i) => i.href === "/ai-employees");
      assert.equal(ai?.feature, "aiEmployees", industry);
    }
  });

  it("sidebar still filters by hasFeature and roles", () => {
    const src = readFileSync(join(root, "src/components/layout/sidebar.tsx"), "utf8");
    assert.match(src, /item\.feature && !hasFeature\(item\.feature\)/);
    assert.match(src, /item\.roles/);
    assert.match(src, /getIndustryNavigation\(workspace\?\.industry\)/);
  });
});

describe("mobile uses the same config", () => {
  it("header renders SidebarContent", () => {
    const src = readFileSync(join(root, "src/components/layout/header.tsx"), "utf8");
    assert.match(src, /<SidebarContent/);
    assert.equal(/getIndustryNavigation|navigation\.map/.test(src), false);
  });
});