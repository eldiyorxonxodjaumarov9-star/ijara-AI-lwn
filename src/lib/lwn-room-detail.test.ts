import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getRoomContractTenants,
  resolveLwnRoomById,
} from "./lwn-room-detail";
import { LWN_BUILDING } from "./constants";
import type { Contract, Property, Tenant } from "@/types";

const lwnRoom: Property = {
  id: "room-1",
  name: "306 Room",
  address: "Live Work Network",
  region: "Toshkent shahri",
  district: LWN_BUILDING,
  building: LWN_BUILDING,
  price: 3840,
  status: "rented",
  images: [],
  rooms: 1,
  area: 19,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const otherProperty: Property = {
  ...lwnRoom,
  id: "other-1",
  building: "Other",
  district: "Other",
};

describe("resolveLwnRoomById", () => {
  it("returns LWN room by id", () => {
    assert.deepEqual(
      resolveLwnRoomById("room-1", [lwnRoom, otherProperty]),
      lwnRoom
    );
  });

  it("returns null for non-LWN property", () => {
    assert.equal(resolveLwnRoomById("other-1", [otherProperty]), null);
  });

  it("returns null for unknown id", () => {
    assert.equal(resolveLwnRoomById("missing", [lwnRoom]), null);
  });
});

describe("getRoomContractTenants", () => {
  it("maps active contracts for property", () => {
    const contracts: Contract[] = [
      {
        id: "c1",
        propertyId: "room-1",
        tenantId: "t1",
        tenantName: "Test Arendator",
        startDate: "2026-01-01",
        endDate: "2027-01-01",
        monthlyPayment: 1000,
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const tenants: Tenant[] = [
      {
        id: "t1",
        fullName: "Test Arendator",
        phone: "901234567",
        passport: "AA1234567",
        rentAmount: 1000,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const rows = getRoomContractTenants("room-1", contracts, tenants);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].fullName, "Test Arendator");
  });
});
