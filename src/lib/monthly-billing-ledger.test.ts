import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildContractMonthlyInvoices,
  buildMonthlyBillingLedger,
  summarizeBillingLedger,
} from "./monthly-billing-ledger";
import type { Contract, Payment } from "@/types";

function contract(partial: Partial<Contract> & Pick<Contract, "id">): Contract {
  return {
    id: partial.id,
    propertyId: partial.propertyId ?? "prop-1",
    propertyName: partial.propertyName ?? "103 Room",
    tenantId: partial.tenantId ?? "tenant-1",
    tenantName: partial.tenantName ?? "103 Marketing",
    startDate: partial.startDate ?? "2026-06-01",
    endDate: partial.endDate ?? "2027-06-01",
    monthlyPayment: partial.monthlyPayment ?? 4320,
    deposit: partial.deposit ?? 0,
    status: partial.status ?? "active",
    notes: partial.notes,
    createdAt: partial.createdAt ?? "2026-06-01T00:00:00.000Z",
  };
}

function payment(
  partial: Partial<Payment> & Pick<Payment, "id" | "amount">
): Payment {
  return {
    id: partial.id,
    contractId: partial.contractId ?? "c1",
    tenantName: partial.tenantName ?? "103 Marketing",
    propertyName: partial.propertyName ?? "103 Room",
    amount: partial.amount,
    date: partial.date ?? "2026-08-15T00:00:00.000Z",
    periodYear: partial.periodYear,
    periodMonth: partial.periodMonth,
    method: partial.method ?? "cash",
    createdAt: partial.createdAt ?? "2026-08-15T00:00:00.000Z",
  };
}

describe("monthly billing ledger", () => {
  it("merges partial August payments into one 4320 invoice", () => {
    const c = contract({ id: "c1", monthlyPayment: 4320 });
    const payments = [
      payment({
        id: "p1",
        amount: 3600,
        periodYear: 2026,
        periodMonth: 8,
      }),
      payment({
        id: "p2",
        amount: 720,
        periodYear: 2026,
        periodMonth: 8,
        date: "2026-08-20T00:00:00.000Z",
      }),
    ];
    const now = new Date("2026-09-04T10:00:00+05:00");
    const rows = buildContractMonthlyInvoices(c, payments, undefined, now);
    const aug = rows.find((r) => r.billingYear === 2026 && r.billingMonth === 8);
    assert.ok(aug);
    assert.equal(aug!.invoiceAmount, 4320);
    assert.equal(aug!.paidAmount, 4320);
    assert.equal(aug!.remainingAmount, 0);
    assert.equal(aug!.status, "PAID");
    assert.equal(aug!.id, "c1:2026-08");
  });

  it("shows remaining debt when only partial paid", () => {
    const c = contract({ id: "c1", monthlyPayment: 4320 });
    const payments = [
      payment({
        id: "p1",
        amount: 3600,
        periodYear: 2026,
        periodMonth: 8,
      }),
    ];
    const now = new Date("2026-09-04T10:00:00+05:00");
    const rows = buildContractMonthlyInvoices(c, payments, undefined, now);
    const aug = rows.find((r) => r.billingMonth === 8);
    assert.ok(aug);
    assert.equal(aug!.paidAmount, 3600);
    assert.equal(aug!.remainingAmount, 720);
    assert.equal(aug!.status, "PARTIALLY_PAID");
  });

  it("emits unique invoice ids per contract+month", () => {
    const c = contract({ id: "c1" });
    const now = new Date("2026-09-04T10:00:00+05:00");
    const rows = buildContractMonthlyInvoices(c, [], undefined, now);
    const ids = rows.map((r) => r.id);
    assert.equal(ids.length, new Set(ids).size);
  });

  it("summary counts unique debtors and debt amount", () => {
    const contracts = [
      contract({
        id: "c1",
        tenantId: "t1",
        tenantName: "103 Marketing",
        monthlyPayment: 4320,
      }),
      contract({
        id: "c2",
        tenantId: "t1",
        tenantName: "103 Marketing",
        propertyName: "103 Room B",
        monthlyPayment: 1000,
      }),
    ];
    const now = new Date("2026-09-04T10:00:00+05:00");
    const rows = buildMonthlyBillingLedger(contracts, [], [], now);
    const summary = summarizeBillingLedger(rows);
    assert.ok(summary.uniqueDebtorCount >= 1);
    assert.ok(summary.totalDebtAmount > 0);
  });

  it("does not treat debt as a payment method", () => {
    const c = contract({ id: "c1" });
    const now = new Date("2026-09-04T10:00:00+05:00");
    const rows = buildContractMonthlyInvoices(c, [], undefined, now);
    for (const row of rows) {
      assert.deepEqual(row.paymentMethods, []);
      assert.ok(row.remainingAmount >= 0);
    }
  });
});
