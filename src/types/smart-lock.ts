/** Ichki aqlli qulf sozlamalari — saqlangan ≠ haqiqiy ulanish */

import type { TtlockAssignableLock } from "@/types/ttlock-assignable-lock";

export type SmartLockConnectionStatus = "disconnected" | "connected";

export type SmartLockDeviceStatus = "online" | "offline" | "unknown";

export type SmartLockLockState = "locked" | "unlocked" | "unknown";

export type SmartLockDoorState = "open" | "closed" | "unknown";

export type AccessLogDirection = "entry" | "exit" | "unknown";

export type AccessPermissionType =
  | "permanent"
  | "temporary"
  | "pin"
  | "card"
  | "app";

export type RoomLockSettingsRecord = {
  id: string;
  propertyId: string;
  providerName: string;
  lockName: string;
  deviceId: string;
  notes: string;
  ttlockCachedLockId?: string | null;
  linkedLock?: TtlockAssignableLock | null;
  createdAt: string;
  updatedAt: string;
};

export type RemoteControlStatusRecord = {
  canUnlock: boolean;
  unlockReasonCode?: string;
  unlockReason?: string;
  canLock: boolean;
  lockReasonCode?: string;
  lockReason?: string;
  canCreateTimedPasscode: boolean;
  passcodeReason?: string;
  canRevokeAccess: boolean;
  revokeReason?: string;
  canSyncHistory: boolean;
  historyReason?: string;
  provider: string;
  roomName: string;
  lockName: string | null;
  lockExternalId: string | null;
  lockOnlineStatus: string;
  gatewayName: string | null;
  gatewayOnlineStatus: string | null;
  wifiRemoteCapable: boolean | null;
  battery: number | null;
  lastSyncedAt: string | null;
  remoteReady: boolean;
  remoteReadyLabel: string;
};

export type RoomAccessGrantStatus = "planned" | "cancelled";

export type AccessEffectiveUiStatus =
  | "REJALASHTIRILGAN"
  | "YUBORILMOQDA"
  | "API_YUBORILGAN"
  | "FAOL"
  | "TUGAGAN"
  | "BEKOR_KUTILMOQDA"
  | "BEKOR_QILINGAN"
  | "XATOLIK";

export type AccessDeliveryPublic = {
  hasCredential: boolean;
  syncStatus: string | null;
  externalAccessId: string | null;
  sentAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lockId: string | null;
  lockName: string | null;
  lockExternalId: string | null;
  receiverMasked: string | null;
  lockMissingHint: string | null;
};

export type RoomAccessGrantRecord = {
  id: string;
  propertyId: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail?: string | null;
  permissionType: AccessPermissionType;
  accessKind?: "passcode" | "ekey" | "other";
  validFrom: string;
  validTo: string;
  status: RoomAccessGrantStatus;
  notes: string;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  effectiveStatus?: AccessEffectiveUiStatus;
  effectiveLabel?: string;
  delivery?: AccessDeliveryPublic;
  /** Faqat create/sync javobida — list’da bo‘lmasligi kerak */
  oneTimePasscode?: string;
  syncOutcome?: "planned_only" | "synced" | "failed_keep_plan";
  userMessage?: string;
};

/** Qurilmadan kelgan haqiqiy hodisa */
export type SmartLockAccessLogEntry = {
  id: string;
  propertyId: string;
  occurredAt: string;
  personLabel: string | null;
  eventType: string;
  method: string | null;
  direction: AccessLogDirection;
  result: string;
  source: string;
};

export const ACCESS_PERMISSION_LABELS: Record<AccessPermissionType, string> = {
  pin: "Parol",
  app: "eKey",
  card: "Karta",
  permanent: "Doimiy",
  temporary: "Vaqtinchalik",
};

export const GRANT_STATUS_LABELS: Record<RoomAccessGrantStatus, string> = {
  planned: "Rejalashtirilgan",
  cancelled: "Bekor qilingan",
};

export const TTLOCK_ACCESS_UI_TYPES: AccessPermissionType[] = ["pin", "app"];
