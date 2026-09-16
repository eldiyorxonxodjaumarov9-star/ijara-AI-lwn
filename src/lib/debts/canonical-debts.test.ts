import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeDebts,
  selectCanonicalDebts,
  summarizeCanonicalDebts,
} from "./canonical-debts";
import type { Contract, Payment, Tenant } from "@/types";

function contract(
  partial: Partial<Contract> & Pick<Contract, "id">
): Contract {
  return {
    id: partial.id,
    propertyId: partial.propertyId ?? "p1",
    propertyName: partial.propertyName ?? "101 Room",
    tenantId: partial.tenantId ?? "t1",
    tenantName: partial.tenantName ?? "Tenant A",
    startDate: partial.startDate ?? "2026-06-01",
    endDate: partial.endDate ?? "2027-06-01",
    monthlyPayment: partial.monthlyPayment ?? 4320,
    deposit: partial.deposit ?? 0,
    status: partial.status ?? "active",
    createdAt: partial.createdAt ?? "2026-06-01T00:00:00.000Z",
  };
}

function payment(
  partial: Partial<Payment> & Pick<Payment, "id" | "amount">
): Payment {
  return {
    id: partial.id,
    contractId: partial.contractId ?? "c1",
    tenantName: partial.tenantName ?? "Tenant A",
    propertyName: partial.propertyName ?? "101 Room",
    amount: partial.amount,
    date: partial.date ?? "2026-08-15T00:00:00.000Z",
    periodYear: partial.periodYear,
    periodMonth: partial.periodMonth,
    method: partial.method ?? "cash",
    createdAt: partial.createdAt ?? "2026-08-15T00:00:00.000Z",
  };
}

describe("selectCanonicalDebts", () => {
  const now = new Date("2026-09-04T10:00:00+05:00");

  it("includes only active contracts with unpaid overdue debt", () => {
    const contracts = [
      contract({ id: "c1", status: "active", monthlyPayment: 4320 }),
      contract({
        id: "c2",
        status: "expired",
        monthlyPayment: 4320,
        tenantId: "t2",
        tenantName: "Tenant B",
      }),
      contract({
        id: "c3",
        status: "terminated",
        monthlyPayment: 4320,
        tenantId: "t3",
      }),
    ];
    const debts = selectCanonicalDebts(contracts, [], [], now);
    assert.equal(debts.length, 1);
    assert.equal(debts[0]!.contractId, "c1");
    assert.ok(debts[0]!.debt > 0);
  });

  it("excludes fully paid overdue months", () => {
    const contracts = [
      contract({
        id: "c1",
        startDate: "2026-06-01",
        monthlyPayment: 4320,
      }),
    ];
    const juneNow = new Date("2026-06-20T10:00:00+05:00");
    const payments = [
      payment({
        id: "p1",
        amount: 4320,
        periodYear: 2026,
        periodMonth: 6,
        date: "2026-06-18T00:00:00.000Z",
      }),
    ];
    const debts = selectCanonicalDebts(contracts, payments, [], juneNow);
    assert.equal(debts.length, 0);
  });

  it("summarize counts unique tenants and total debt", () => {
    const contracts = [
      contract({ id: "c1", tenantId: "t1", monthlyPayment: 4320 }),
      contract({
        id: "c2",
        tenantId: "t1",
        propertyName: "102 Room",
        monthlyPayment: 1000,
      }),
      contract({
        id: "c3",
        tenantId: "t2",
        tenantName: "Other",
        monthlyPayment: 2000,
      }),
    ];
    const debts = selectCanonicalDebts(contracts, [], [], now);
    const summary = summarizeCanonicalDebts(debts);
    assert.ok(summary.totalDebtAmount > 0);
    assert.equal(summary.debtorContractCount, debts.length);
    assert.equal(summary.uniqueDebtorCount, 2);
  });

  it("computeDebts alias matches selectCanonicalDebts", () => {
    const contracts = [contract({ id: "c1" })];
    assert.deepEqual(
      computeDebts(contracts, [], [] as Tenant[], now).map((d) => d.contractId),
      selectCanonicalDebts(contracts, [], [], now).map((d) => d.contractId)
    );
  });
});
