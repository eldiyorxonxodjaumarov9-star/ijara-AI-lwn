/**
 * Lock record → access log mapping (callback + manual sync).
 */

import { createHash } from "crypto";

const RECORD_TYPE_LABELS: Record<number, string> = {
  1: "Ilova orqali ochish",
  3: "Gateway orqali ochish",
  4: "Parol bilan ochish",
  7: "IC karta",
  8: "Barmoq izi",
  11: "Bluetooth",
  12: "Gateway ochish",
  29: "Kutilmagan ochish",
  30: "Eshik yopildi",
  31: "Eshik ochildi",
  32: "Ichkaridan ochish",
  33: "Barmoq izi bilan yopish",
  34: "Parol bilan yopish",
  37: "Masofadan boshqaruv",
  45: "Avtomatik qulflash",
  48: "Noto‘g‘ri parol urinishi",
};

export function mapLockRecordType(recordType: number | undefined): string {
  if (recordType == null || !Number.isFinite(recordType)) return "UNKNOWN";
  return RECORD_TYPE_LABELS[recordType] ?? `UNKNOWN_${recordType}`;
}

export function mapLockRecordDirection(recordType: number | undefined): string {
  if (recordType == null) return "unknown";
  const lockTypes = new Set([30, 33, 34, 45]);
  const unlockTypes = new Set([1, 3, 4, 7, 8, 11, 12, 29, 31, 32, 37, 46]);
  if (lockTypes.has(recordType)) return "exit";
  if (unlockTypes.has(recordType)) return "entry";
  return "unknown";
}

export function mapLockRecordMethod(recordType: number | undefined): string {
  if (recordType == null) return "unknown";
  if ([4, 34, 48].includes(recordType)) return "passcode";
  if ([7].includes(recordType)) return "card";
  if ([8, 33].includes(recordType)) return "fingerprint";
  if ([1, 11].includes(recordType)) return "app";
  if ([3, 12, 37].includes(recordType)) return "remote";
  if ([45].includes(recordType)) return "auto";
  return "other";
}

export function sanitizePersonLabel(username: string | undefined): string | null {
  if (!username?.trim()) return null;
  const v = username.trim();
  if (/^\d{4,}$/.test(v.replace(/\D/g, ""))) {
    const d = v.replace(/\D/g, "");
    return d.length >= 4 ? `${d.slice(0, 3)}***${d.slice(-2)}` : null;
  }
  if (v.includes("@")) {
    const [u, domain] = v.split("@");
    if (!domain) return null;
    return `${u.slice(0, 1)}***@${domain}`;
  }
  if (v.length <= 2) return "*";
  return `${v.slice(0, 1)}***`;
}

export function buildRecordFingerprint(input: {
  lockExternalId: string;
  serverDateMs: number;
  recordType: number;
  success: number;
  username?: string;
}): string {
  const base = `${input.lockExternalId}|${input.serverDateMs}|${input.recordType}|${input.success}|${(input.username ?? "").trim()}`;
  return createHash("sha256").update(base).digest("hex");
}

export function unknownPersonLabel(): string {
  return "Noma'lum foydalanuvchi";
}
