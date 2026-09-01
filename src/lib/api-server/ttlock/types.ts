import type {
  TtlockConnectionStatus,
  TtlockPublicLock,
  TtlockPublicStatus,
} from "@/types/ttlock";

export type {
  TtlockConnectionStatus,
  TtlockPublicLock,
  TtlockPublicStatus,
};

export const TTLOCK_ENDPOINTS = {
  /** Rasmiy: POST /oauth2/token (get + refresh) */
  oauthToken: "/oauth2/token",
  /** Rasmiy: POST /v3/lock/list */
  lockList: "/v3/lock/list",
  /**
   * Rasmiy EU Open API: POST /v3/keyboardPwd/get
   * @see https://euopen.ttlock.com/doc/api/v3/keyboardPwd/get
   */
  keyboardPwdGet: "/v3/keyboardPwd/get",
  /**
   * Rasmiy EU Open API: POST /v3/keyboardPwd/delete
   * @see https://euopen.ttlock.com/doc/api/v3/keyboardPwd/delete
   */
  keyboardPwdDelete: "/v3/keyboardPwd/delete",
  /**
   * Rasmiy EU Open API: POST /v3/key/send
   * @see https://euopen.ttlock.com/doc/api/v3/key/send
   */
  keySend: "/v3/key/send",
  /**
   * Rasmiy EU Open API: POST /v3/key/delete
   * @see https://euopen.ttlock.com/doc/api/v3/key/delete
   */
  keyDelete: "/v3/key/delete",
  /**
   * Rasmiy EU Open API: POST /v3/lock/unlock
   * @see https://euopen.ttlock.com/doc/api/v3/lock/unlock
   */
  lockUnlock: "/v3/lock/unlock",
  /**
   * Rasmiy EU Open API: POST /v3/lock/lock
   * @see https://euopen.ttlock.com/documentPages/htmlPages/cloud/gateway/lockEn.html
   */
  lockLock: "/v3/lock/lock",
  /**
   * Rasmiy EU Open API: GET /v3/lockRecord/list
   * @see https://euopen.ttlock.com/doc/api/v3/lockRecord/list
   */
  lockRecordList: "/v3/lockRecord/list",
  /**
   * Rasmiy EU Open API: GET /v3/lock/detail
   * @see https://euopen.ttlock.com/documentPages/htmlPages/cloud/lock/detailEn.html
   */
  lockDetail: "/v3/lock/detail",
  /**
   * Rasmiy EU Open API: GET /v3/gateway/detail
   * @see https://euopen.ttlock.com/documentPages/htmlPages/cloud/gateway/detailEn.html
   */
  gatewayDetail: "/v3/gateway/detail",
} as const;

export type TtlockTokenResponse = {
  access_token: string;
  refresh_token: string;
  uid?: number;
  expires_in: number;
  scope?: string;
  errcode?: number;
  errmsg?: string;
};

export type TtlockLockListItem = {
  lockId: number | string;
  lockName?: string;
  lockAlias?: string;
  lockMac?: string;
  electricQuantity?: number;
  hasGateway?: number;
  specialValue?: number;
  keyboardPwdVersion?: number;
  /** 1 = Wi‑Fi qulf (rasmiy lock/list) */
  wifiLock?: number;
  groupId?: number;
  groupName?: string;
  date?: number;
  /** Maxfiy — saqlanmasin / log qilinmasin */
  lockData?: string;
};

export type TtlockLockListResponse = {
  list?: TtlockLockListItem[];
  pages?: number;
  pageNo?: number;
  pageSize?: number;
  total?: number;
  errcode?: number;
  errmsg?: string;
};

export type TtlockKeyboardPwdGetResponse = {
  keyboardPwd?: string | number;
  keyboardPwdId?: string | number;
  errcode?: number;
  errmsg?: string;
};

export type TtlockKeyboardPwdDeleteResponse = {
  errcode?: number;
  errmsg?: string;
};

export type TtlockKeySendResponse = {
  keyId?: string | number;
  errcode?: number;
  errmsg?: string;
};

export type TtlockKeyDeleteResponse = {
  errcode?: number;
  errmsg?: string;
};

export type TtlockLockCommandResponse = {
  errcode?: number;
  errmsg?: string;
  description?: string;
};

export type TtlockLockRecordItem = {
  lockId?: number | string;
  recordType?: number;
  success?: number;
  username?: string;
  keyboardPwd?: string;
  lockDate?: number;
  serverDate?: number;
  recordId?: number | string;
};

export type TtlockLockRecordListResponse = {
  list?: TtlockLockRecordItem[];
  pageNo?: number;
  pageSize?: number;
  pages?: number;
  total?: number;
  errcode?: number;
  errmsg?: string;
};

export type TtlockLockDetailResponse = {
  lockId?: number | string;
  lockName?: string;
  lockAlias?: string;
  lockMac?: string;
  electricQuantity?: number;
  hasGateway?: number;
  featureValue?: string;
  errcode?: number;
  errmsg?: string;
};

export type TtlockGatewayDetailResponse = {
  gatewayId?: number | string;
  gatewayMac?: string;
  gatewayName?: string;
  isOnline?: number;
  lockNum?: number;
  errcode?: number;
  errmsg?: string;
};

/** SpecialValue bitlari (hujjat): feature flags — faqat xavfsiz inferensiya */
export function inferRemoteUnlock(specialValue: number | null | undefined): boolean | null {
  if (specialValue == null || !Number.isFinite(specialValue)) return null;
  return (specialValue & 0x10) !== 0 || (specialValue & 0x400) !== 0;
}

/**
 * Lock list javobidagi wifiLock (1=Wi‑Fi qulf) — rasmiy maydon.
 * @see https://euopen.ttlock.com/doc/api/v3/lock/list
 */
export function inferWifiRemoteCapable(input: {
  wifiLock?: number | null;
  capabilities?: Record<string, unknown> | null;
}): boolean | null {
  if (input.wifiLock === 1) return true;
  if (input.wifiLock === 0) return false;
  const caps = input.capabilities;
  if (caps && typeof caps.wifiRemoteCapable === "boolean") {
    return caps.wifiRemoteCapable;
  }
  return null;
}
