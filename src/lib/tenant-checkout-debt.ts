import { selectCanonicalDebts } from "@/lib/debts/canonical-debts";
import type { Contract, Payment, Tenant } from "@/types";

export type CheckoutDebtDecision = "KEEP_DEBT" | "WRITE_OFF";

function isOpen(c: Contract) {
  return c.status === "active" || c.status === "pending";
}

/**
 * Checkout shu paytda bo'lsa qoladigan qarz — server bilan bir xil qoida:
 * ochiq shartnomalar TERMINATED, endDate = min(endDate, now), tenant.leftAt = now.
 * Faqat ko'rsatish uchun; write-off summasini server o'zi hisoblaydi.
 */
export function previewCheckoutDebt(
  tenantId: string,
  contracts: Contract[],
  payments: Payment[],
  tenants: Tenant[],
  now: Date = new Date()
) {
  const nowIso = now.toISOString();
  const tenantContracts = contracts
    .filter((c) => c.tenantId === tenantId)
    .map((c) =>
      isOpen(c)
        ? {
            ...c,
            status: "terminated" as const,
            endDate:
              new Date(c.endDate).getTime() < now.getTime() ? c.endDate : nowIso,
          }
        : c
    );
  const tenant = tenants.find((t) => t.id === tenantId);
  const simulatedTenants = tenant ? [{ ...tenant, leftAt: tenant.leftAt ?? nowIso }] : [];
  const rows = selectCanonicalDebts(tenantContracts, payments, simulatedTenants, now);
  return {
    remainingDebt: rows.reduce((s, r) => s + r.debt, 0),
    unpaidMonths: rows.reduce((s, r) => s + r.unpaidMonths, 0),
    perContract: rows.map((r) => ({ contractId: r.contractId, debt: r.debt })),
    roomName:
      contracts.find((c) => c.tenantId === tenantId && isOpen(c))?.propertyName ?? null,
  };
}

/** "1 800 000 UZS" */
export function formatCheckoutDebt(amount: number) {
  const n = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n} UZS`;
}

export function checkoutSuccessMessage(result: {
  remainingDebt: number;
  writtenOffAmount?: number;
}) {
  if (result.remainingDebt > 0) {
    return `Ijarachi xonadan chiqarildi. ${formatCheckoutDebt(result.remainingDebt)} qarzdorlik saqlandi.`;
  }
  if ((result.writtenOffAmount ?? 0) > 0) {
    return "Ijarachi xonadan chiqarildi. Qarzdorlik 0 UZS qilib yopildi.";
  }
  return "Ijarachi xonadan chiqarildi. Qarzdorlik mavjud emas.";
}
