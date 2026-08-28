import { getContractDisplayPaymentDueDate } from "@/lib/debt-calculator";
import type { Contract, Payment, Tenant } from "@/types";

const RELEVANT_CONTRACT_STATUSES = new Set<Contract["status"]>([
  "active",
  "pending",
  "expired",
]);

export type TenantPaymentDueLine = {
  propertyLabel: string;
  /** YYYY-MM-DD (Toshkent) */
  dueDateIso: string | null;
  /** DD.MM.YYYY yoki Belgilanmagan */
  dueDateLabel: string;
};

export function formatPaymentDueDisplay(
  iso: string | null | undefined
): string {
  if (!iso?.trim()) return "Belgilanmagan";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return "Belgilanmagan";
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function tenantContracts(tenantId: string, contracts: Contract[]): Contract[] {
  return contracts
    .filter(
      (c) =>
        c.tenantId === tenantId && RELEVANT_CONTRACT_STATUSES.has(c.status)
    )
    .sort((a, b) =>
      (a.propertyName ?? "—").localeCompare(b.propertyName ?? "—", "uz")
    );
}

export function getTenantPaymentDueLines(
  tenantId: string,
  contracts: Contract[],
  payments: Payment[],
  tenant: Tenant | undefined,
  now = new Date()
): TenantPaymentDueLine[] {
  if (tenant?.leftAt) return [];

  return tenantContracts(tenantId, contracts).map((contract) => {
    const dueDateIso = getContractDisplayPaymentDueDate(
      contract,
      payments,
      tenant,
      now
    );
    return {
      propertyLabel: contract.propertyName?.trim() || "—",
      dueDateIso,
      dueDateLabel: formatPaymentDueDisplay(dueDateIso),
    };
  });
}

export function buildTenantPaymentDueMap(
  tenants: Tenant[],
  contracts: Contract[],
  payments: Payment[],
  now = new Date()
): Map<string, TenantPaymentDueLine[]> {
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const map = new Map<string, TenantPaymentDueLine[]>();

  for (const tenant of tenants) {
    if (tenant.leftAt) {
      map.set(tenant.id, []);
      continue;
    }
    map.set(
      tenant.id,
      getTenantPaymentDueLines(
        tenant.id,
        contracts,
        payments,
        tenantById.get(tenant.id),
        now
      )
    );
  }

  return map;
}
