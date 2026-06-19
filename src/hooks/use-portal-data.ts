"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/auth-context";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import { MAPPERS } from "@/lib/api/mappers";
import { useCollection } from "@/hooks/use-collection";
import type {
  Contract,
  Maintenance,
  Payment,
  Property,
  Tenant,
} from "@/types";

export interface PortalDataState {
  tenant: Tenant | undefined;
  contracts: Contract[];
  payments: Payment[];
  properties: Property[];
  maintenance: Maintenance[];
  loading: boolean;
  refresh: () => void;
}

function mapPortalResponse(raw: {
  tenant: Record<string, unknown>;
  contracts: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  maintenance: Record<string, unknown>[];
  availableProperties: Record<string, unknown>[];
}) {
  const contracts = raw.contracts.map((c) =>
    MAPPERS.contracts!.fromApi(c)
  ) as Contract[];
  const payments = raw.payments.map((p) =>
    MAPPERS.payments!.fromApi(p)
  ) as Payment[];
  const maintenance = raw.maintenance.map((m) =>
    MAPPERS.maintenance!.fromApi(m)
  ) as Maintenance[];
  const availableProperties = raw.availableProperties.map((p) =>
    MAPPERS.properties!.fromApi(p)
  ) as Property[];

  const rentedIds = new Set(contracts.map((c) => c.propertyId));
  const properties = [
    ...contracts
      .map((c) => {
        const fromList = availableProperties.find((p) => p.id === c.propertyId);
        if (fromList) return fromList;
        return {
          id: c.propertyId,
          name: c.propertyName ?? "—",
          address: "",
          region: "",
          district: "",
          price: c.monthlyPayment,
          status: "rented" as const,
          images: [],
          rooms: 0,
          area: 0,
          createdAt: c.createdAt,
        } satisfies Property;
      })
      .filter(Boolean),
    ...availableProperties.filter((p) => !rentedIds.has(p.id)),
  ];

  return {
    tenant: MAPPERS.tenants!.fromApi(raw.tenant) as Tenant,
    contracts,
    payments,
    maintenance,
    properties,
  };
}

export function usePortalData(): PortalDataState {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const { data: allContracts, loading: lc } =
    useCollection<Contract>("contracts");
  const { data: allPayments, loading: lp } =
    useCollection<Payment>("payments");
  const { data: allProperties, loading: lpr } =
    useCollection<Property>("properties");
  const { data: allTenants, loading: lt } =
    useCollection<Tenant>("tenants");
  const { data: allMaintenance, loading: lm } =
    useCollection<Maintenance>("maintenance");

  const [remote, setRemote] = useState<ReturnType<
    typeof mapPortalResponse
  > | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(isApiConfigured);

  const loadRemote = useCallback(async () => {
    if (!isApiConfigured || !tenantId) {
      setRemoteLoading(false);
      return;
    }
    setRemoteLoading(true);
    try {
      const raw = await apiFetch<{
        tenant: Record<string, unknown>;
        contracts: Record<string, unknown>[];
        payments: Record<string, unknown>[];
        maintenance: Record<string, unknown>[];
        availableProperties: Record<string, unknown>[];
      }>("/portal/data", {
        method: "POST",
        auth: false,
        body: { tenantId },
      });
      setRemote(mapPortalResponse(raw));
    } catch {
      setRemote(null);
    } finally {
      setRemoteLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote]);

  useEffect(() => {
    const onFocus = () => void loadRemote();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadRemote]);

  const local = useMemo(() => {
    const myContracts = allContracts.filter((c) => c.tenantId === tenantId);
    const myContractIds = new Set(myContracts.map((c) => c.id));
    const myPropertyIds = new Set(myContracts.map((c) => c.propertyId));
    return {
      tenant: allTenants.find((t) => t.id === tenantId),
      contracts: myContracts,
      payments: allPayments
        .filter((p) => p.contractId && myContractIds.has(p.contractId))
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      properties: allProperties,
      maintenance: allMaintenance.filter((m) => myPropertyIds.has(m.propertyId)),
    };
  }, [
    allContracts,
    allPayments,
    allProperties,
    allTenants,
    allMaintenance,
    tenantId,
  ]);

  if (isApiConfigured) {
    return {
      tenant: remote?.tenant,
      contracts: remote?.contracts ?? [],
      payments: remote?.payments ?? [],
      properties: remote?.properties ?? [],
      maintenance: remote?.maintenance ?? [],
      loading: remoteLoading,
      refresh: loadRemote,
    };
  }

  return {
    ...local,
    loading: lc || lp || lpr || lt || lm,
    refresh: () => {},
  };
}
