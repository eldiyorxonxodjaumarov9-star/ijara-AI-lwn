/** TTLock UI / client uchun xavfsiz tip lar (secret yo‘q) */

export type TtlockConnectionStatus =
  | "disconnected"
  | "ready"
  | "connected"
  | "token_expired"
  | "error"
  | "syncing";

export type TtlockPublicStatus = {
  provider: "TTLock/Sciener";
  config: {
    configured: boolean;
    missingFields: string[];
    environment: "eu";
  };
  connection: {
    status: TtlockConnectionStatus;
    connected: boolean;
    ttlockUid: string | null;
    tokenExpiresAt: string | null;
    lastConnectedAt: string | null;
    lastSyncedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    lockCount: number;
  };
  callback?: {
    callbackUrl: string;
    verificationMode: "verify-by-fetch";
    ready: boolean;
    lastReceivedAt: string | null;
    lastProcessedAt: string | null;
    failedCount: number;
    unresolvedCount: number;
    setupHint: string;
  };
};

export type TtlockPublicLock = {
  id: string;
  externalLockId: string;
  name: string;
  mac: string | null;
  model: string | null;
  battery: number | null;
  hasGateway: boolean;
  remoteUnlock: boolean | null;
  /** API UI uchun — faqat onlineStatus dan hosil qilinadi (canonical emas) */
  online: boolean | null;
  /** Canonical online holat */
  onlineStatus: "UNKNOWN" | "ONLINE" | "OFFLINE";
  isActive: boolean;
  lastSyncedAt: string | null;
};
