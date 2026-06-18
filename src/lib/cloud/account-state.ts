import type { CollectionName } from "@/lib/data/store";
import type { AppUser } from "@/types";

export const SYNC_COLLECTIONS: CollectionName[] = [
  "properties",
  "tenants",
  "contracts",
  "payments",
  "expenses",
  "maintenance",
  "notifications",
  "clients",
  "analyses",
];

export interface AccountSyncState {
  version: number;
  updatedAt: string;
  profile: AppUser | null;
  demoUsers: (AppUser & { password: string })[];
  collections: Partial<Record<CollectionName, unknown[]>>;
}

export function accountSyncKey(email: string) {
  return email.trim().toLowerCase();
}
