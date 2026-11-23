import { apiFetch, isApiConfigured } from "@/lib/api/client";
import { getCollectionApi } from "@/lib/data/store";
import type { Contract, Tenant } from "@/types";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

/**
 * Local/demo sync mirror of server rules:
 * - skip departed tenants
 * - never reopen terminated/expired
 * - never invent a default room from the property list
 * - update existing open contracts only
 */
export async function syncContractFromTenant(tenant: Tenant) {
  if (tenant.leftAt) return null;

  const contractApi = getCollectionApi<Contract>("contracts");
  const contracts = await contractApi.list();
  const existing = contracts.find((c) => c.tenantId === tenant.id);
  if (!existing) return null;
  if (existing.status === "terminated" || existing.status === "expired") {
    return existing.id;
  }

  const durationMonths =
    tenant.contractDuration && tenant.contractDuration > 0
      ? tenant.contractDuration
      : 12;
  const contractStart = existing.startDate;
  await contractApi.update(existing.id, {
    monthlyPayment: tenant.rentAmount ?? 0,
    deposit: tenant.depositAmount ?? existing.deposit ?? 0,
    depositPaid: tenant.depositPaid ?? existing.depositPaid ?? false,
    endDate: addMonths(new Date(contractStart), durationMonths).toISOString(),
    notes: `Arendatordan avtomatik (${durationMonths} oy)`,
  });
  return existing.id;
}

export async function syncContractsFromTenantsApi() {
  if (!isApiConfigured) return 0;
  const res = await apiFetch<{ synced: number }>("/contracts/sync-tenants", {
    method: "PUT",
  });
  return res.synced ?? 0;
}
