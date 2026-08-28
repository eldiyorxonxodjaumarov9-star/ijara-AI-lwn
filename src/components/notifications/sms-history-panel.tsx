"use client";

import { History } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";

export function SmsHistoryPanel() {
  return (
    <EmptyState
      icon={History}
      title="Hali SMS yuborilmagan"
      description="Play Mobile integratsiyasi ulangandan keyin yuborilgan SMSlar shu yerda ko'rinadi."
    />
  );
}
