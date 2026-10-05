"use client";

import { useEffect, useState } from "react";

import { useApiResource } from "@/hooks/use-api-resource";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import type {
  SourceBalance,
  SourcePaymentIncome,
  SourcePaymentType,
  SourcePaymentView,
} from "@/lib/source-payments";

export type SourcePaymentsData = {
  sourceType: SourcePaymentType;
  balances: SourceBalance[];
  payments: SourcePaymentView[];
  income: SourcePaymentIncome;
  payableCount: number;
};

/** CAR_RENTAL / HOTEL_HOSTEL / VILLA_RENTAL only; the API derives the source type from the workspace. */
export function useSourcePayments(enabled: boolean) {
  return useApiResource<SourcePaymentsData>("/source-payments", enabled);
}

export type SourcePaymentDashboard = SourcePaymentIncome & { recent: SourcePaymentView[] };

const EMPTY: SourcePaymentDashboard = { today: 0, month: 0, recent: [] };

/** Dashboard income + latest payments from real rental/booking payments (server-side aggregate). */
export function useSourcePaymentIncome(enabled: boolean): SourcePaymentDashboard {
  const active = enabled && isApiConfigured;
  const [income, setIncome] = useState<SourcePaymentDashboard>(EMPTY);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    apiFetch<SourcePaymentDashboard>("/source-payments/income")
      .then((res) => {
        if (!cancelled && res) setIncome({ ...EMPTY, ...res });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active]);

  return active ? income : EMPTY;
}
