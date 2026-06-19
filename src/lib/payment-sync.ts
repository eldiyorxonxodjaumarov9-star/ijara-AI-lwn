import { apiFetch, isApiConfigured } from "@/lib/api/client";
import { getCollectionApi } from "@/lib/data/store";
import type { Contract, Payment } from "@/types";

const AUTO_NOTE = "Shartnomadan avtomatik";

function isSameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

export async function syncPaymentFromContract(contract: Contract) {
  if (contract.status !== "active" || (contract.monthlyPayment ?? 0) <= 0) {
    return null;
  }

  const paymentApi = getCollectionApi<Payment>("payments");
  const payments = await paymentApi.list();
  const now = new Date();
  const existing = payments.find(
    (p) =>
      p.contractId === contract.id &&
      isSameMonth(new Date(p.date), now)
  );

  const payload = {
    contractId: contract.id,
    tenantName: contract.tenantName,
    propertyName: contract.propertyName,
    amount: contract.monthlyPayment,
    date: now.toISOString(),
    method: "cash" as const,
    note: AUTO_NOTE,
  };

  if (existing) {
    await paymentApi.update(existing.id, payload);
    return existing.id;
  }

  return paymentApi.create(payload);
}

export async function syncPaymentsFromContractsApi() {
  if (!isApiConfigured) return 0;
  const res = await apiFetch<{ synced: number }>("/payments/sync-contracts", {
    method: "PUT",
  });
  return res.synced ?? 0;
}

export async function syncAllPaymentsFromContractsLocal() {
  const contractApi = getCollectionApi<Contract>("contracts");
  const contracts = await contractApi.list();
  let count = 0;
  for (const contract of contracts) {
    const id = await syncPaymentFromContract(contract);
    if (id) count += 1;
  }
  return count;
}
