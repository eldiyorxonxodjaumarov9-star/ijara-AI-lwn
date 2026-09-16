"use client";

import { useMemo } from "react";

import { useTashkentNow } from "@/context/tashkent-time-context";
import { useCollection } from "@/hooks/use-collection";
import {
  selectCanonicalDebts,
  summarizeCanonicalDebts,
} from "@/lib/debts/canonical-debts";
import type { Contract, Payment, Tenant } from "@/types";

/** Haqiqiy vaqt bo'yicha joriy qarzdorlar soni */
export function useLiveDebtCount() {
  const { data: contracts } = useCollection<Contract>("contracts");
  const { data: payments } = useCollection<Payment>("payments");
  const { data: tenants } = useCollection<Tenant>("tenants");
  const now = useTashkentNow();

  return useMemo(() => {
    const debts = selectCanonicalDebts(contracts, payments, tenants, now);
    return summarizeCanonicalDebts(debts).uniqueDebtorCount;
  }, [contracts, payments, tenants, now]);
}
