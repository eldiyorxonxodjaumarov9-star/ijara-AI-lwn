export type TtlockErrorCode =
  | "TTLOCK_NOT_CONFIGURED"
  | "TTLOCK_ENCRYPTION_KEY_MISSING"
  | "TTLOCK_ENCRYPTION_KEY_INVALID"
  | "TTLOCK_ENCRYPT_EMPTY"
  | "TTLOCK_DECRYPT_EMPTY"
  | "TTLOCK_DECRYPT_FORMAT"
  | "TTLOCK_DECRYPT_FAILED"
  | "TTLOCK_HTTP_ERROR"
  | "TTLOCK_API_ERROR"
  | "TTLOCK_RATE_LIMITED"
  | "TTLOCK_TIMEOUT"
  | "TTLOCK_AUTH_REQUIRED"
  | "TTLOCK_FORBIDDEN"
  | "TTLOCK_NOT_CONNECTED"
  | "TTLOCK_TOKEN_EXPIRED"
  | "TTLOCK_DB_UNAVAILABLE"
  | "DATABASE_MIGRATION_REQUIRED"
  | "TTLOCK_LOCK_ALREADY_ASSIGNED"
  | "TTLOCK_LOCK_HAS_ACTIVE_ACCESS"
  | "TTLOCK_LOCK_INACTIVE"
  | "TTLOCK_LOCK_NOT_FOUND"
  | "TTLOCK_ROOM_LOCK_MISSING"
  | "TTLOCK_RECEIVER_REQUIRED"
  | "TTLOCK_RESULT_UNKNOWN"
  | "TTLOCK_GATEWAY_REQUIRED"
  | "TTLOCK_GATEWAY_OFFLINE"
  | "TTLOCK_REMOTE_UNLOCK_UNSUPPORTED"
  | "TTLOCK_REMOTE_LOCK_UNSUPPORTED"
  | "TTLOCK_COMMAND_IN_PROGRESS"
  | "TTLOCK_COMMAND_RESULT_UNKNOWN"
  | "TTLOCK_NO_REVOCABLE_ACCESS"
  | "TTLOCK_UNKNOWN";

export class TtlockError extends Error {
  code: TtlockErrorCode;
  httpStatus: number;
  ttlockErrcode?: number;

  constructor(
    message: string,
    code: TtlockErrorCode,
    httpStatus = 400,
    ttlockErrcode?: number
  ) {
    super(message);
    this.name = "TtlockError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.ttlockErrcode = ttlockErrcode;
  }
}

/** Foydalanuvchiga o‘zbekcha xabar */
export function mapTtlockErrorToUz(err: unknown): {
  code: string;
  message: string;
  httpStatus: number;
} {
  if (err instanceof TtlockError) {
    return {
      code: err.code,
      message: err.message,
      httpStatus: err.httpStatus,
    };
  }
  return {
    code: "TTLOCK_UNKNOWN",
    message: "TTLock so'rovida kutilmagan xatolik",
    httpStatus: 500,
  };
}

export function mapTtlockBusinessCode(errcode: number, errmsg?: string): TtlockError {
  if (errcode === -3 || errcode === 10003 || errcode === 10004) {
    return new TtlockError(
      "TTLock token muddati tugagan yoki yaroqsiz. Qayta ulang.",
      "TTLOCK_TOKEN_EXPIRED",
      401,
      errcode
    );
  }
  if (errcode === -2018 || errcode === 20001) {
    return new TtlockError(
      "TTLock so'rov limiti oshdi. Birozdan keyin qayta urinib ko'ring.",
      "TTLOCK_RATE_LIMITED",
      429,
      errcode
    );
  }
  const safeMsg =
    typeof errmsg === "string" && errmsg.trim() && !/token|secret|password/i.test(errmsg)
      ? errmsg.trim()
      : "TTLock API xatosi";
  return new TtlockError(safeMsg, "TTLOCK_API_ERROR", 502, errcode);
}
