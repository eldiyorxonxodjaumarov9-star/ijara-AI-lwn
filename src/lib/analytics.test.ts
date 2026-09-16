import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPaymentReportRows, buildRevenueSeries } from "./analytics";
import type { Payment } from "@/types";

function payment(
  partial: Partial<Payment> & Pick<Payment, "id" | "amount">
): Payment {
  return {
    id: partial.id,
    contractId: partial.contractId ?? "c1",
    tenantName: partial.tenantName ?? "Tenant",
    propertyName: partial.propertyName ?? "101",
    amount: partial.amount,
    date: partial.date ?? "2026-09-10T00:00:00.000Z",
    periodYear: partial.periodYear,
    periodMonth: partial.periodMonth,
    method: partial.method ?? "cash",
    createdAt: partial.createdAt ?? "2026-09-10T00:00:00.000Z",
  };
}

describe("buildPaymentReportRows (periodMonth / rental performance)", () => {
  it("August obligation paid in September stays in August report", () => {
    const payments = [
      payment({
        id: "p1",
        amount: 4320,
        date: "2026-09-05T00:00:00.000Z",
        periodYear: 2026,
        periodMonth: 8,
      }),
    ];

    const augustRows = buildPaymentReportRows({
      payments,
      year: 2026,
      month: 7,
    });
    assert.equal(augustRows.length, 1);
    assert.equal(augustRows[0]!.amount, 4320);

    const septemberRows = buildPaymentReportRows({
      payments,
      year: 2026,
      month: 8,
    });
    assert.equal(septemberRows.length, 0);
  });
});

describe("buildRevenueSeries (payment.date / cash flow)", () => {
  it("groups by payment date month, not periodMonth", () => {
    const payments = [
      payment({
        id: "p1",
        amount: 4320,
        date: "2026-09-05T00:00:00.000Z",
        periodYear: 2026,
        periodMonth: 8,
      }),
    ];

    const augustCash = buildRevenueSeries({
      payments,
      expenses: [],
      year: 2026,
      month: 7,
    });
    assert.equal(augustCash[0]!.daromad, 0);

    const septemberCash = buildRevenueSeries({
      payments,
      expenses: [],
      year: 2026,
      month: 8,
    });
    assert.equal(septemberCash[0]!.daromad, 4320);
  });
});
