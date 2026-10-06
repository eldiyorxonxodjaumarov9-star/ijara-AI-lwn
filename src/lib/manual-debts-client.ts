import { apiFetch } from "@/lib/api/client";
import type { ManualDebtView } from "@/lib/manual-debts";

export type ManualDebtFormValues = {
  propertyId: string | null;
  debtorName: string;
  debtorPhone: string | null;
  debtorOccupation: string | null;
  description: string | null;
  originalAmount: number;
  debtDate: string;
};

const path = (id?: string, suffix = "") =>
  `/manual-debts${id ? `/${encodeURIComponent(id)}` : ""}${suffix}`;

export function listManualDebtsApi() {
  return apiFetch<ManualDebtView[]>(path());
}

export function getManualDebtApi(id: string) {
  return apiFetch<ManualDebtView>(path(id));
}

export function createManualDebtApi(values: ManualDebtFormValues) {
  return apiFetch<ManualDebtView>(path(), { method: "POST", body: values });
}

export function updateManualDebtApi(id: string, values: Partial<ManualDebtFormValues>) {
  return apiFetch<ManualDebtView>(path(id), { method: "PATCH", body: values });
}

export function addManualDebtPaymentApi(
  id: string,
  values: { amount: number; paymentDate: string; notes: string | null }
) {
  return apiFetch<ManualDebtView>(path(id, "/payments"), { method: "POST", body: values });
}

export function cancelManualDebtApi(id: string, reason?: string) {
  return apiFetch<ManualDebtView>(path(id, "/cancel"), { method: "POST", body: { reason } });
}
