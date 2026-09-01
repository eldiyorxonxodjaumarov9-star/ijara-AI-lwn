/**
 * TTLock 8-bosqich — kirish tarixi sync (lockRecord/list → RoomAccessLogEvent).
 */

import type { User } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import {
  ACCESS_LOG_SOURCE_SYNC,
  upsertLockRecordToAccessLog,
} from "@/lib/api-server/ttlock/access-log-upsert";
import { fetchLockRecordPage } from "@/lib/api-server/ttlock/client";
import {
  findConnectionByOwner,
  requireTtlockDb,
} from "@/lib/api-server/ttlock/db";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import {
  assertTtlockOwnerRole,
  getValidAccessToken,
} from "@/lib/api-server/ttlock/service";
import { buildRemoteControlStatus } from "@/lib/api-server/ttlock/remote-control";

export {
  buildRecordFingerprint,
  mapLockRecordDirection,
  mapLockRecordMethod,
  mapLockRecordType,
  sanitizePersonLabel,
} from "@/lib/api-server/ttlock/access-log-map";

const OVERLAP_MS = 5 * 60 * 1000;
const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export function computeHistorySyncWindow(lastSyncedAt: Date | null): {
  startDateMs: number;
  endDateMs: number;
} {
  const now = Date.now();
  const endDateMs = now;
  if (!lastSyncedAt) {
    return { startDateMs: now - SIX_MONTHS_MS, endDateMs };
  }
  const start = Math.max(
    lastSyncedAt.getTime() - OVERLAP_MS,
    now - SIX_MONTHS_MS
  );
  return { startDateMs: start, endDateMs };
}

export async function syncRoomAccessHistory(input: {
  user: User;
  propertyId: string;
}): Promise<{
  newRecords: number;
  scannedRecords: number;
  lastSyncedAt: string;
  userMessage: string;
}> {
  assertTtlockOwnerRole(input.user);
  const status = await buildRemoteControlStatus({
    user: input.user,
    propertyId: input.propertyId,
  });
  if (!status.canSyncHistory) {
    throw new TtlockError(
      status.historyReason ?? "Kirish tarixini yangilab bo‘lmadi.",
      "TTLOCK_ROOM_LOCK_MISSING",
      400
    );
  }

  await requireTtlockDb();
  const settings = await prisma.roomLockSettings.findUnique({
    where: { propertyId: input.propertyId },
    include: { ttlockCachedLock: true },
  });
  const lock = settings?.ttlockCachedLock;
  if (!lock) {
    throw new TtlockError(
      "Xonaga TTLock qulfi biriktirilmagan.",
      "TTLOCK_ROOM_LOCK_MISSING",
      400
    );
  }

  const connection = await findConnectionByOwner(input.user.id);
  if (!connection?.accessTokenEncrypted) {
    throw new TtlockError(
      "TTLock hisobi hali ulanmagan.",
      "TTLOCK_NOT_CONNECTED",
      400
    );
  }

  const { startDateMs, endDateMs } = computeHistorySyncWindow(
    settings.lastAccessHistorySyncedAt
  );
  const accessToken = await getValidAccessToken(connection, input.user.id);

  let pageNo = 1;
  let scannedRecords = 0;
  let newRecords = 0;
  const pageSize = 100;

  for (let guard = 0; guard < 100; guard++) {
    const page = await fetchLockRecordPage({
      accessToken,
      lockId: lock.externalLockId,
      pageNo,
      pageSize,
      startDateMs,
      endDateMs,
    });
    const list = page.list ?? [];
    scannedRecords += list.length;

    for (const item of list) {
      const { created } = await upsertLockRecordToAccessLog({
        item,
        lockExternalId: lock.externalLockId,
        propertyId: input.propertyId,
        ttlockCachedLockId: lock.id,
        source: ACCESS_LOG_SOURCE_SYNC,
      });
      if (created) newRecords += 1;
    }

    const pages = page.pages ?? 1;
    if (pageNo >= pages || list.length < pageSize) break;
    pageNo += 1;
  }

  const syncedAt = new Date();
  await prisma.roomLockSettings.update({
    where: { propertyId: input.propertyId },
    data: { lastAccessHistorySyncedAt: syncedAt },
  });

  return {
    newRecords,
    scannedRecords,
    lastSyncedAt: syncedAt.toISOString(),
    userMessage: "Kirish tarixi yangilandi.",
  };
}
