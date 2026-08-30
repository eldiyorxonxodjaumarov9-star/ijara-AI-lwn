/**
 * TTLock 8-bosqich — masofadan boshqarish capability (server-only, sof funksiyalar).
 * Client yuborgan hasGateway/online/canUnlock qiymatlariga ishonilmaydi.
 */

import type { TtlockDeviceOnlineStatus } from "@/lib/api-server/ttlock/persistence";
import { inferWifiRemoteCapable } from "@/lib/api-server/ttlock/types";

export type RemoteControlCapability = {
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
};

export const REMOTE_REASON = {
  ROOM_LOCK_MISSING: {
    code: "TTLOCK_ROOM_LOCK_MISSING",
    text: "Xonaga TTLock qulfi biriktirilmagan.",
  },
  GATEWAY_REQUIRED: {
    code: "TTLOCK_GATEWAY_REQUIRED",
    text: "Gateway yoki Wi‑Fi ulanishi aniqlanmadi. Masofadan ochish uchun Gateway yoki Wi‑Fi qulf kerak.",
  },
  GATEWAY_OFFLINE: {
    code: "TTLOCK_GATEWAY_OFFLINE",
    text: "Gateway oflayn. Internet ulanishini tekshiring.",
  },
  REMOTE_UNLOCK_UNSUPPORTED: {
    code: "TTLOCK_REMOTE_UNLOCK_UNSUPPORTED",
    text: "Bu qulf masofadan ochishni qo‘llamaydi.",
  },
  REMOTE_LOCK_UNSUPPORTED: {
    code: "TTLOCK_REMOTE_LOCK_UNSUPPORTED",
    text: "Bu qulf masofadan yopishni qo‘llamaydi.",
  },
  NOT_CONNECTED: {
    code: "TTLOCK_NOT_CONNECTED",
    text: "TTLock hisobi hali ulanmagan.",
  },
  TOKEN_EXPIRED: {
    code: "TTLOCK_TOKEN_EXPIRED",
    text: "TTLock ulanish muddati tugagan. Hisobni qayta ulang.",
  },
  NOT_CONFIGURED: {
    code: "TTLOCK_NOT_CONFIGURED",
    text: "TTLock API ma’lumotlari hali serverga kiritilmagan.",
  },
  MIGRATION: {
    code: "DATABASE_MIGRATION_REQUIRED",
    text: "TTLock ma’lumotlar bazasi hali tayyorlanmagan.",
  },
  COMMAND_IN_PROGRESS: {
    code: "TTLOCK_COMMAND_IN_PROGRESS",
    text: "Bu qulf uchun boshqa masofaviy buyruq bajarilmoqda.",
  },
  LOCK_INACTIVE: {
    code: "TTLOCK_LOCK_INACTIVE",
    text: "TTLock hisobida hozir topilmadi.",
  },
  FORBIDDEN: {
    code: "TTLOCK_FORBIDDEN",
    text: "Bu amal uchun sizda ruxsat yo‘q.",
  },
  NO_REVOCABLE: {
    code: "TTLOCK_NO_REVOCABLE_ACCESS",
    text: "Bekor qilish uchun faol kirish huquqi topilmadi.",
  },
} as const;

export type RemotePathInput = {
  hasGateway: boolean;
  gatewayOnlineStatus: TtlockDeviceOnlineStatus | null;
  wifiRemoteCapable: boolean | null;
  capabilities: Record<string, unknown> | null;
};

/** Gateway ONLINE yoki rasmiy Wi‑Fi remote capability */
export function resolveRemoteTransportPath(
  input: RemotePathInput
): { ok: true } | { ok: false; code: string; text: string } {
  const wifi =
    input.wifiRemoteCapable ??
    inferWifiRemoteCapable({ capabilities: input.capabilities });

  if (wifi === true) {
    return { ok: true };
  }

  if (input.hasGateway) {
    if (input.gatewayOnlineStatus === "OFFLINE") {
      return {
        ok: false,
        code: REMOTE_REASON.GATEWAY_OFFLINE.code,
        text: REMOTE_REASON.GATEWAY_OFFLINE.text,
      };
    }
    if (input.gatewayOnlineStatus === "ONLINE") {
      return { ok: true };
    }
    return {
      ok: false,
      code: REMOTE_REASON.GATEWAY_REQUIRED.code,
      text: REMOTE_REASON.GATEWAY_REQUIRED.text,
    };
  }

  if (wifi === false) {
    return {
      ok: false,
      code: REMOTE_REASON.GATEWAY_REQUIRED.code,
      text: REMOTE_REASON.GATEWAY_REQUIRED.text,
    };
  }

  return {
    ok: false,
    code: REMOTE_REASON.GATEWAY_REQUIRED.code,
    text: REMOTE_REASON.GATEWAY_REQUIRED.text,
  };
}

export function resolveRemoteControlCapability(input: {
  roleAllowed: boolean;
  configReady: boolean;
  dbReady: boolean;
  connectionConnected: boolean;
  tokenExpired: boolean;
  roomLockLinked: boolean;
  lockActive: boolean;
  remoteUnlock: boolean | null;
  commandInProgress: boolean;
  hasRevocableAccess: boolean;
  transport: RemotePathInput;
}): RemoteControlCapability {
  const baseBlock = (
    code: string,
    text: string
  ): Pick<
    RemoteControlCapability,
    "unlockReasonCode" | "unlockReason" | "lockReasonCode" | "lockReason"
  > => ({
    unlockReasonCode: code,
    unlockReason: text,
    lockReasonCode: code,
    lockReason: text,
  });

  if (!input.roleAllowed) {
    const b = baseBlock(
      REMOTE_REASON.FORBIDDEN.code,
      REMOTE_REASON.FORBIDDEN.text
    );
    return {
      canUnlock: false,
      ...b,
      canLock: false,
      canCreateTimedPasscode: false,
      passcodeReason: REMOTE_REASON.FORBIDDEN.text,
      canRevokeAccess: false,
      revokeReason: REMOTE_REASON.FORBIDDEN.text,
      canSyncHistory: false,
      historyReason: REMOTE_REASON.FORBIDDEN.text,
    };
  }

  if (!input.configReady) {
    const b = baseBlock(
      REMOTE_REASON.NOT_CONFIGURED.code,
      REMOTE_REASON.NOT_CONFIGURED.text
    );
    return {
      canUnlock: false,
      ...b,
      canLock: false,
      canCreateTimedPasscode: true,
      canRevokeAccess: input.hasRevocableAccess,
      revokeReason: input.hasRevocableAccess
        ? undefined
        : REMOTE_REASON.NO_REVOCABLE.text,
      canSyncHistory: false,
      historyReason: REMOTE_REASON.NOT_CONFIGURED.text,
    };
  }

  if (!input.dbReady) {
    const b = baseBlock(REMOTE_REASON.MIGRATION.code, REMOTE_REASON.MIGRATION.text);
    return {
      canUnlock: false,
      ...b,
      canLock: false,
      canCreateTimedPasscode: true,
      canRevokeAccess: input.hasRevocableAccess,
      revokeReason: input.hasRevocableAccess
        ? undefined
        : REMOTE_REASON.NO_REVOCABLE.text,
      canSyncHistory: false,
      historyReason: REMOTE_REASON.MIGRATION.text,
    };
  }

  if (!input.connectionConnected) {
    const b = baseBlock(
      REMOTE_REASON.NOT_CONNECTED.code,
      REMOTE_REASON.NOT_CONNECTED.text
    );
    return {
      canUnlock: false,
      ...b,
      canLock: false,
      canCreateTimedPasscode: true,
      canRevokeAccess: input.hasRevocableAccess,
      revokeReason: input.hasRevocableAccess
        ? undefined
        : REMOTE_REASON.NO_REVOCABLE.text,
      canSyncHistory: false,
      historyReason: REMOTE_REASON.NOT_CONNECTED.text,
    };
  }

  if (input.tokenExpired) {
    const b = baseBlock(
      REMOTE_REASON.TOKEN_EXPIRED.code,
      REMOTE_REASON.TOKEN_EXPIRED.text
    );
    return {
      canUnlock: false,
      ...b,
      canLock: false,
      canCreateTimedPasscode: true,
      canRevokeAccess: input.hasRevocableAccess,
      revokeReason: input.hasRevocableAccess
        ? undefined
        : REMOTE_REASON.NO_REVOCABLE.text,
      canSyncHistory: false,
      historyReason: REMOTE_REASON.TOKEN_EXPIRED.text,
    };
  }

  const passcodeOk = true;
  const revokeOk = input.hasRevocableAccess;
  const revokeReason = revokeOk ? undefined : REMOTE_REASON.NO_REVOCABLE.text;

  if (!input.roomLockLinked) {
    const b = baseBlock(
      REMOTE_REASON.ROOM_LOCK_MISSING.code,
      REMOTE_REASON.ROOM_LOCK_MISSING.text
    );
    return {
      canUnlock: false,
      ...b,
      canLock: false,
      canCreateTimedPasscode: passcodeOk,
      passcodeReason: undefined,
      canRevokeAccess: revokeOk,
      revokeReason,
      canSyncHistory: false,
      historyReason: REMOTE_REASON.ROOM_LOCK_MISSING.text,
    };
  }

  if (!input.lockActive) {
    const b = baseBlock(
      REMOTE_REASON.LOCK_INACTIVE.code,
      REMOTE_REASON.LOCK_INACTIVE.text
    );
    return {
      canUnlock: false,
      ...b,
      canLock: false,
      canCreateTimedPasscode: passcodeOk,
      canRevokeAccess: revokeOk,
      revokeReason,
      canSyncHistory: false,
      historyReason: REMOTE_REASON.LOCK_INACTIVE.text,
    };
  }

  const historyOk = true;

  if (input.commandInProgress) {
    const b = baseBlock(
      REMOTE_REASON.COMMAND_IN_PROGRESS.code,
      REMOTE_REASON.COMMAND_IN_PROGRESS.text
    );
    return {
      canUnlock: false,
      ...b,
      canLock: false,
      canCreateTimedPasscode: passcodeOk,
      canRevokeAccess: revokeOk,
      revokeReason,
      canSyncHistory: historyOk,
    };
  }

  const path = resolveRemoteTransportPath(input.transport);

  if (!path.ok) {
    return {
      canUnlock: false,
      unlockReasonCode: path.code,
      unlockReason: path.text,
      canLock: false,
      lockReasonCode: path.code,
      lockReason: path.text,
      canCreateTimedPasscode: passcodeOk,
      canRevokeAccess: revokeOk,
      revokeReason,
      canSyncHistory: historyOk,
    };
  }

  if (input.remoteUnlock === false) {
    return {
      canUnlock: false,
      unlockReasonCode: REMOTE_REASON.REMOTE_UNLOCK_UNSUPPORTED.code,
      unlockReason: REMOTE_REASON.REMOTE_UNLOCK_UNSUPPORTED.text,
      canLock: false,
      lockReasonCode: REMOTE_REASON.REMOTE_LOCK_UNSUPPORTED.code,
      lockReason: REMOTE_REASON.REMOTE_LOCK_UNSUPPORTED.text,
      canCreateTimedPasscode: passcodeOk,
      canRevokeAccess: revokeOk,
      revokeReason,
      canSyncHistory: historyOk,
    };
  }

  if (input.remoteUnlock !== true) {
    return {
      canUnlock: false,
      unlockReasonCode: REMOTE_REASON.REMOTE_UNLOCK_UNSUPPORTED.code,
      unlockReason: REMOTE_REASON.REMOTE_UNLOCK_UNSUPPORTED.text,
      canLock: false,
      lockReasonCode: REMOTE_REASON.REMOTE_LOCK_UNSUPPORTED.code,
      lockReason: REMOTE_REASON.REMOTE_LOCK_UNSUPPORTED.text,
      canCreateTimedPasscode: passcodeOk,
      canRevokeAccess: revokeOk,
      revokeReason,
      canSyncHistory: historyOk,
    };
  }

  return {
    canUnlock: true,
    canLock: true,
    canCreateTimedPasscode: passcodeOk,
    canRevokeAccess: revokeOk,
    revokeReason,
    canSyncHistory: historyOk,
  };
}

export type RemoteControlStatusPublic = RemoteControlCapability & {
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

export function remoteReadyLabel(cap: RemoteControlCapability): string {
  if (cap.canUnlock || cap.canLock) {
    return "Masofadan boshqaruvga tayyor";
  }
  const reason =
    cap.unlockReason ??
    cap.lockReason ??
    cap.historyReason ??
    "Masofadan boshqaruv hozir mavjud emas";
  return reason;
}
