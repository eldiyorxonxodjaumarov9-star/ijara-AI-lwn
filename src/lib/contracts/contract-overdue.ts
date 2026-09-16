import { CONTRACT_STATUS_MAP } from "@/lib/constants";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import type { Contract, ContractStatus } from "@/types";

const NON_OVERDUE_STATUSES: ContractStatus[] = ["terminated", "pending"];

/**
 * Shartnoma tugash sanasi bugundan oldinmi (Toshkent, kun darajasida).
 * Bugun = muddati o'tmagan.
 */
export function isContractEndDatePast(
  endDate: string | Date,
  now: Date = new Date()
): boolean {
  const end = getTashkentDateParts(new Date(endDate));
  const today = getTashkentDateParts(now);
  if (end.year < today.year) return true;
  if (end.year > today.year) return false;
  if (end.month < today.month) return true;
  if (end.month > today.month) return false;
  return end.day < today.day;
}

/**
 * Muddati o'tgan shartnoma: bekor qilinmagan va tugash sanasi o'tgan.
 * `expired` holati kelajakdagi endDate bilan overdue hisoblanmaydi.
 */
export function isContractOverdue(
  contract: Contract,
  now: Date = new Date()
): boolean {
  if (NON_OVERDUE_STATUSES.includes(contract.status)) return false;
  if (contract.status !== "active" && contract.status !== "expired") {
    return false;
  }
  return isContractEndDatePast(contract.endDate, now);
}

export function getOverdueContracts(
  contracts: Contract[],
  now: Date = new Date()
): Contract[] {
  return contracts.filter((c) => isContractOverdue(c, now));
}

export function countOverdueContracts(
  contracts: Contract[],
  now: Date = new Date()
): number {
  return getOverdueContracts(contracts, now).length;
}

/**
 * UI badge: kelajakdagi endDate bilan `expired` status "Muddati o'tgan" ko'rsatilmaydi.
 */
export function getContractStatusBadge(
  contract: Contract,
  now: Date = new Date()
): { label: string; variant: "success" | "warning" | "secondary" | "destructive" } {
  if (
    contract.status === "expired" &&
    !isContractEndDatePast(contract.endDate, now)
  ) {
    return CONTRACT_STATUS_MAP.active;
  }
  if (isContractOverdue(contract, now)) {
    return CONTRACT_STATUS_MAP.expired;
  }
  return (
    CONTRACT_STATUS_MAP[contract.status] ?? {
      label: contract.status,
      variant: "secondary" as const,
    }
  );
}
