import type { Contract, Tenant } from "@/types";
import type { SmsTenantCandidate } from "@/types/sms-notifications";
import { validateTenantPhone } from "@/lib/sms-notifications";

const ACTIVE_STATUSES = new Set(["active", "pending"]);

export function smsCandidateKey(tenantId: string, scopeKey: string) {
  return `${tenantId}:${scopeKey}`;
}

export function scopeKeyFromContractId(contractId: string | null | undefined) {
  const id = contractId?.trim();
  return id ? id : "none";
}

/**
 * SMS biriktirish dialogi uchun kandidatlar:
 * har bir faol shartnoma/xona — alohida qator;
 * shartnomasi yo‘q arendator — bitta qator (scopeKey=none).
 */
export function buildSmsTenantCandidates(
  tenants: Tenant[],
  contracts: Contract[],
  linkedKeys: Set<string>
): SmsTenantCandidate[] {
  const byTenant = new Map<string, Contract[]>();
  for (const c of contracts) {
    if (!ACTIVE_STATUSES.has(c.status)) continue;
    const list = byTenant.get(c.tenantId) ?? [];
    list.push(c);
    byTenant.set(c.tenantId, list);
  }

  const rows: SmsTenantCandidate[] = [];

  for (const t of tenants) {
    if (t.leftAt) continue;
    const phoneCheck = validateTenantPhone(t.phone ?? "");
    const tenantContracts = (byTenant.get(t.id) ?? []).sort((a, b) =>
      (a.propertyName ?? "").localeCompare(b.propertyName ?? "", "uz")
    );

    if (tenantContracts.length === 0) {
      const scopeKey = "none";
      rows.push({
        candidateKey: smsCandidateKey(t.id, scopeKey),
        tenantId: t.id,
        contractId: null,
        propertyId: null,
        scopeKey,
        fullName: t.fullName,
        phone: t.phone ?? "",
        propertyLabel: "—",
        phoneValid: phoneCheck.valid,
        phoneInvalidReason: phoneCheck.reason,
        alreadyLinked: linkedKeys.has(smsCandidateKey(t.id, scopeKey)),
      });
      continue;
    }

    for (const c of tenantContracts) {
      const scopeKey = scopeKeyFromContractId(c.id);
      const propertyLabel = c.propertyName?.trim() || "—";
      rows.push({
        candidateKey: smsCandidateKey(t.id, scopeKey),
        tenantId: t.id,
        contractId: c.id,
        propertyId: c.propertyId,
        scopeKey,
        fullName: t.fullName,
        phone: t.phone ?? "",
        propertyLabel,
        phoneValid: phoneCheck.valid,
        phoneInvalidReason: phoneCheck.reason,
        alreadyLinked: linkedKeys.has(smsCandidateKey(t.id, scopeKey)),
      });
    }
  }

  return rows.sort((a, b) => {
    const byName = a.fullName.localeCompare(b.fullName, "uz");
    if (byName !== 0) return byName;
    return a.propertyLabel.localeCompare(b.propertyLabel, "uz");
  });
}

export function collectSmsCandidateRooms(
  candidates: SmsTenantCandidate[]
): string[] {
  const rooms = new Set<string>();
  for (const c of candidates) {
    if (c.propertyLabel.trim() && c.propertyLabel !== "—") {
      rooms.add(c.propertyLabel);
    }
  }
  return Array.from(rooms).sort((a, b) => a.localeCompare(b, "uz"));
}
