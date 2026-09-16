import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getContractStatusBadge,
  getOverdueContracts,
  isContractOverdue,
} from "./contract-overdue";
import type { Contract } from "@/types";

function contract(
  partial: Partial<Contract> & Pick<Contract, "id" | "status" | "endDate">
): Contract {
  return {
    id: partial.id,
    propertyId: partial.propertyId ?? "p1",
    propertyName: partial.propertyName ?? "101",
    tenantId: partial.tenantId ?? "t1",
    tenantName: partial.tenantName ?? "Tenant",
    startDate: partial.startDate ?? "2026-01-01",
    endDate: partial.endDate,
    monthlyPayment: partial.monthlyPayment ?? 1000,
    deposit: partial.deposit ?? 0,
    status: partial.status,
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("isContractOverdue", () => {
  const now = new Date("2026-08-15T12:00:00+05:00");

  it("active with past endDate is overdue", () => {
    assert.equal(
      isContractOverdue(
        contract({
          id: "1",
          status: "active",
          endDate: "2026-07-31",
        }),
        now
      ),
      true
    );
  });

  it("active with future endDate is not overdue", () => {
    assert.equal(
      isContractOverdue(
        contract({
          id: "2",
          status: "active",
          endDate: "2027-01-01",
        }),
        now
      ),
      false
    );
  });

  it("endDate today is not overdue", () => {
    assert.equal(
      isContractOverdue(
        contract({
          id: "3",
          status: "active",
          endDate: "2026-08-15",
        }),
        now
      ),
      false
    );
  });

  it("expired with future endDate is not overdue", () => {
    assert.equal(
      isContractOverdue(
        contract({
          id: "4",
          status: "expired",
          endDate: "2027-06-01",
        }),
        now
      ),
      false
    );
  });

  it("expired with past endDate is overdue", () => {
    assert.equal(
      isContractOverdue(
        contract({
          id: "5",
          status: "expired",
          endDate: "2026-06-01",
        }),
        now
      ),
      true
    );
  });

  it("terminated and pending are never overdue", () => {
    assert.equal(
      isContractOverdue(
        contract({
          id: "6",
          status: "terminated",
          endDate: "2020-01-01",
        }),
        now
      ),
      false
    );
    assert.equal(
      isContractOverdue(
        contract({
          id: "7",
          status: "pending",
          endDate: "2020-01-01",
        }),
        now
      ),
      false
    );
  });
});

describe("getContractStatusBadge", () => {
  const now = new Date("2026-08-15T12:00:00+05:00");

  it("does not show Muddati o'tgan for expired status with future endDate", () => {
    const badge = getContractStatusBadge(
      contract({
        id: "1",
        status: "expired",
        endDate: "2027-01-01",
      }),
      now
    );
    assert.equal(badge.label, "Faol");
    assert.equal(badge.variant, "success");
  });

  it("shows Muddati o'tgan for active past endDate", () => {
    const badge = getContractStatusBadge(
      contract({
        id: "2",
        status: "active",
        endDate: "2026-07-01",
      }),
      now
    );
    assert.equal(badge.label, "Muddati o'tgan");
  });
});

describe("getOverdueContracts", () => {
  it("filters only endDate-past active/expired contracts", () => {
    const now = new Date("2026-08-15T12:00:00+05:00");
    const list = getOverdueContracts(
      [
        contract({ id: "a", status: "active", endDate: "2026-07-01" }),
        contract({ id: "b", status: "active", endDate: "2027-01-01" }),
        contract({ id: "c", status: "expired", endDate: "2027-01-01" }),
        contract({ id: "d", status: "terminated", endDate: "2020-01-01" }),
      ],
      now
    );
    assert.deepEqual(
      list.map((c) => c.id),
      ["a"]
    );
  });
});
