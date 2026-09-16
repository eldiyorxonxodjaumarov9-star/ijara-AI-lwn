import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeDashboardOccupancyRate,
  countDashboardOccupancy,
  occupancyRate,
} from "./occupancy";
import type { Property } from "@/types";

function property(partial: Partial<Property> & Pick<Property, "id">): Property {
  return {
    id: partial.id,
    name: partial.name ?? "Room",
    price: partial.price ?? 1000,
    area: partial.area ?? 20,
    status: partial.status ?? "available",
    building: partial.building ?? "LWN",
    address: partial.address ?? "Addr",
    region: partial.region ?? "Toshkent",
    district: partial.district ?? "LWN",
    rooms: partial.rooms ?? 1,
    images: partial.images ?? [],
    description: partial.description,
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("occupancyRate", () => {
  it("returns 0 when totalRooms is 0", () => {
    assert.equal(occupancyRate({ totalRooms: 0, occupiedRooms: 0 }), 0);
    assert.equal(occupancyRate({ totalRooms: 0, occupiedRooms: 5 }), 0);
  });

  it("returns 0 when all vacant", () => {
    assert.equal(occupancyRate({ totalRooms: 10, occupiedRooms: 0 }), 0);
  });

  it("returns partial occupancy rounded", () => {
    assert.equal(occupancyRate({ totalRooms: 4, occupiedRooms: 1 }), 25);
    assert.equal(occupancyRate({ totalRooms: 3, occupiedRooms: 2 }), 67);
  });

  it("returns 100 when full", () => {
    assert.equal(occupancyRate({ totalRooms: 5, occupiedRooms: 5 }), 100);
  });

  it("matches QA example 22/24 ≈ 92%", () => {
    assert.equal(occupancyRate({ totalRooms: 24, occupiedRooms: 22 }), 92);
  });
});

describe("countDashboardOccupancy", () => {
  it("uses property status as SoT (not contract count)", () => {
    const properties = [
      property({ id: "p1", status: "rented" }),
      property({ id: "p2", status: "rented" }),
      property({ id: "p3", status: "available" }),
      property({ id: "p4", status: "available" }),
    ];
    const inputs = countDashboardOccupancy(properties, [], []);
    assert.equal(inputs.totalRooms, 4);
    assert.equal(inputs.occupiedRooms, 2);
    assert.equal(computeDashboardOccupancyRate(properties), 50);
  });

  it("all vacant", () => {
    const properties = [
      property({ id: "p1", status: "available" }),
      property({ id: "p2", status: "available" }),
    ];
    assert.equal(computeDashboardOccupancyRate(properties), 0);
  });

  it("all occupied", () => {
    const properties = [
      property({ id: "p1", status: "rented" }),
      property({ id: "p2", status: "rented" }),
    ];
    assert.equal(computeDashboardOccupancyRate(properties), 100);
  });

  it("zero properties", () => {
    assert.equal(computeDashboardOccupancyRate([]), 0);
  });
});
