/**
 * TTLock callback processing — verify-by-fetch, business event upsert.
 * Callback payload’ga ko‘r-ko‘rona ishonilmaydi.
 */

import { prisma } from "@/lib/api-server/prisma";
import {
  ACCESS_LOG_SOURCE_CALLBACK,
  upsertLockRecordToAccessLog,
} from "@/lib/api-server/ttlock/access-log-upsert";
import { buildRecordFingerprint } from "@/lib/api-server/ttlock/access-log-map";
import {
  claimCallbackInbox,
  markInboxFailedWithRetry,
  markInboxStatus,
} from "@/lib/api-server/ttlock/callback-inbox";
import {
  mapGatewayOnlineToSemantic,
  mapRecordTypeToSemantic,
  type TtlockSemanticEvent,
} from "@/lib/api-server/ttlock/callback-event-map";
import {
  parseCallbackFormBody,
  recordsToLockRecordItems,
  type ParsedTtlockCallback,
  type SanitizedCallbackRecord,
} from "@/lib/api-server/ttlock/callback-parse";
import {
  fetchGatewayDetail,
  fetchLockDetail,
  fetchLockRecordPage,
} from "@/lib/api-server/ttlock/client";
import {
  findActiveLockMatchesByExternalId,
  findGatewayByExternalId,
  findPropertyForCachedLock,
  touchConnectionCallbackTimestamps,
  updateGatewayOnlineIfNewer,
  updateLockBatteryIfNewer,
  type LockConnectionMatch,
} from "@/lib/api-server/ttlock/db";
import { mapOnlineStatus } from "@/lib/api-server/ttlock/persistence";
import { getValidAccessToken } from "@/lib/api-server/ttlock/service";
import type { TtlockLockRecordItem } from "@/lib/api-server/ttlock/types";

const VERIFY_WINDOW_MS = 5 * 60 * 1000;
const MAX_RECORDS_PER_CALLBACK = 50;

export function inferPrimarySemanticEvent(
  parsed: ParsedTtlockCallback
): TtlockSemanticEvent {
  if (parsed.notifyType === 1 && parsed.records.length > 0) {
    const first = parsed.records[0];
    return mapRecordTypeToSemantic(first.recordType, first.success);
  }
  const gw = mapGatewayOnlineToSemantic(parsed.isOnline);
  if (gw) return gw;
  if (parsed.electricQuantity != null) return "DEVICE_EVENT";
  return "UNKNOWN";
}

export function resolveLockConnection(
  matches: LockConnectionMatch[]
):
  | { ok: true; match: LockConnectionMatch }
  | { ok: false; reason: "unknown_lock" | "ambiguous_connection" } {
  if (matches.length === 0) return { ok: false, reason: "unknown_lock" };
  const connectionIds = new Set(matches.map((m) => m.connection.id));
  if (connectionIds.size > 1) {
    return { ok: false, reason: "ambiguous_connection" };
  }
  return { ok: true, match: matches[0] };
}

export function buildSanitizedMetadata(parsed: ParsedTtlockCallback) {
  return {
    ...parsed.metadata,
    recordHints: parsed.records.map((r) => ({
      recordType: r.recordType ?? null,
      success: r.success ?? null,
      serverDate: r.serverDate ?? null,
      lockDate: r.lockDate ?? null,
      recordId: r.recordId ?? null,
      username: r.username ?? null,
    })),
  };
}

export function recordHintsFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): SanitizedCallbackRecord[] {
  const hints = metadata?.recordHints;
  if (!Array.isArray(hints)) return [];
  const out: SanitizedCallbackRecord[] = [];
  for (const h of hints) {
    if (!h || typeof h !== "object") continue;
    const o = h as Record<string, unknown>;
    out.push({
      recordType: o.recordType != null ? Number(o.recordType) : undefined,
      success: o.success != null ? Number(o.success) : undefined,
      serverDate: o.serverDate != null ? Number(o.serverDate) : undefined,
      lockDate: o.lockDate != null ? Number(o.lockDate) : undefined,
      recordId: o.recordId != null ? String(o.recordId) : undefined,
      username: typeof o.username === "string" ? o.username : undefined,
    });
  }
  return out;
}

function matchVerifiedRecord(
  candidates: TtlockLockRecordItem[],
  hint: TtlockLockRecordItem,
  lockExternalId: string
): TtlockLockRecordItem | null {
  const serverDateMs = Number(hint.serverDate ?? hint.lockDate ?? 0);
  const recordType = Number(hint.recordType ?? 0);
  const success = Number(hint.success ?? 0);
  const hintId = hint.recordId != null ? String(hint.recordId) : null;
  const hintFp = hintId
    ? null
    : buildRecordFingerprint({
        lockExternalId,
        serverDateMs,
        recordType,
        success,
        username: hint.username,
      });

  for (const item of candidates) {
    if (hintId && item.recordId != null && String(item.recordId) === hintId) {
      return item;
    }
    if (hintFp) {
      const itemMs = Number(item.serverDate ?? item.lockDate ?? 0);
      const itemFp = buildRecordFingerprint({
        lockExternalId,
        serverDateMs: itemMs,
        recordType: Number(item.recordType ?? 0),
        success: Number(item.success ?? 0),
        username: item.username,
      });
      if (itemFp === hintFp) return item;
    }
  }
  return null;
}

async function verifyLockRecordViaApi(input: {
  accessToken: string;
  lockExternalId: string;
  hint: TtlockLockRecordItem;
}): Promise<TtlockLockRecordItem | null> {
  const serverDateMs = Number(input.hint.serverDate ?? input.hint.lockDate ?? 0);
  if (!serverDateMs) return null;
  const page = await fetchLockRecordPage({
    accessToken: input.accessToken,
    lockId: input.lockExternalId,
    pageNo: 1,
    pageSize: 100,
    startDateMs: serverDateMs - VERIFY_WINDOW_MS,
    endDateMs: serverDateMs + VERIFY_WINDOW_MS,
  });
  if (typeof page.errcode === "number" && page.errcode !== 0) return null;
  return matchVerifiedRecord(page.list ?? [], input.hint, input.lockExternalId);
}

async function processLockRecordsNotify(input: {
  parsed: ParsedTtlockCallback;
  match: LockConnectionMatch;
  inboxId: string;
}): Promise<{ processed: number; verified: number; unresolved: boolean }> {
  const property = await findPropertyForCachedLock(input.match.lock.id);
  if (!property) {
    await markInboxStatus(input.inboxId, "UNRESOLVED", {
      code: "TTLOCK_ROOM_LOCK_MISSING",
      message: "Qulf xonaga biriktirilmagan.",
    });
    return { processed: 0, verified: 0, unresolved: true };
  }

  const accessToken = await getValidAccessToken(
    input.match.connection,
    input.match.connection.ownerUserId
  );

  const hints = recordsToLockRecordItems(input.parsed.records).slice(
    0,
    MAX_RECORDS_PER_CALLBACK
  );
  let processed = 0;
  let verified = 0;

  for (const hint of hints) {
    const confirmed = await verifyLockRecordViaApi({
      accessToken,
      lockExternalId: input.match.lock.externalLockId,
      hint,
    });
    if (!confirmed) continue;
    verified += 1;

    const { created } = await upsertLockRecordToAccessLog({
      item: confirmed,
      lockExternalId: input.match.lock.externalLockId,
      propertyId: property.propertyId,
      ttlockCachedLockId: input.match.lock.id,
      source: ACCESS_LOG_SOURCE_CALLBACK,
    });
    if (created) processed += 1;

    const eq = input.parsed.records.find(
      (r) =>
        r.serverDate === confirmed.serverDate &&
        r.recordType === confirmed.recordType
    )?.electricQuantity;
    if (eq != null && eq >= 0 && eq <= 100) {
      await updateLockBatteryIfNewer({
        lockId: input.match.lock.id,
        battery: eq,
        eventAt: new Date(
          Number(confirmed.serverDate ?? confirmed.lockDate ?? Date.now())
        ),
      });
    }
  }

  return { processed, verified, unresolved: false };
}

function resolveProviderEventAt(parsed: ParsedTtlockCallback): Date {
  const ms =
    parsed.records[0]?.serverDate ??
    parsed.records[0]?.lockDate ??
    null;
  if (ms != null && Number.isFinite(ms)) return new Date(ms);
  return new Date();
}

async function processGatewayStatusWakeUp(input: {
  parsed: ParsedTtlockCallback;
  match: LockConnectionMatch;
  eventAt: Date;
}): Promise<boolean> {
  if (!input.parsed.gatewayId) return false;
  const gateway = await findGatewayByExternalId({
    connectionId: input.match.connection.id,
    externalGatewayId: input.parsed.gatewayId,
  });
  if (!gateway) return false;

  const accessToken = await getValidAccessToken(
    input.match.connection,
    input.match.connection.ownerUserId
  );
  const detail = await fetchGatewayDetail({
    accessToken,
    gatewayId: input.parsed.gatewayId,
  });
  if (typeof detail.errcode === "number" && detail.errcode !== 0) return false;

  const onlineStatus = mapOnlineStatus(detail.isOnline === 1);
  await updateGatewayOnlineIfNewer({
    gatewayId: gateway.id,
    onlineStatus,
    eventAt: input.eventAt,
  });
  return true;
}

async function processDeviceWakeUp(input: {
  parsed: ParsedTtlockCallback;
  match: LockConnectionMatch;
  eventAt: Date;
}): Promise<boolean> {
  if (!input.parsed.lockId) return false;
  const accessToken = await getValidAccessToken(
    input.match.connection,
    input.match.connection.ownerUserId
  );
  const detail = await fetchLockDetail({
    accessToken,
    lockId: input.parsed.lockId,
  });
  if (typeof detail.errcode === "number" && detail.errcode !== 0) return false;

  const eq = detail.electricQuantity;
  if (eq != null && eq >= 0 && eq <= 100) {
    await updateLockBatteryIfNewer({
      lockId: input.match.lock.id,
      battery: eq,
      eventAt: input.eventAt,
    });
    return true;
  }
  return false;
}

function loadParsedFromInbox(
  inbox: {
    notifyType: number | null;
    externalLockId: string | null;
    externalGatewayId: string | null;
    sanitizedMetadata: unknown;
  },
  rawBody: string
): ParsedTtlockCallback {
  if (inbox.sanitizedMetadata) {
    const meta = inbox.sanitizedMetadata as Record<string, unknown>;
    return {
      notifyType: inbox.notifyType,
      lockId: inbox.externalLockId,
      lockMac: null,
      gatewayId: inbox.externalGatewayId,
      isOnline: typeof meta.isOnline === "number" ? meta.isOnline : null,
      electricQuantity:
        typeof meta.electricQuantity === "number" ? meta.electricQuantity : null,
      records: recordHintsFromMetadata(meta),
      metadata:
        (meta as Record<string, string | number | boolean | null>) ?? {},
    };
  }
  return parseCallbackFormBody(rawBody);
}

async function executeCallbackProcessing(
  inboxId: string,
  rawBody: string
): Promise<void> {
  const inbox = await prisma.ttlockCallbackInbox.findUnique({
    where: { id: inboxId },
  });
  if (!inbox) return;

  const parsed = loadParsedFromInbox(inbox, rawBody);
  const eventAt = resolveProviderEventAt(parsed);

  try {
    if (!parsed.lockId) {
      await markInboxStatus(inboxId, "UNRESOLVED", {
        code: "TTLOCK_CALLBACK_NO_LOCK",
        message: "Callback lockId aniqlanmadi.",
      });
      return;
    }

    const matches = await findActiveLockMatchesByExternalId(parsed.lockId);
    const resolved = resolveLockConnection(matches);
    if (!resolved.ok) {
      await markInboxStatus(inboxId, "UNRESOLVED", {
        code:
          resolved.reason === "ambiguous_connection"
            ? "TTLOCK_CALLBACK_AMBIGUOUS"
            : "TTLOCK_CALLBACK_UNKNOWN_LOCK",
        message:
          resolved.reason === "ambiguous_connection"
            ? "Bir xil qulf bir nechta hisobda topildi."
            : "Noma'lum qulf — avtomatik yaratilmadi.",
      });
      return;
    }

    const match = resolved.match;
    await touchConnectionCallbackTimestamps({
      connectionId: match.connection.id,
      received: true,
    });

    if (parsed.gatewayId) {
      const gateway = await findGatewayByExternalId({
        connectionId: match.connection.id,
        externalGatewayId: parsed.gatewayId,
      });
      if (!gateway) {
        await markInboxStatus(inboxId, "UNRESOLVED", {
          code: "TTLOCK_CALLBACK_UNKNOWN_GATEWAY",
          message: "Noma'lum Gateway — avtomatik yaratilmadi.",
        });
        return;
      }
    }

    let ok = false;

    if (parsed.notifyType === 1 || parsed.records.length > 0) {
      const result = await processLockRecordsNotify({
        parsed,
        match,
        inboxId,
      });
      if (result.unresolved) return;
      ok = result.verified > 0;
    }

    if (parsed.gatewayId) {
      ok =
        (await processGatewayStatusWakeUp({ parsed, match, eventAt })) || ok;
    }

    if (!ok && parsed.notifyType !== 1) {
      ok = await processDeviceWakeUp({ parsed, match, eventAt });
    }

    if (ok) {
      await markInboxStatus(inboxId, "PROCESSED");
      await touchConnectionCallbackTimestamps({
        connectionId: match.connection.id,
        processed: true,
      });
      return;
    }

    if (parsed.notifyType === 1) {
      await markInboxFailedWithRetry({
        inboxId,
        attempts: inbox.attempts,
        code: "TTLOCK_CALLBACK_VERIFY_FAILED",
        message: "Provider API orqali tasdiqlab bo‘lmadi.",
      });
      return;
    }

    await markInboxStatus(inboxId, "UNRESOLVED", {
      code: "TTLOCK_CALLBACK_UNDOCUMENTED",
      message:
        "Rasmiy hujjatda schema yo‘q callback — verify-by-fetch natija bermadi.",
    });
  } catch (err) {
    await markInboxFailedWithRetry({
      inboxId,
      attempts: inbox.attempts,
      code: "TTLOCK_CALLBACK_PROCESS_ERROR",
      message:
        err instanceof Error ? err.message : "Callback qayta ishlash xatosi",
    });
  }
}

/** Atomic claim + verify-by-fetch processing */
export async function processCallbackInbox(input: {
  inboxId: string;
  rawBody: string;
  workerId: string;
}): Promise<boolean> {
  const claimed = await claimCallbackInbox({
    inboxId: input.inboxId,
    workerId: input.workerId,
  });
  if (!claimed) return false;
  await executeCallbackProcessing(input.inboxId, input.rawBody);
  return true;
}

export async function retryCallbackInboxById(
  inboxId: string,
  workerId: string
): Promise<boolean> {
  return processCallbackInbox({
    inboxId,
    rawBody: "",
    workerId,
  });
}

export async function resolveTenantLabelByExternalAccessId(input: {
  ttlockCachedLockId: string;
  externalAccessId: string;
}): Promise<string | null> {
  const cred = await prisma.ttlockAccessCredential.findFirst({
    where: {
      ttlockCachedLockId: input.ttlockCachedLockId,
      externalAccessId: input.externalAccessId,
      syncStatus: { in: ["SENT", "ACTIVE", "REVOKE_PENDING"] },
    },
    include: { grant: { include: { tenant: true } } },
  });
  return cred?.grant?.tenant?.fullName?.trim() || null;
}
