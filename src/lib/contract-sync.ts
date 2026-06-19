import { apiFetch, isApiConfigured } from "@/lib/api/client";
import { getCollectionApi } from "@/lib/data/store";
import type { Contract, Property, Tenant } from "@/types";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export async function syncContractFromTenant(tenant: Tenant) {
  const propertyApi = getCollectionApi<Property>("properties");
  const contractApi = getCollectionApi<Contract>("contracts");
  const properties = await propertyApi.list();
  if (properties.length === 0) return null;

  const property = properties[0];
  const durationMonths =
    tenant.contractDuration && tenant.contractDuration > 0
      ? tenant.contractDuration
      : 12;
  const startDate = new Date(tenant.createdAt ?? Date.now());
  const endDate = addMonths(startDate, durationMonths);
  const contracts = await contractApi.list();
  const existing = contracts.find((c) => c.tenantId === tenant.id);

  const payload = {
    propertyId: property.id,
    tenantId: tenant.id,
    propertyName: property.name,
    tenantName: tenant.fullName,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    monthlyPayment: tenant.rentAmount ?? 0,
    deposit: 0,
    status: "active" as const,
    notes: `Arendatordan avtomatik (${durationMonths} oy)`,
  };

  if (existing) {
    await contractApi.update(existing.id, {
      ...payload,
      startDate: existing.startDate,
      endDate: addMonths(
        new Date(existing.startDate),
        durationMonths
      ).toISOString(),
    });
    return existing.id;
  }

  return contractApi.create(payload);
}

export async function syncContractsFromTenantsApi() {
  if (!isApiConfigured) return 0;
  const res = await apiFetch<{ synced: number }>("/contracts/sync-tenants", {
    method: "PUT",
  });
  return res.synced ?? 0;
}
