/**
 * RoomAccessLogEvent — canonical upsert (callback + manual sync).
 */

import { prisma } from "@/lib/api-server/prisma";
import type { TtlockLockRecordItem } from "@/lib/api-server/ttlock/types";
import {
  buildRecordFingerprint,
  mapLockRecordDirection,
  mapLockRecordMethod,
  mapLockRecordType,
  sanitizePersonLabel,
} from "@/lib/api-server/ttlock/access-log-map";

export const ACCESS_LOG_SOURCE_SYNC = "TTLock sync";
export const ACCESS_LOG_SOURCE_CALLBACK = "TTLock callback";

export type UpsertAccessLogInput = {
  propertyId: string;
  ttlockCachedLockId: string;
  occurredAt: Date;
  eventType: string;
  method: string;
  direction: string;
  result: string;
  source: string;
  personLabel: string | null;
  externalRecordId: string | null;
  recordFingerprint: string | null;
};

function isUniqueViolation(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export async function upsertRoomAccessLogEvent(
  input: UpsertAccessLogInput
): Promise<{ created: boolean }> {
  try {
    await prisma.roomAccessLogEvent.create({ data: input });
    return { created: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { created: false };
    throw err;
  }
}

export function buildAccessLogFromLockRecord(input: {
  item: TtlockLockRecordItem;
  lockExternalId: string;
  propertyId: string;
  ttlockCachedLockId: string;
  source: string;
  personLabelOverride?: string | null;
}): UpsertAccessLogInput | null {
  const recordType = Number(input.item.recordType ?? 0);
  const success = Number(input.item.success ?? 0);
  const serverDateMs = Number(input.item.serverDate ?? input.item.lockDate ?? 0);
  if (!serverDateMs) return null;

  const externalRecordId =
    input.item.recordId != null ? String(input.item.recordId) : null;
  const fingerprint = externalRecordId
    ? null
    : buildRecordFingerprint({
        lockExternalId: input.lockExternalId,
        serverDateMs,
        recordType,
        success,
        username: input.item.username,
      });

  return {
    propertyId: input.propertyId,
    ttlockCachedLockId: input.ttlockCachedLockId,
    occurredAt: new Date(serverDateMs),
    personLabel:
      input.personLabelOverride !== undefined
        ? input.personLabelOverride
        : sanitizePersonLabel(input.item.username),
    eventType: mapLockRecordType(recordType),
    method: mapLockRecordMethod(recordType),
    direction: mapLockRecordDirection(recordType),
    result: success === 1 ? "success" : "failure",
    source: input.source,
    externalRecordId,
    recordFingerprint: fingerprint,
  };
}

export async function upsertLockRecordToAccessLog(input: {
  item: TtlockLockRecordItem;
  lockExternalId: string;
  propertyId: string;
  ttlockCachedLockId: string;
  source: string;
  personLabelOverride?: string | null;
}): Promise<{ created: boolean; skipped: boolean }> {
  const row = buildAccessLogFromLockRecord(input);
  if (!row) return { created: false, skipped: true };
  const res = await upsertRoomAccessLogEvent(row);
  return { created: res.created, skipped: false };
}
