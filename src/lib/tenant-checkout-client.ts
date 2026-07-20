import { getCollectionApi } from "@/lib/data/store";
import { formatClientNumber } from "@/lib/client-number";
import type {
  Contract,
  Payment,
  Property,
  Tenant,
  TenantArchive,
} from "@/types";

const ARCHIVE_KEY = "arendahub:tenantArchives";

function readArchives(): TenantArchive[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(ARCHIVE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as TenantArchive[];
  } catch {
    return [];
  }
}

function writeArchives(rows: TenantArchive[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(rows));
}

function nextLocalClientNumber(tenants: Tenant[], archives: TenantArchive[]) {
  const nums = [
    ...tenants.map((t) => t.clientNumber),
    ...archives.map((a) => a.clientNumber),
  ]
    .map((v) => Number(String(v ?? "").replace(/\D/g, "")) || 0)
    .filter((n) => n > 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return formatClientNumber(next);
}

export function listLocalTenantArchives() {
  return readArchives().sort(
    (a, b) => new Date(b.leaveDate).getTime() - new Date(a.leaveDate).getTime()
  );
}

export async function checkoutTenantLocal(tenantId: string) {
  const tenantApi = getCollectionApi<Tenant>("tenants");
  const contractApi = getCollectionApi<Contract>("contracts");
  const paymentApi = getCollectionApi<Payment>("payments");
  const propertyApi = getCollectionApi<Property>("properties");

  const tenants = await tenantApi.list();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) throw new Error("Arendator topilmadi");
  if (tenant.leftAt) throw new Error("Arendator allaqachon chiqib ketgan");

  const contracts = await contractApi.list();
  const contract = contracts.find(
    (c) =>
      c.tenantId === tenantId &&
      (c.status === "active" || c.status === "pending")
  );

  const payments = await paymentApi.list();
  const contractPayments = contract
    ? payments.filter((p) => p.contractId === contract.id)
    : [];
  const totalPaid = contractPayments.reduce((s, p) => s + (p.amount || 0), 0);

  const archives = readArchives();
  const clientNumber =
    tenant.clientNumber ?? nextLocalClientNumber(tenants, archives);
  const leaveDate = new Date().toISOString();

  const archive: TenantArchive = {
    id: crypto.randomUUID(),
    clientNumber,
    tenantId: tenant.id,
    contractId: contract?.id,
    fullName: tenant.fullName,
    phone: tenant.phone,
    passport: tenant.passport,
    propertyId: contract?.propertyId,
    propertyName: contract?.propertyName ?? "—",
    entryDate: tenant.entryDate ?? contract?.startDate,
    leaveDate,
    contractStart: contract?.startDate ?? tenant.entryDate ?? leaveDate,
    contractEnd: leaveDate,
    monthlyRent: contract?.monthlyPayment ?? tenant.rentAmount,
    deposit: contract?.deposit ?? tenant.depositAmount ?? 0,
    depositPaid: contract?.depositPaid ?? tenant.depositPaid ?? false,
    contractDuration: tenant.contractDuration,
    totalPaid,
    paymentCount: contractPayments.length,
    notes: contract?.notes,
    createdAt: leaveDate,
  };

  writeArchives([archive, ...archives]);

  if (contract) {
    await contractApi.update(contract.id, {
      ...contract,
      status: "terminated",
      endDate: leaveDate,
    });
    const property = (await propertyApi.list()).find(
      (p) => p.id === contract.propertyId
    );
    if (property) {
      await propertyApi.update(property.id, { ...property, status: "available" });
    }
  }

  await tenantApi.update(tenant.id, {
    ...tenant,
    clientNumber,
    leftAt: leaveDate,
  });

  return archive;
}

export async function checkoutTenantApi(tenantId: string) {
  const res = await fetch(`/api/tenants/${tenantId}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message ?? "Chiqish xatosi");
  }
  return (json?.data ?? json) as TenantArchive;
}
