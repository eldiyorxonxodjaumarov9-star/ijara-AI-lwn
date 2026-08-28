"use client";

import { useMemo } from "react";

import { useTashkentNow } from "@/context/tashkent-time-context";
import { useCollection } from "@/hooks/use-collection";
import {
  buildTenantPaymentDueMap,
  type TenantPaymentDueLine,
} from "@/lib/tenant-payment-due-display";
import type { Contract, Payment, Tenant } from "@/types";

export function useTenantPaymentDueMap(): Map<string, TenantPaymentDueLine[]> {
  const { data: tenants } = useCollection<Tenant>("tenants");
  const { data: contracts } = useCollection<Contract>("contracts");
  const { data: payments } = useCollection<Payment>("payments");
  const now = useTashkentNow();

  return useMemo(
    () => buildTenantPaymentDueMap(tenants, contracts, payments, now),
    [tenants, contracts, payments, now]
  );
}
