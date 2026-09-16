/**
 * Canonical debt selector (SoT).
 *
 * Definition: overdue unpaid billing obligations for **active** contracts only.
 * Uses computeContractDebt (FIFO period allocation) — not invoice ledger summaries.
 */

import { computeContractDebt } from "@/lib/debt-calculator";
import type { Contract, Payment, Tenant } from "@/types";

export type CanonicalDebtRow = {
  contractId: string;
  tenantId: string;
  propertyName: string;
  tenantName: string;
  monthsDue: number;
  expected: number;
  paid: number;
  debt: number;
  endDate: string;
  overdueDays: number;
};

function isActiveContract(contract: Contract) {
  return contract.status === "active";
}

/** Active contracts with debt > 0 after overdue-month calculation. */
export function selectCanonicalDebts(
  contracts: Contract[],
  payments: Payment[],
  tenants: Tenant[] = [],
  now: Date = new Date()
): CanonicalDebtRow[] {
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return contracts
    .filter(isActiveContract)
    .map((c) => {
      const tenant = tenantById.get(c.tenantId);
      const result = computeContractDebt(c, payments, tenant, now);
      return {
        contractId: c.id,
        tenantId: c.tenantId,
        propertyName: c.propertyName ?? "—",
        tenantName: c.tenantName ?? tenant?.fullName ?? "—",
        monthsDue: result.monthsDue,
        expected: result.expected,
        paid: result.paid,
        debt: result.debt,
        endDate: c.endDate,
        overdueDays: result.overdueDays,
      };
    })
    .filter((row) => row.debt > 0)
    .sort((a, b) => b.debt - a.debt);
}

export function summarizeCanonicalDebts(debts: CanonicalDebtRow[]) {
  const debtorTenantIds = new Set<string>();
  let totalDebtAmount = 0;
  for (const row of debts) {
    totalDebtAmount += row.debt;
    debtorTenantIds.add(row.tenantId);
  }
  return {
    /** Shartnomalar soni (qarzdor faol shartnomalar). */
    debtorContractCount: debts.length,
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
