import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeContractDebt,
  getContractDisplayPaymentDueDate,
} from "./debt-calculator";
import {
  formatPaymentDueDisplay,
  getTenantPaymentDueLines,
} from "./tenant-payment-due-display";
import type { Contract, Payment, Tenant } from "@/types";

const tenant: Tenant = {
  id: "t1",
  fullName: "Test",
  phone: "901234567",
  passport: "AA1234567",
  rentAmount: 1_000_000,
  paymentDueDate: "2026-01-15",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const contract: Contract = {
  id: "c1",
  propertyId: "p1",
  tenantId: "t1",
  propertyName: "Xona A",
  tenantName: "Test",
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2027-01-01T00:00:00.000Z",
  monthlyPayment: 1_000_000,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("formatPaymentDueDisplay", () => {
  it("formats YYYY-MM-DD as DD.MM.YYYY", () => {
    assert.equal(formatPaymentDueDisplay("2026-08-15"), "15.08.2026");
  });

  it("returns Belgilanmagan for empty", () => {
    assert.equal(formatPaymentDueDisplay(null), "Belgilanmagan");
    assert.equal(formatPaymentDueDisplay(""), "Belgilanmagan");
  });
});

describe("getContractDisplayPaymentDueDate", () => {
  it("returns oldest unpaid month when debt exists", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    const payments: Payment[] = [];
    const result = getContractDisplayPaymentDueDate(
      contract,
      payments,
      tenant,
      now
    );
    assert.equal(result, "2026-01-15");
  });

  it("returns next scheduled date when no debt", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const payments: Payment[] = [
      {
        id: "pay1",
        contractId: "c1",
        tenantId: "t1",
        amount: 1_000_000,
        date: "2026-08-01",
        periodYear: 2026,
        periodMonth: 8,
        method: "cash",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ];
    const result = getContractDisplayPaymentDueDate(
      contract,
      payments,
      tenant,
      now
    );
    assert.equal(result, "2026-08-15");
  });

  it("returns null for expired contract without debt", () => {
    const expired: Contract = { ...contract, status: "expired", monthlyPayment: 0 };
    const result = getContractDisplayPaymentDueDate(
      expired,
      [],
      tenant,
      new Date("2026-08-28T12:00:00.000Z")
    );
    assert.equal(result, null);
  });
});

describe("computeContractDebt oldestUnpaidDueDate", () => {
  it("tracks first unpaid overdue month", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    const result = computeContractDebt(contract, [], tenant, now);
    assert.ok(result.debt > 0);
    assert.equal(result.oldestUnpaidDueDate, "2026-01-15");
  });
});

describe("getTenantPaymentDueLines", () => {
  it("returns separate lines per contract", () => {
    const contracts: Contract[] = [
      contract,
      {
        ...contract,
        id: "c2",
        propertyName: "Xona B",
      },
    ];
    const now = new Date("2026-08-28T12:00:00.000Z");
    const lines = getTenantPaymentDueLines("t1", contracts, [], tenant, now);
    assert.equal(lines.length, 2);
    assert.equal(lines[0].propertyLabel, "Xona A");
    assert.equal(lines[1].propertyLabel, "Xona B");
    assert.match(lines[0].dueDateLabel, /^\d{2}\.\d{2}\.\d{4}$/);
  });

  it("shows Belgilanmagan when tenant has no contracts", () => {
    const lines = getTenantPaymentDueLines(
      "t1",
      [],
      [],
      tenant,
      new Date("2026-08-28T12:00:00.000Z")
    );
    assert.equal(lines.length, 0);
  });
});
