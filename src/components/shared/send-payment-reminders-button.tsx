"use client";

import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCollection } from "@/hooks/use-collection";
import { useTashkentClock } from "@/hooks/use-tashkent-clock";
import { computeDebts } from "@/lib/analytics";
import { isApiConfigured } from "@/lib/api/client";
import { refreshCollection } from "@/lib/data/store";
import {
  sendPaymentRemindersApi,
  sendPaymentRemindersLocal,
} from "@/lib/payment-reminders";
import type { Contract, Payment, Tenant } from "@/types";

export function buildPaymentReminderPayload(
  contracts: Contract[],
  payments: Payment[],
  tenants: Tenant[] = [],
  now = new Date()
) {
  return computeDebts(contracts, payments, tenants, now).map((d) => {
    const c = contracts.find((x) => x.id === d.contractId);
    return {
      contractId: d.contractId,
      tenantId: c?.tenantId,
      tenantName: d.tenantName,
      propertyName: d.propertyName,
      debt: d.debt,
    };
  });
}

export function usePaymentReminderCount() {
  const { data: contracts } = useCollection<Contract>("contracts");
  const { data: payments } = useCollection<Payment>("payments");
  const { data: tenants } = useCollection<Tenant>("tenants");
  const tashkentNow = useTashkentClock();
  return useMemo(
    () => buildPaymentReminderPayload(contracts, payments, tenants, tashkentNow).length,
    [contracts, payments, tenants, tashkentNow]
  );
}

export function SendPaymentRemindersButton({
  variant = "default",
  size = "default",
  className,
  label,
  loadingLabel = "Yuborilmoqda...",
}: {
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
  label?: string;
  loadingLabel?: string;
}) {
  const { data: contracts, loading: lc } = useCollection<Contract>("contracts");
  const { data: payments, loading: lp } = useCollection<Payment>("payments");
  const { data: tenants } = useCollection<Tenant>("tenants");
  const tashkentNow = useTashkentClock();
  const [sending, setSending] = useState(false);

  const payload = useMemo(
    () => buildPaymentReminderPayload(contracts, payments, tenants, tashkentNow),
    [contracts, payments, tenants, tashkentNow]
  );

  const handleSend = async () => {
    if (payload.length === 0) {
      toast.info(
        "Qarzdorlar topilmadi. Avval Qarzdorliklar bo'limida ro'yxatni tekshiring."
      );
      return;
    }

    setSending(true);
    try {
      const result = isApiConfigured
        ? await sendPaymentRemindersApi(payload)
        : await sendPaymentRemindersLocal(contracts, payments, tenants, tashkentNow);

      await refreshCollection("notifications");

      const tgSent =
        "telegramSent" in result ? Number(result.telegramSent ?? 0) : 0;
      const tgSkipped =
        "telegramSkipped" in result ? Number(result.telegramSkipped ?? 0) : 0;

      if (result.sent === 0) {
        toast.warning("Qarzdorlar topilmadi — xabar yuborilmadi");
      } else {
        if (tgSent > 0) {
          toast.success(
            `${result.sent} ta qarzdorga eslatma yuborildi. Telegram bot: ${tgSent} ta.`
          );
        } else {
          toast.success(
            `${result.sent} ta qarzdorga panel xabari yuborildi. Telegram: 0 ta (arendator botda /start qilmagan).`,
            { duration: 6000 }
          );
        }
        if (tgSkipped > 0 && tgSent > 0) {
          toast.info(
            `${tgSkipped} ta arendator botga ulanmagan — faqat panelda eslatma.`,
            { duration: 5000 }
          );
        }
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Xabar yuborishda xatolik yuz berdi"
      );
    } finally {
      setSending(false);
    }
  };

  const text =
    label ??
    (payload.length > 0
      ? `To'lov eslatmasi (${payload.length})`
      : "To'lov eslatmasi yuborish");

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleSend}
      disabled={sending || lc || lp}
    >
      <Bell className="size-4" />
      {sending ? loadingLabel : text}
    </Button>
  );
}
