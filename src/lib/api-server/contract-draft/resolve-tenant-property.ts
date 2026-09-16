/**
 * Tenant → room (Property) source of truth: Contract.propertyId.
 * Active/pending = current assignment; otherwise latest by updatedAt.
 */

export type ContractPropertyLink = {
  status: string;
  updatedAt: Date | string;
  property: {
    id: string;
    title: string;
    address: string;
    area: number | null;
  };
};

export type ResolvedTenantProperty = {
  propertyId: string | null;
  propertyTitle: string | null;
  propertyAddress: string | null;
  propertyArea: number | null;
  leaseStatus: string | null;
  /** Unique rooms linked via the chosen contract pool. */
  assignedProperties: Array<{
    id: string;
    title: string;
    address: string;
    area: number | null;
  }>;
  /** True when form should auto-fill propertyId. */
  autoSelected: boolean;
};

function byUpdatedDesc(a: ContractPropertyLink, b: ContractPropertyLink) {
  return (
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function isCurrentLease(status: string) {
  return status === "ACTIVE" || status === "PENDING";
}

function uniqueProperties(links: ContractPropertyLink[]) {
  const out: ResolvedTenantProperty["assignedProperties"] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const p = link.property;
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({
      id: p.id,
      title: p.title,
      address: p.address,
      area: p.area ?? null,
    });
  }
  return out;
}

function fromProperty(
  link: ContractPropertyLink,
  assignedProperties: ResolvedTenantProperty["assignedProperties"],
  autoSelected: boolean
): ResolvedTenantProperty {
  const p = link.property;
  return {
    propertyId: p.id,
    propertyTitle: p.title,
    propertyAddress: p.address,
    propertyArea: p.area ?? null,
    leaseStatus: link.status,
    assignedProperties,
    autoSelected,
  };
}

/**
 * Pick room for contract form auto-fill from existing Contract rows.
 * - 1 ACTIVE/PENDING room → auto-select
 * - N ACTIVE/PENDING rooms → no arbitrary pick; return those rooms
 * - no current lease → auto-select latest contract property (existing rule)
 * - none → empty
 */
export function resolveTenantAssignedProperty(
  contracts: ContractPropertyLink[]
): ResolvedTenantProperty {
  const empty: ResolvedTenantProperty = {
    propertyId: null,
    propertyTitle: null,
    propertyAddress: null,
    propertyArea: null,
    leaseStatus: null,
    assignedProperties: [],
    autoSelected: false,
  };

  if (!contracts.length) return empty;

  const sorted = [...contracts].sort(byUpdatedDesc);
  const current = sorted.filter((c) => isCurrentLease(c.status));

  if (current.length > 1) {
    const assignedProperties = uniqueProperties(current);
    if (assignedProperties.length === 1) {
      return fromProperty(current[0], assignedProperties, true);
    }
    return {
      propertyId: null,
      propertyTitle: null,
      propertyAddress: null,
      propertyArea: null,
      leaseStatus: current[0]?.status ?? null,
      assignedProperties,
      autoSelected: false,
    };
  }

  if (current.length === 1) {
    return fromProperty(current[0], uniqueProperties(current), true);
  }

  // No active/pending — latest contract is the source of truth.
  return fromProperty(sorted[0], uniqueProperties(sorted), true);
}
