import { isApiConfigured, tokenStore } from "@/lib/api/client";
import { listLocalTenantArchives } from "@/lib/tenant-checkout-client";
import { getCollectionApi } from "@/lib/data/store";
import { formatClientNumber } from "@/lib/client-number";
import type {
  ClientDatabaseRow,
  ContactInterest,
  ContactLead,
  Contract,
  Payment,
  Tenant,
} from "@/types";

const CONTACTS_KEY = "arendahub:contactLeads";

function authHeaders(): Record<string, string> {
  const token = tokenStore.access;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function readLocalContacts(): ContactLead[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CONTACTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ContactLead[];
  } catch {
    return [];
  }
}

function writeLocalContacts(rows: ContactLead[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTACTS_KEY, JSON.stringify(rows));
}

function nextLocalNumber(tenants: Tenant[], archives: { clientNumber: string }[]) {
  const nums = [
    ...tenants.map((t) => t.clientNumber),
    ...archives.map((a) => a.clientNumber),
  ]
    .map((v) => Number(String(v ?? "").replace(/\D/g, "")) || 0)
    .filter((n) => n > 0);
  return formatClientNumber((nums.length ? Math.max(...nums) : 0) + 1);
}

async function buildLocalRows(): Promise<ClientDatabaseRow[]> {
  const tenantApi = getCollectionApi<Tenant>("tenants");
  const contractApi = getCollectionApi<Contract>("contracts");
  const paymentApi = getCollectionApi<Payment>("payments");

  const [tenants, contracts, payments] = await Promise.all([
    tenantApi.list(),
    contractApi.list(),
    paymentApi.list(),
  ]);
  const archives = listLocalTenantArchives();

  for (const t of tenants) {
    if (!t.clientNumber) {
      const num = nextLocalNumber(
        tenants.filter((x) => x.clientNumber),
        archives
      );
      await tenantApi.update(t.id, { ...t, clientNumber: num });
      t.clientNumber = num;
    }
  }

  const active = tenants.filter((t) => !t.leftAt);
  const activeRows: ClientDatabaseRow[] = active.map((t) => {
    const contract = contracts.find(
      (c) =>
        c.tenantId === t.id &&
        (c.status === "active" || c.status === "pending")
    );
    const paid = contract
      ? payments
          .filter((p) => p.contractId === contract.id)
          .reduce((s, p) => s + (p.amount || 0), 0)
      : 0;
    return {
      id: `tenant-${t.id}`,
      kind: "active",
      clientNumber: t.clientNumber,
      fullName: t.fullName,
      phone: t.phone,
      propertyName: contract?.propertyName,
      entryDate: t.entryDate ?? contract?.startDate,
      totalPaid: paid,
      passport: t.passport,
      monthlyRent: contract?.monthlyPayment ?? t.rentAmount,
      contractDuration: t.contractDuration,
      depositPaid: contract?.depositPaid ?? t.depositPaid,
      deposit: contract?.deposit ?? t.depositAmount,
    };
  });

  const leftRows: ClientDatabaseRow[] = archives.map((a) => ({
    id: `archive-${a.id}`,
    kind: "left",
    clientNumber: a.clientNumber,
    fullName: a.fullName,
    phone: a.phone,
    propertyName: a.propertyName,
    entryDate: a.entryDate,
    leaveDate: a.leaveDate,
    totalPaid: a.totalPaid,
    passport: a.passport,
    monthlyRent: a.monthlyRent,
    contractDuration: a.contractDuration,
    depositPaid: a.depositPaid,
    deposit: a.deposit,
    paymentCount: a.paymentCount,
    notes: a.notes,
  }));

  const contactRows: ClientDatabaseRow[] = readLocalContacts().map((c) => ({
    id: `contact-${c.id}`,
    kind: "contact",
    fullName: c.fullName,
    phone: c.phone,
    interest: c.interest,
    notes: c.notes,
    entryDate: c.createdAt,
  }));

  return [...activeRows, ...leftRows, ...contactRows];
}

export async function fetchClientDatabase(): Promise<ClientDatabaseRow[]> {
  if (!isApiConfigured) return buildLocalRows();

  const res = await fetch("/api/client-database", {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? "Yuklash xatosi");
  return (json?.data?.items ?? json?.items ?? []) as ClientDatabaseRow[];
}

export async function createContactLead(input: {
  fullName: string;
  phone: string;
  interest: ContactInterest;
  notes?: string;
  source?: string;
}): Promise<ContactLead> {
  if (!isApiConfigured) {
    const row: ContactLead = {
      id: crypto.randomUUID(),
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      interest: input.interest,
      notes: input.notes?.trim() || undefined,
      source: input.source ?? "telefon",
      createdAt: new Date().toISOString(),
    };
    writeLocalContacts([row, ...readLocalContacts()]);
    return row;
  }

  const res = await fetch("/api/contact-leads", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? "Saqlash xatosi");
  return (json?.data ?? json) as ContactLead;
}

export async function updateContactLead(
  id: string,
  input: Partial<{
    fullName: string;
    phone: string;
    interest: ContactInterest;
    notes: string;
  }>
) {
  if (!isApiConfigured) {
    const rows = readLocalContacts().map((c) =>
      c.id === id ? { ...c, ...input, updatedAt: new Date().toISOString() } : c
    );
    writeLocalContacts(rows);
    return;
  }

  const res = await fetch(`/api/contact-leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? "Yangilash xatosi");
}

export async function deleteContactLead(id: string) {
  if (!isApiConfigured) {
    writeLocalContacts(readLocalContacts().filter((c) => c.id !== id));
    return;
  }

  const res = await fetch(`/api/contact-leads/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json?.message ?? "O'chirish xatosi");
  }
}
