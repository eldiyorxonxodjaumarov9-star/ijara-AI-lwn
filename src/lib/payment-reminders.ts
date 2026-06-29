import { apiFetch, isApiConfigured } from "@/lib/api/client";
import { getCollectionApi } from "@/lib/data/store";
import type { AppNotification, Contract, Payment, Tenant } from "@/types";
import { computeDebts } from "@/lib/analytics";
import {
  buildPaymentReminderMessage,
  groupDebtsByTenant,
} from "@/lib/payment-reminder-utils";

const TENANT_NOTIF_PREFIX = "arendahub:tenant-notifications:";

function pushTenantLocalNotification(tenantId: string, notification: AppNotification) {
  if (typeof window === "undefined") return;
  const key = TENANT_NOTIF_PREFIX + tenantId;
  const existing = JSON.parse(
    window.localStorage.getItem(key) ?? "[]"
  ) as AppNotification[];
  window.localStorage.setItem(
    key,
    JSON.stringify([notification, ...existing].slice(0, 50))
  );
}

export function readTenantLocalNotifications(tenantId: string): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      window.localStorage.getItem(TENANT_NOTIF_PREFIX + tenantId) ?? "[]"
    ) as AppNotification[];
  } catch {
    return [];
  }
}

export async function sendPaymentRemindersApi(
  debts?: Array<{
    contractId: string;
    tenantId?: string;
    tenantName: string;
    propertyName: string;
    debt: number;
  }>
) {
  if (!isApiConfigured) return { sent: 0, telegramSent: 0, telegramSkipped: 0 };
  return apiFetch<{
    sent: number;
    telegramSent?: number;
    telegramSkipped?: number;
  }>("/notifications/payment-reminders", {
    method: "POST",
    body: debts ? { debts } : {},
  });
}

export async function sendPaymentRemindersLocal(
  contracts: Contract[],
  payments: Payment[],
  tenants: Tenant[] = [],
  now = new Date()
) {
  const debts = computeDebts(contracts, payments, tenants, now).map((d) => {
    const c = contracts.find((x) => x.id === d.contractId);
    return {
      contractId: d.contractId,
      tenantId: c?.tenantId,
      tenantName: d.tenantName,
      propertyName: d.propertyName,
      debt: d.debt,
    };
  });

  const grouped = groupDebtsByTenant(debts);
  const api = getCollectionApi<AppNotification>("notifications");

  const existing = await api.list();
  await Promise.all(
    existing
      .filter(
        (n) =>
          n.title === "To'lov eslatmasi" ||
          n.title === "To'lov eslatmalari yuborildi"
      )
      .map((n) => api.remove(n.id))
  );

  let sent = 0;

  for (const d of grouped) {
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      title: "To'lov eslatmasi",
      message: buildPaymentReminderMessage(d),
      type: "warning",
      read: false,
      createdAt: new Date().toISOString(),
    };

    await api.create({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: false,
    });

    if (d.tenantId) {
      pushTenantLocalNotification(d.tenantId, notification);
    }
    sent += 1;
  }

  return { sent };
}

export async function fetchTenantNotifications(tenantId: string) {
  if (!isApiConfigured) return [];
  const raw = await apiFetch<
    Array<{
      id: string;
      title: string;
      message: string;
      type: string;
      isRead: boolean;
      createdAt: string;
    }>
  >("/notifications/tenant", {
    method: "POST",
    auth: false,
    body: { tenantId },
  });

  return raw.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type:
      n.type === "SUCCESS"
        ? ("success" as const)
        : n.type === "LATE_PAYMENT" || n.type === "WARNING"
          ? ("warning" as const)
          : ("info" as const),
    read: n.isRead,
    createdAt: n.createdAt,
  }));
}

export function notifyTenantPaymentLocal(
  tenantId: string,
  tenantName: string,
  propertyName: string,
  amount: number
) {
  const notification: AppNotification = {
    id: crypto.randomUUID(),
    title: "To'lov qabul qilindi",
    message: `Assalomu alaykum, ${tenantName}! ${propertyName} bo'yicha ${new Intl.NumberFormat("uz-UZ").format(Math.round(amount))} UZS to'lovingiz qabul qilindi. Rahmat! — ArendaAi`,
    type: "success",
    read: false,
    createdAt: new Date().toISOString(),
  };
  pushTenantLocalNotification(tenantId, notification);
  return notification;
}
