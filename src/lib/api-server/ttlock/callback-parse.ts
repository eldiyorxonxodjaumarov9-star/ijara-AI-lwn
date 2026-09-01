/**
 * TTLock callback payload parse — form-urlencoded, sanitized (secret yo‘q).
 * @see https://euopen.ttlock.com/documentPages/htmlPages/cloud/lockRecord/notifyEn.html
 */

import { createHash } from "crypto";

import {
  TTLOCK_CALLBACK_EXTERNAL_ID_RE,
  TTLOCK_CALLBACK_MAX_FORM_FIELDS,
  TTLOCK_CALLBACK_MAX_RECORDS,
} from "@/lib/api-server/ttlock/callback-config";
import type { TtlockLockRecordItem } from "@/lib/api-server/ttlock/types";

export type SanitizedCallbackRecord = {
  recordType?: number;
  success?: number;
  username?: string;
  lockDate?: number;
  serverDate?: number;
  electricQuantity?: number;
  recordId?: string;
  subRecordType?: number;
};

export type ParsedTtlockCallback = {
  notifyType: number | null;
  lockId: string | null;
  lockMac: string | null;
  gatewayId: string | null;
  isOnline: number | null;
  electricQuantity: number | null;
  records: SanitizedCallbackRecord[];
  /** Allow-listed qo‘shimcha maydonlar (secret yo‘q) */
  metadata: Record<string, string | number | boolean | null>;
};

const ALLOWED_FORM_KEYS = new Set([
  "notifyType",
  "lockId",
  "lockMac",
  "gatewayId",
  "gatewayMac",
  "isOnline",
  "electricQuantity",
  "records",
  "recordType",
  "success",
  "username",
  "lockDate",
  "serverDate",
  "uid",
  "openId",
  "clientId",
  "name",
  "doorSensorId",
  "mac",
]);

const SECRET_FORM_KEYS =
  /keyboardPwd|password|passcode|cardNo|cardNumber|token|secret|credential/i;

export type CallbackParseErrorCode =
  | "BODY_TOO_MANY_FIELDS"
  | "BODY_TOO_MANY_RECORDS"
  | "INVALID_LOCK_ID"
  | "INVALID_GATEWAY_ID"
  | "INVALID_NOTIFY_TYPE";

export class CallbackParseError extends Error {
  constructor(
    message: string,
    readonly code: CallbackParseErrorCode
  ) {
    super(message);
    this.name = "CallbackParseError";
  }
}

export function validateCallbackPayload(parsed: ParsedTtlockCallback): void {
  if (parsed.lockId && !TTLOCK_CALLBACK_EXTERNAL_ID_RE.test(parsed.lockId)) {
    throw new CallbackParseError("Noto‘g‘ri lockId", "INVALID_LOCK_ID");
  }
  if (
    parsed.gatewayId &&
    !TTLOCK_CALLBACK_EXTERNAL_ID_RE.test(parsed.gatewayId)
  ) {
    throw new CallbackParseError("Noto‘g‘ri gatewayId", "INVALID_GATEWAY_ID");
  }
  if (
    parsed.notifyType != null &&
    (!Number.isFinite(parsed.notifyType) || parsed.notifyType < 0)
  ) {
    throw new CallbackParseError("Noto‘g‘ri notifyType", "INVALID_NOTIFY_TYPE");
  }
  if (parsed.records.length > TTLOCK_CALLBACK_MAX_RECORDS) {
    throw new CallbackParseError(
      "Record limiti oshdi",
      "BODY_TOO_MANY_RECORDS"
    );
  }
}

export function hashCallbackPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function parseCallbackFormBody(rawBody: string): ParsedTtlockCallback {
  const params = new URLSearchParams(rawBody);
  const fieldCount = [...params.keys()].length;
  if (fieldCount > TTLOCK_CALLBACK_MAX_FORM_FIELDS) {
    throw new CallbackParseError(
      "Form maydonlari limiti oshdi",
      "BODY_TOO_MANY_FIELDS"
    );
  }

  const metadata: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of params.entries()) {
    if (SECRET_FORM_KEYS.test(key)) continue;
    if (!ALLOWED_FORM_KEYS.has(key)) continue;
    if (key === "records") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (["notifyType", "lockId", "isOnline", "electricQuantity", "recordType", "success", "lockDate", "serverDate", "gatewayId", "doorSensorId"].includes(key)) {
      const n = Number(trimmed);
      metadata[key] = Number.isFinite(n) ? n : trimmed;
    } else {
      metadata[key] = trimmed;
    }
  }

  const notifyTypeRaw = params.get("notifyType");
  const notifyType =
    notifyTypeRaw != null && notifyTypeRaw !== ""
      ? Number(notifyTypeRaw)
      : null;

  const lockIdRaw = params.get("lockId");
  const lockId =
    lockIdRaw != null && lockIdRaw.trim() !== "" ? lockIdRaw.trim() : null;

  const gatewayIdRaw = params.get("gatewayId");
  const gatewayId =
    gatewayIdRaw != null && gatewayIdRaw.trim() !== ""
      ? gatewayIdRaw.trim()
      : null;

  const isOnlineRaw = params.get("isOnline");
  const isOnline =
    isOnlineRaw != null && isOnlineRaw !== "" && Number.isFinite(Number(isOnlineRaw))
      ? Number(isOnlineRaw)
      : null;

  const eqRaw = params.get("electricQuantity");
  const electricQuantity =
    eqRaw != null && eqRaw !== "" && Number.isFinite(Number(eqRaw))
      ? Number(eqRaw)
      : null;

  const records = parseRecordsField(params.get("records"));
  if (records.length > TTLOCK_CALLBACK_MAX_RECORDS) {
    throw new CallbackParseError(
      "Record limiti oshdi",
      "BODY_TOO_MANY_RECORDS"
    );
  }

  const parsed: ParsedTtlockCallback = {
    notifyType: notifyType != null && Number.isFinite(notifyType) ? notifyType : null,
    lockId,
    lockMac: params.get("lockMac")?.trim() || null,
    gatewayId,
    isOnline,
    electricQuantity,
    records,
    metadata,
  };

  validateCallbackPayload(parsed);
  return parsed;
}

function parseRecordsField(raw: string | null): SanitizedCallbackRecord[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizeRecordItem(item))
      .filter((r): r is SanitizedCallbackRecord => r != null);
  } catch {
    return [];
  }
}

function sanitizeRecordItem(item: unknown): SanitizedCallbackRecord | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const out: SanitizedCallbackRecord = {};
  if (o.recordType != null) out.recordType = Number(o.recordType);
  if (o.success != null) out.success = Number(o.success);
  if (typeof o.username === "string") out.username = o.username.trim();
  if (o.lockDate != null) out.lockDate = Number(o.lockDate);
  if (o.serverDate != null) out.serverDate = Number(o.serverDate);
  if (o.electricQuantity != null) out.electricQuantity = Number(o.electricQuantity);
  if (o.recordId != null) out.recordId = String(o.recordId);
  if (o.subRecordType != null) out.subRecordType = Number(o.subRecordType);
  return out;
}

export function recordsToLockRecordItems(
  records: SanitizedCallbackRecord[]
): TtlockLockRecordItem[] {
  return records.map((r) => ({
    recordType: r.recordType,
    success: r.success,
    username: r.username,
    lockDate: r.lockDate,
    serverDate: r.serverDate,
    recordId: r.recordId,
  }));
}

export function buildCallbackDeliveryFingerprint(input: {
  connectionId: string | null;
  notifyType: number | null;
  externalLockId: string | null;
  externalGatewayId: string | null;
  payloadHash: string;
}): string {
  const base = [
    input.connectionId ?? "unknown",
    input.notifyType != null ? String(input.notifyType) : "",
    input.externalLockId ?? "",
    input.externalGatewayId ?? "",
    input.payloadHash,
  ].join("|");
  return createHash("sha256").update(base).digest("hex");
}

export function buildCallbackRecordFingerprint(input: {
  connectionId: string | null;
  externalLockId: string;
  recordType: number;
  serverDateMs: number;
  recordId?: string | null;
}): string {
  const base = [
    input.connectionId ?? "unknown",
    input.externalLockId,
    String(input.recordType),
    String(input.serverDateMs),
    input.recordId ?? "",
  ].join("|");
  return createHash("sha256").update(base).digest("hex");
}
