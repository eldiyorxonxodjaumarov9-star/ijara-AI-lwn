/**
 * TTLock callback / lock record → semantic event mapping (markazlashtirilgan).
 * @see https://euopen.ttlock.com/doc/api/v3/lockRecord/list
 */

export type TtlockSemanticEvent =
  | "LOCK_OPENED"
  | "LOCK_CLOSED"
  | "PASSCODE_ACCESS"
  | "CARD_ACCESS"
  | "FAILED_ATTEMPT"
  | "GATEWAY_ONLINE"
  | "GATEWAY_OFFLINE"
  | "DEVICE_EVENT"
  | "UNKNOWN";

const LOCK_CLOSED_TYPES = new Set([30, 33, 34, 35, 36, 45, 47]);
const LOCK_OPENED_TYPES = new Set([1, 3, 4, 7, 8, 11, 12, 29, 31, 32, 37, 46]);
const PASSCODE_TYPES = new Set([4, 34, 48]);
const CARD_TYPES = new Set([7]);
const DEVICE_TYPES = new Set([44, 123]);

export function mapRecordTypeToSemantic(
  recordType: number | undefined,
  success: number | undefined
): TtlockSemanticEvent {
  if (recordType == null || !Number.isFinite(recordType)) return "UNKNOWN";
  const ok = success === 1;

  if (recordType === 48 || success === 0) return "FAILED_ATTEMPT";
  if (PASSCODE_TYPES.has(recordType)) {
    return ok ? "PASSCODE_ACCESS" : "FAILED_ATTEMPT";
  }
  if (CARD_TYPES.has(recordType)) {
    return ok ? "CARD_ACCESS" : "FAILED_ATTEMPT";
  }
  if (LOCK_CLOSED_TYPES.has(recordType)) return "LOCK_CLOSED";
  if (LOCK_OPENED_TYPES.has(recordType)) return "LOCK_OPENED";
  if (DEVICE_TYPES.has(recordType)) return "DEVICE_EVENT";
  return "UNKNOWN";
}

export function mapGatewayOnlineToSemantic(
  isOnline: number | boolean | null | undefined
): TtlockSemanticEvent | null {
  if (isOnline === 1 || isOnline === true) return "GATEWAY_ONLINE";
  if (isOnline === 0 || isOnline === false) return "GATEWAY_OFFLINE";
  return null;
}

export function semanticEventUiLabel(event: TtlockSemanticEvent): string {
  switch (event) {
    case "LOCK_OPENED":
      return "Qulf ochildi";
    case "LOCK_CLOSED":
      return "Qulf yopildi";
    case "PASSCODE_ACCESS":
      return "Parol bilan kirish";
    case "CARD_ACCESS":
      return "Karta bilan kirish";
    case "FAILED_ATTEMPT":
      return "Muvaffaqiyatsiz kirish urinishi";
    case "GATEWAY_ONLINE":
      return "Gateway onlayn";
    case "GATEWAY_OFFLINE":
      return "Gateway oflayn";
    case "DEVICE_EVENT":
      return "Qurilma hodisasi";
    default:
      return "Noma'lum hodisa";
  }
}
