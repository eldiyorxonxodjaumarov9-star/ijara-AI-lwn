import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getIndustryTerminology } from "@/lib/industry-terminology";
import { RENTAL_INDUSTRIES } from "@/lib/rental-industry";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("industry terminology", () => {
  it("OFFICE_RENTAL", () => {
    const t = getIndustryTerminology("OFFICE_RENTAL");
    assert.equal(t.addUnitLabel, "Xona qo'shish");
    assert.equal(t.addCustomerLabel, "Ijarachi qo'shish");
    assert.equal(t.contractsLabel, "Shartnomalar");
    assert.equal(t.vacantUnitsLabel, "Bo'sh xonalar");
    assert.equal(t.occupancyLabel, "Bandlik");
  });

  it("APARTMENT_RENTAL", () => {
    const t = getIndustryTerminology("APARTMENT_RENTAL");
    assert.equal(t.addUnitLabel, "Obyekt qo'shish");
    assert.equal(t.addCustomerLabel, "Ijarachi qo'shish");
    assert.equal(t.vacantUnitsLabel, "Bo'sh obyektlar");
  });

  it("HOTEL_HOSTEL uses guests and never shows Ijarachi or bookings", () => {
    const t = getIndustryTerminology("HOTEL_HOSTEL");
    assert.equal(t.addUnitLabel, "Xona qo'shish");
    assert.equal(t.addCustomerLabel, "Mehmon qo'shish");
    assert.equal(t.customerPlural, "Mehmonlar");
    const all = Object.values(t).join(" ");
    assert.equal(/Ijarachi/.test(all), false);
    assert.equal(/Shartnoma/.test(t.contractsLabel), false);
    assert.equal(/[Bb]ron/.test(all), false);
  });

  it("CAR_RENTAL: customers and Ijaralar, no vehicle wording", () => {
    const t = getIndustryTerminology("CAR_RENTAL");
    assert.equal(t.customerPlural, "Mijozlar");
    assert.equal(t.addCustomerLabel, "Mijoz qo'shish");
    assert.equal(t.contractsLabel, "Ijaralar");
    const all = Object.values(t).join(" ");
    assert.equal(/[Aa]vtomobil/.test(all), false);
    assert.equal(t.addUnitLabel, getIndustryTerminology("OTHER").addUnitLabel);
  });

  it("RETAIL, WAREHOUSE, COMMERCIAL", () => {
    assert.equal(getIndustryTerminology("RETAIL_RENTAL").addUnitLabel, "Savdo joyi qo'shish");
    assert.equal(getIndustryTerminology("WAREHOUSE_RENTAL").addUnitLabel, "Ombor qo'shish");
    assert.equal(getIndustryTerminology("COMMERCIAL_RENTAL").addUnitLabel, "Obyekt qo'shish");
    for (const i of ["RETAIL_RENTAL", "WAREHOUSE_RENTAL", "COMMERCIAL_RENTAL"]) {
      assert.equal(getIndustryTerminology(i).contractsLabel, "Shartnomalar");
    }
  });

  it("VILLA_RENTAL: Mijoz and no booking wording", () => {
    const t = getIndustryTerminology("VILLA_RENTAL");
    assert.equal(t.addCustomerLabel, "Mijoz qo'shish");
    assert.equal(t.addUnitLabel, "Dacha / Villa qo'shish");
    assert.equal(/[Bb]ron/.test(Object.values(t).join(" ")), false);
  });

  it("OTHER and invalid keep the exact generic wording", () => {
    const generic = getIndustryTerminology("OTHER");
    assert.equal(generic.unitsPageTitle, "LWN xonalar");
    assert.equal(generic.customerPlural, "Arendatorlar");
    assert.equal(generic.addCustomerLabel, "Arendator qo'shish");
    assert.equal(generic.contractsLabel, "Shartnomalar");
    for (const v of [undefined, null, "", "NOPE"]) {
      assert.deepEqual(getIndustryTerminology(v), generic);
    }
  });

  it("every industry fills every key", () => {
    const keys = Object.keys(getIndustryTerminology("OTHER"));
    for (const i of RENTAL_INDUSTRIES) {
      const t = getIndustryTerminology(i);
      for (const k of keys) {
        assert.ok(String(t[k as keyof typeof t]).trim(), `${i}.${k}`);
      }
    }
  });
});

describe("pages use terminology without touching CRUD", () => {
  const pages = {
    rooms: read("src/app/(dashboard)/lwn-rooms/page.tsx"),
    tenants: read("src/app/(dashboard)/tenants/page.tsx"),
    contracts: read("src/app/(dashboard)/contracts/page.tsx"),
  };

  it("headings and add buttons come from terminology", () => {
    assert.match(pages.rooms, /title=\{terms\.unitsPageTitle\}/);
    assert.match(pages.rooms, /\{terms\.addUnitLabel\}/);
    assert.match(pages.tenants, /title=\{terms\.customerPlural\}/);
    assert.match(pages.tenants, /\{terms\.addCustomerLabel\}/);
    assert.match(pages.contracts, /title=\{terms\.contractsLabel\}/);
    assert.equal(/title="Arendatorlar"/.test(pages.tenants), false);
  });

  it("collections and API names are unchanged", () => {
    assert.match(pages.rooms, /useCollection<Property>\("properties"\)/);
    assert.match(pages.tenants, /useCollection<Tenant>\("tenants"\)/);
    assert.match(pages.contracts, /useCollection<Contract>\("contracts"\)/);
  });

  it("no fake vehicle or booking action anywhere", () => {
    for (const src of Object.values(pages)) {
      assert.equal(/Avtomobil qo/.test(src), false);
      assert.equal(/Bron qo/.test(src), false);
    }
  });

  it("smart lock column still gated on rooms page", () => {
    assert.match(pages.rooms, /hasFeature\("smartLocks"\)/);
  });
});
