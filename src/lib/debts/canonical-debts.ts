/**
 * Canonical debt selector (SoT).
 *
 * Definition: overdue unpaid billing obligations for every non-pending contract
 * (active, expired, terminated). Ended contracts stay listed until their
 * remaining debt is 0.
 * Uses computeContractDebt (FIFO period allocation) — not invoice ledger summaries.
 */

import { computeContractDebt, type DebtPeriod } from "@/lib/debt-calculator";
import type { Contract, ContractStatus, Payment, Tenant } from "@/types";

export type CanonicalDebtRow = {
  contractId: string;
  tenantId: string;
  propertyName: string;
  tenantName: string;
  contractStatus: ContractStatus;
  monthsDue: number;
  unpaidMonths: number;
  expected: number;
  paid: number;
  debt: number;
  endDate: string;
  overdueDays: number;
  oldestUnpaidDueDate: string | null;
  unpaidPeriods: DebtPeriod[];
};

function isBillableContract(contract: Contract) {
  return contract.status !== "pending";
}

/** Non-pending contracts with remaining debt > 0 across all due billing periods. */
export function selectCanonicalDebts(
  contracts: Contract[],
  payments: Payment[],
  tenants: Tenant[] = [],
  now: Date = new Date()
): CanonicalDebtRow[] {
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return contracts
    .filter(isBillableContract)
    .map((c) => {
      const tenant = tenantById.get(c.tenantId);
      const result = computeContractDebt(c, payments, tenant, now);
      return {
        contractId: c.id,
        tenantId: c.tenantId,
        propertyName: c.propertyName ?? "—",
        tenantName: c.tenantName ?? tenant?.fullName ?? "—",
        contractStatus: c.status,
        monthsDue: result.monthsDue,
        unpaidMonths: result.unpaidMonths,
        expected: result.expected,
        paid: result.paid,
        debt: result.debt,
        endDate: c.endDate,
        overdueDays: result.overdueDays,
        oldestUnpaidDueDate: result.oldestUnpaidDueDate,
        unpaidPeriods: result.unpaidPeriods,
      };
    })
    .filter((row) => row.debt > 0)
    .sort((a, b) => b.debt - a.debt);
}

export function summarizeCanonicalDebts(debts: CanonicalDebtRow[]) {
  const debtorTenantIds = new Set<string>();
  const debtorContractIds = new Set<string>();
  let totalDebtAmount = 0;
  for (const row of debts) {
    totalDebtAmount += row.debt;
    debtorTenantIds.add(row.tenantId);
    debtorContractIds.add(row.contractId);
  }
  return {
    /** Noyob qarzdor shartnomalar soni. */
    debtorContractCount: debtorContractIds.size,
    /** Noyob arendatorlar soni. */
    uniqueDebtorCount: debtorTenantIds.size,
    totalDebtAmount,
  };
}

/** @deprecated Use selectCanonicalDebts — kept for import stability. */
export function computeDebts(
  contracts: Contract[],
  payments: Payment[],
  tenants: Tenant[] = [],
  now: Date = new Date()
): CanonicalDebtRow[] {
  return selectCanonicalDebts(contracts, payments, tenants, now);
}
