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

const at = (iso: string) => new Date(`${iso}T10:00:00+05:00`);

/** Avgust: 1 000 000 kutilgan, 400 000 to'langan; Sentabr: to'lanmagan. */
function augustSeptemberScenario() {
  const contracts = [
    contract({
      id: "c1",
      startDate: "2026-08-05",
      endDate: "2027-08-05",
      monthlyPayment: 1_000_000,
    }),
  ];
  const payments = [
    payment({
      id: "p-aug",
      amount: 400_000,
      periodYear: 2026,
      periodMonth: 8,
      date: "2026-08-06T00:00:00.000Z",
    }),
  ];
  return { contracts, payments };
}

describe("selectCanonicalDebts — carry-forward", () => {
  it("1. current month debt appears once the due date arrives", () => {
    const contracts = [
      contract({ id: "c1", startDate: "2026-09-05", monthlyPayment: 1_000_000 }),
    ];
    assert.equal(selectCanonicalDebts(contracts, [], [], at("2026-09-04")).length, 0);
    const debts = selectCanonicalDebts(contracts, [], [], at("2026-09-10"));
    assert.equal(debts.length, 1);
    assert.equal(debts[0]!.debt, 1_000_000);
    assert.equal(debts[0]!.unpaidMonths, 1);
  });

  it("2. previous month unpaid debt still appears in the next month", () => {
    const contracts = [
      contract({ id: "c1", startDate: "2026-08-05", monthlyPayment: 1_000_000 }),
    ];
    const payments = [
      payment({ id: "p-sep", amount: 1_000_000, periodYear: 2026, periodMonth: 9 }),
    ];
    const debts = selectCanonicalDebts(contracts, payments, [], at("2026-09-10"));
    assert.equal(debts.length, 1);
    assert.equal(debts[0]!.debt, 1_000_000);
    assert.equal(debts[0]!.oldestUnpaidDueDate, "2026-08-05");
    assert.deepEqual(
      debts[0]!.unpaidPeriods.map((p) => [p.month, p.remaining]),
      [[8, 1_000_000]]
    );
  });

  it("2b. first contract month is not dropped on days before the start day", () => {
    const contracts = [
      contract({ id: "c1", startDate: "2026-08-20", monthlyPayment: 1_000_000 }),
    ];
    const debts = selectCanonicalDebts(contracts, [], [], at("2026-10-06"));
    assert.equal(debts.length, 1);
    assert.equal(debts[0]!.unpaidMonths, 2);
    assert.equal(debts[0]!.debt, 2_000_000);
    assert.equal(debts[0]!.oldestUnpaidDueDate, "2026-08-20");
  });

  it("3. two unpaid months aggregate (600 000 + 1 000 000 = 1 600 000)", () => {
    const { contracts, payments } = augustSeptemberScenario();
    const [row] = selectCanonicalDebts(contracts, payments, [], at("2026-09-10"));
    assert.ok(row);
    assert.equal(row.debt, 1_600_000);
    assert.equal(row.unpaidMonths, 2);
    assert.equal(row.expected, 2_000_000);
    assert.equal(row.paid, 400_000);
    assert.deepEqual(
      row.unpaidPeriods.map((p) => [p.month, p.paid, p.remaining]),
      [
        [8, 400_000, 600_000],
        [9, 0, 1_000_000],
      ]
    );
  });

  it("4. partial payment reduces total debt (1 600 000 − 500 000 = 1 100 000)", () => {
    const { contracts, payments } = augustSeptemberScenario();
    payments.push(
      payment({ id: "p-part", amount: 500_000, date: "2026-09-12T06:00:00.000Z" })
    );
    const [row] = selectCanonicalDebts(contracts, payments, [], at("2026-09-12"));
    assert.equal(row!.debt, 1_100_000);
  });

  it("5. full payment of the previous month removes that period", () => {
    const { contracts, payments } = augustSeptemberScenario();
    payments.push(
      payment({ id: "p-aug2", amount: 600_000, periodYear: 2026, periodMonth: 8 })
    );
    const [row] = selectCanonicalDebts(contracts, payments, [], at("2026-09-10"));
    assert.equal(row!.debt, 1_000_000);
    assert.equal(row!.unpaidMonths, 1);
    assert.equal(row!.oldestUnpaidDueDate, "2026-09-05");

    payments.push(
      payment({ id: "p-sep", amount: 1_000_000, periodYear: 2026, periodMonth: 9 })
    );
    assert.equal(selectCanonicalDebts(contracts, payments, [], at("2026-09-10")).length, 0);
  });

  it("6. ended contract with remaining debt stays listed (expired + terminated)", () => {
    const contracts = [
      contract({
        id: "c1",
        status: "expired",
        startDate: "2026-06-01",
        endDate: "2026-09-01",
        monthlyPayment: 1_000_000,
      }),
      contract({
        id: "c2",
        tenantId: "t2",
        tenantName: "Tenant B",
        status: "terminated",
        startDate: "2026-07-10",
        endDate: "2026-09-15",
        monthlyPayment: 500_000,
      }),
    ];
    const payments = [
      payment({ id: "p1", contractId: "c1", amount: 1_000_000, periodYear: 2026, periodMonth: 6 }),
      payment({ id: "p2", contractId: "c1", amount: 1_000_000, periodYear: 2026, periodMonth: 7 }),
    ];
    const debts = selectCanonicalDebts(contracts, payments, [], at("2026-10-06"));
    const c1 = debts.find((d) => d.contractId === "c1");
    const c2 = debts.find((d) => d.contractId === "c2");
    // Avgust to'lanmagan; 1-sentabr = tugash sanasi → yangi oy boshlanmaydi.
    assert.equal(c1?.debt, 1_000_000);
    assert.equal(c1?.contractStatus, "expired");
    // Iyul + Avgust + Sentabr(10-sentabr < 15-sentabr tugash).
    assert.equal(c2?.debt, 1_500_000);
    assert.equal(c2?.contractStatus, "terminated");
  });

  it("6b. tenant leftAt caps billing for ended contracts (no fake months)", () => {
    const contracts = [
      contract({
        id: "c1",
        status: "terminated",
        startDate: "2026-07-05",
        endDate: "2027-07-05",
        monthlyPayment: 1_000_000,
      }),
    ];
    const tenants: Tenant[] = [
      {
        id: "t1",
        fullName: "Tenant A",
        phone: "",
        passport: "",
        rentAmount: 1_000_000,
        leftAt: "2026-08-20T00:00:00.000Z",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ];
    const [row] = selectCanonicalDebts(contracts, [], tenants, at("2026-10-06"));
    assert.equal(row!.unpaidMonths, 2);
    assert.equal(row!.debt, 2_000_000);
  });

  it("6c. fully paid full-term contract has no phantom final month", () => {
    const contracts = [
      contract({
        id: "c1",
        status: "expired",
        startDate: "2025-08-20",
        endDate: "2026-08-20",
        monthlyPayment: 100,
      }),
    ];
    const payments = Array.from({ length: 12 }, (_, i) => {
      const month = ((7 + i) % 12) + 1;
      const year = month >= 8 ? 2025 : 2026;
      return payment({ id: `p${i}`, amount: 100, periodYear: year, periodMonth: month });
    });
    assert.equal(selectCanonicalDebts(contracts, payments, [], at("2026-10-06")).length, 0);
  });

  it("7. ended contract with zero remaining debt disappears", () => {
    const contracts = [
      contract({
        id: "c1",
        status: "expired",
        startDate: "2026-06-01",
        endDate: "2026-09-01",
        monthlyPayment: 1_000_000,
      }),
    ];
    const payments = [6, 7, 8].map((m) =>
      payment({ id: `p${m}`, amount: 1_000_000, periodYear: 2026, periodMonth: m })
    );
    assert.equal(selectCanonicalDebts(contracts, payments, [], at("2026-10-06")).length, 0);
  });

  it("8. daysLate counts from the oldest unpaid period's due date", () => {
    const { contracts, payments } = augustSeptemberScenario();
    const [row] = selectCanonicalDebts(contracts, payments, [], at("2026-09-10"));
    assert.equal(row!.oldestUnpaidDueDate, "2026-08-05");
    assert.equal(row!.overdueDays, 36);

    const [oct] = selectCanonicalDebts(contracts, payments, [], at("2026-10-02"));
    // 2-oktabr: joriy oy muddati hali kelmagan, lekin Avgust qarzi 58 kun kechikkan.
    assert.equal(oct!.overdueDays, 58);
  });

  it("pending contracts are excluded", () => {
    const contracts = [contract({ id: "c1", status: "pending" })];
    assert.equal(selectCanonicalDebts(contracts, [], [], at("2026-09-04")).length, 0);
  });
});

describe("summarizeCanonicalDebts — KPI", () => {
  const now = at("2026-09-10");
  const contracts = [
    contract({ id: "c1", tenantId: "t1", startDate: "2026-08-05", monthlyPayment: 1_000_000 }),
    contract({
      id: "c2",
      tenantId: "t1",
      propertyName: "102 Room",
      startDate: "2026-09-05",
      monthlyPayment: 300_000,
    }),
    contract({
      id: "c3",
      tenantId: "t2",
      tenantName: "Other",
      status: "expired",
      startDate: "2026-07-05",
      endDate: "2026-09-01",
      monthlyPayment: 200_000,
    }),
  ];
  const payments = [
    payment({ id: "p1", contractId: "c1", amount: 400_000, periodYear: 2026, periodMonth: 8 }),
  ];

  it("9. total debt KPI sums remaining amounts of all unpaid periods", () => {
    const debts = selectCanonicalDebts(contracts, payments, [], now);
    const summary = summarizeCanonicalDebts(debts);
    // c1: 600 000 + 1 000 000; c2: 300 000; c3: 2 × 200 000
    assert.equal(summary.totalDebtAmount, 1_600_000 + 300_000 + 400_000);
  });

  it("10. debtor contract count is unique contracts with debt > 0", () => {
    const debts = selectCanonicalDebts(contracts, payments, [], now);
    const summary = summarizeCanonicalDebts(debts);
    assert.equal(summary.debtorContractCount, 3);
    assert.equal(summary.uniqueDebtorCount, 2);
  });

  it("11. no double counting: one row per contract and periods sum to debt", () => {
    const debts = selectCanonicalDebts(contracts, payments, [], now);
    assert.equal(new Set(debts.map((d) => d.contractId)).size, debts.length);
    for (const d of debts) {
      const sum = d.unpaidPeriods.reduce((s, p) => s + p.remaining, 0);
      assert.equal(sum, d.debt);
      assert.equal(d.unpaidPeriods.length, d.unpaidMonths);
    }
    const doubled = summarizeCanonicalDebts([...debts, ...debts]);
    assert.equal(doubled.debtorContractCount, debts.length);
  });

  it("computeDebts alias matches selectCanonicalDebts", () => {
    assert.deepEqual(
      computeDebts(contracts, payments, [] as Tenant[], now).map((d) => d.contractId),
      selectCanonicalDebts(contracts, payments, [], now).map((d) => d.contractId)
    );
  });
});
