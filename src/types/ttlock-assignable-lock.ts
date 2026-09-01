/** Client/server umumiy TTLock xona-biriktirish tiplari (Prisma import yo‘q) */

export const TTLOCK_PROVIDER_LABEL = "TTLock/Sciener";

export type TtlockDeviceOnlineStatusPublic =
  | "UNKNOWN"
  | "ONLINE"
  | "OFFLINE";

export type TtlockAssignableLock = {
  id: string;
  name: string;
  externalLockId: string;
  mac: string | null;
  battery: number | null;
  onlineStatus: TtlockDeviceOnlineStatusPublic;
  hasGateway: boolean;
  gatewayName: string | null;
  gatewayExternalId: string | null;
  gatewayOnlineStatus: TtlockDeviceOnlineStatusPublic | null;
  isActive: boolean;
  assignedPropertyId: string | null;
  assignedPropertyName: string | null;
  assignedToCurrentRoom: boolean;
  assignedToOtherRoom: boolean;
  lastSyncedAt: string | null;
  selectable: boolean;
  disabledReason: string | null;
};
