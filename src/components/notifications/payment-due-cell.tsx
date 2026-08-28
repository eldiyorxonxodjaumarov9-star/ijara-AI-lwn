"use client";

import type { TenantPaymentDueLine } from "@/lib/tenant-payment-due-display";

export function PaymentDueCell({ lines }: { lines: TenantPaymentDueLine[] }) {
  if (lines.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">Belgilanmagan</span>
    );
  }

  const showProperty = lines.length > 1;

  return (
    <div className="space-y-0.5 text-sm leading-snug">
      {lines.map((line) => (
        <div
          key={`${line.propertyLabel}-${line.dueDateIso ?? "none"}`}
          className="whitespace-nowrap"
        >
          {showProperty && (
            <span className="text-muted-foreground">{line.propertyLabel} — </span>
          )}
          <span>{line.dueDateLabel}</span>
        </div>
      ))}
    </div>
  );
}
