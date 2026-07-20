import { tokenStore } from "@/lib/api/client";
import { listLocalTenantArchives } from "@/lib/tenant-checkout-client";
import { isApiConfigured } from "@/lib/api/client";
import type { TenantArchive } from "@/types";

export async function fetchTenantArchives(search = ""): Promise<TenantArchive[]> {
  if (!isApiConfigured) {
    const rows = listLocalTenantArchives();
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.clientNumber.toLowerCase().includes(q) ||
        r.propertyName.toLowerCase().includes(q)
    );
  }

  const token = tokenStore.access;
  const params = new URLSearchParams({ limit: "500", sortBy: "leaveDate", order: "desc" });
  if (search.trim()) params.set("search", search.trim());

  const res = await fetch(`/api/tenant-archives?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message ?? "Yuklash xatosi");
  }

  const rows = (json?.data?.items ?? json?.data ?? json?.items ?? json) as Array<
    Record<string, unknown>
  >;

  return rows.map(mapArchiveFromApi);
}

function mapArchiveFromApi(i: Record<string, unknown>): TenantArchive {
  return {
    id: String(i.id),
    clientNumber: String(i.clientNumber ?? ""),
    tenantId: i.tenantId ? String(i.tenantId) : undefined,
    contractId: i.contractId ? String(i.contractId) : undefined,
    fullName: String(i.fullName ?? ""),
    phone: String(i.phone ?? ""),
    passport: i.passport ? String(i.passport) : undefined,
    propertyId: i.propertyId ? String(i.propertyId) : undefined,
    propertyName: String(i.propertyName ?? "—"),
    entryDate: i.entryDate ? String(i.entryDate) : undefined,
    leaveDate: String(i.leaveDate ?? i.createdAt ?? ""),
    contractStart: String(i.contractStart ?? ""),
    contractEnd: String(i.contractEnd ?? ""),
    monthlyRent: Number(i.monthlyRent ?? 0),
    deposit: Number(i.deposit ?? 0),
    depositPaid: Boolean(i.depositPaid),
    contractDuration:
      i.contractDuration != null ? Number(i.contractDuration) : undefined,
    totalPaid: Number(i.totalPaid ?? 0),
    paymentCount: Number(i.paymentCount ?? 0),
    notes: i.notes ? String(i.notes) : undefined,
    createdAt: String(i.createdAt ?? new Date().toISOString()),
  };
}
