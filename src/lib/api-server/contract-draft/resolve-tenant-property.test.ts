/**
 * Tenant → room resolve for contract form auto-fill.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTenantAssignedProperty } from "./resolve-tenant-property";

const prop = (
  id: string,
  title: string,
  address = "Chilonzor",
  area: number | null = 20
) => ({ id, title, address, area });

describe("resolveTenantAssignedProperty", () => {
  it("A) single room → auto-select", () => {
    const r = resolveTenantAssignedProperty([
      {
        status: "EXPIRED",
        updatedAt: "2026-01-01",
        property: prop("p1", "305 Room"),
      },
    ]);
    assert.equal(r.autoSelected, true);
    assert.equal(r.propertyId, "p1");
    assert.equal(r.propertyTitle, "305 Room");
    assert.equal(r.assignedProperties.length, 1);
  });

  it("B) no contracts → empty / Tanlang", () => {
    const r = resolveTenantAssignedProperty([]);
    assert.equal(r.autoSelected, false);
    assert.equal(r.propertyId, null);
    assert.equal(r.assignedProperties.length, 0);
  });

  it("C) tenant change uses latest / current room", () => {
    const older = resolveTenantAssignedProperty([
      {
        status: "EXPIRED",
        updatedAt: "2025-01-01",
        property: prop("old", "101 Room"),
      },
    ]);
    assert.equal(older.propertyId, "old");

    const newer = resolveTenantAssignedProperty([
      {
        status: "EXPIRED",
        updatedAt: "2026-06-01",
        property: prop("new", "305 Room"),
      },
    ]);
    assert.equal(newer.propertyId, "new");
    assert.equal(newer.propertyTitle, "305 Room");
  });

  it("D) multiple ACTIVE rooms → no arbitrary auto-select", () => {
    const r = resolveTenantAssignedProperty([
      {
        status: "ACTIVE",
        updatedAt: "2026-02-01",
        property: prop("a", "301 Room"),
      },
      {
        status: "ACTIVE",
        updatedAt: "2026-03-01",
        property: prop("b", "305 Room"),
      },
    ]);
    assert.equal(r.autoSelected, false);
    assert.equal(r.propertyId, null);
    assert.equal(r.assignedProperties.length, 2);
    assert.deepEqual(
      r.assignedProperties.map((p) => p.id).sort(),
      ["a", "b"]
    );
  });

  it("D2) multiple ACTIVE pointing at same room → auto-select", () => {
    const r = resolveTenantAssignedProperty([
      {
        status: "ACTIVE",
        updatedAt: "2026-02-01",
        property: prop("p1", "305 Room"),
      },
      {
        status: "PENDING",
        updatedAt: "2026-03-01",
        property: prop("p1", "305 Room"),
      },
    ]);
    assert.equal(r.autoSelected, true);
    assert.equal(r.propertyId, "p1");
  });

  it("latest historical wins when no active lease", () => {
    const r = resolveTenantAssignedProperty([
      {
        status: "EXPIRED",
        updatedAt: "2025-01-01",
        property: prop("old", "101 Room"),
      },
      {
        status: "TERMINATED",
        updatedAt: "2026-04-01",
        property: prop("new", "305 Room"),
      },
    ]);
    assert.equal(r.autoSelected, true);
    assert.equal(r.propertyId, "new");
    assert.equal(r.propertyTitle, "305 Room");
  });

  it("ACTIVE preferred over newer EXPIRED", () => {
    const r = resolveTenantAssignedProperty([
      {
        status: "EXPIRED",
        updatedAt: "2026-09-01",
        property: prop("expired", "999 Room"),
      },
      {
        status: "ACTIVE",
        updatedAt: "2026-01-01",
        property: prop("active", "305 Room"),
      },
    ]);
    assert.equal(r.autoSelected, true);
    assert.equal(r.propertyId, "active");
    assert.equal(r.propertyTitle, "305 Room");
  });
});
