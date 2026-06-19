"use client";

import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCollection } from "@/hooks/use-collection";
import { computeDebts } from "@/lib/analytics";
import { isApiConfigured } from "@/lib/api/client";
import { refreshCollection } from "@/lib/data/store";
import {
  sendPaymentRemindersApi,
  sendPaymentRemindersLocal,
} from "@/lib/payment-reminders";
import type { Contract, Payment } from "@/types";

export function buildPaymentReminderPayload(
  contracts: Contract[],
  payments: Payment[]
) {
  return computeDebts(contracts, payments).map((d) => {
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
  return useMemo(
    () => buildPaymentReminderPayload(contracts, payments).length,
    [contracts, payments]
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
  const [sending, setSending] = useState(false);

  const payload = useMemo(
    () => buildPaymentReminderPayload(contracts, payments),
    [contracts, payments]
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
        : await sendPaymentRemindersLocal(contracts, payments);

      await refreshCollection("notifications");

      if (result.sent === 0) {
        toast.warning("Qarzdorlar topilmadi — xabar yuborilmadi");
      } else {
        toast.success(
          `${result.sent} ta arendatorga to'lov eslatmasi yuborildi. Xabarlar bo'limini oching.`
        );
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
