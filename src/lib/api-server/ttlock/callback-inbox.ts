/**
 * TTLock callback inbox — qabul qilish, dedupe va atomic claim.
 */

import { randomUUID } from "crypto";

import { prisma } from "@/lib/api-server/prisma";
import {
  TTLOCK_CALLBACK_PROCESSING_LEASE_MS,
} from "@/lib/api-server/ttlock/callback-config";
import {
  buildCallbackDeliveryFingerprint,
  hashCallbackPayload,
  type ParsedTtlockCallback,
} from "@/lib/api-server/ttlock/callback-parse";
import type { TtlockCallbackInboxStatus } from "@prisma/client";

export type InboxReceiveResult =
  | { kind: "created"; inboxId: string }
  | { kind: "duplicate"; inboxId: string };

function isUniqueViolation(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export async function receiveCallbackInbox(input: {
  rawBody: string;
  parsed: ParsedTtlockCallback;
  connectionId: string | null;
  semanticEventType: string | null;
  providerEventAt: Date | null;
  sanitizedMetadata: Record<string, unknown>;
}): Promise<InboxReceiveResult> {
  const payloadHash = hashCallbackPayload(input.rawBody);
  const eventFingerprint = buildCallbackDeliveryFingerprint({
    connectionId: input.connectionId,
    notifyType: input.parsed.notifyType,
    externalLockId: input.parsed.lockId,
    externalGatewayId: input.parsed.gatewayId,
    payloadHash,
  });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.ttlockCallbackInbox.findFirst({
      where: { eventFingerprint },
    });
    if (existing) {
      if (existing.status !== "DUPLICATE" && existing.status !== "PROCESSED") {
        await tx.ttlockCallbackInbox.update({
          where: { id: existing.id },
          data: { status: "DUPLICATE", processedAt: new Date() },
        });
      }
      return { kind: "duplicate" as const, inboxId: existing.id };
    }

    try {
      const row = await tx.ttlockCallbackInbox.create({
        data: {
          id: randomUUID(),
          connectionId: input.connectionId,
          eventFingerprint,
          notifyType: input.parsed.notifyType,
          semanticEventType: input.semanticEventType,
          externalLockId: input.parsed.lockId,
          externalGatewayId: input.parsed.gatewayId,
          providerEventAt: input.providerEventAt,
          status: "RECEIVED",
          payloadHash,
          sanitizedMetadata: input.sanitizedMetadata as object,
        },
      });
      return { kind: "created" as const, inboxId: row.id };
    } catch (err) {
      if (isUniqueViolation(err)) {
        const dup = await tx.ttlockCallbackInbox.findFirst({
          where: { eventFingerprint },
        });
        if (dup) return { kind: "duplicate" as const, inboxId: dup.id };
      }
      throw err;
    }
  });
}

export async function claimCallbackInbox(input: {
  inboxId: string;
  workerId: string;
  leaseMs?: number;
}): Promise<boolean> {
  const leaseMs = input.leaseMs ?? TTLOCK_CALLBACK_PROCESSING_LEASE_MS;
  const leaseUntil = new Date(Date.now() + leaseMs);
  const now = new Date();

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "ttlock_callback_inbox"
     SET "status" = CAST('PROCESSING' AS "TtlockCallbackInboxStatus"),
         "processingStartedAt" = $2,
         "processingLeaseUntil" = $3,
         "processingWorkerId" = $4,
         "updatedAt" = $2
     WHERE "id" = $1
       AND (
         "status" = CAST('RECEIVED' AS "TtlockCallbackInboxStatus")
         OR (
           "status" = CAST('FAILED' AS "TtlockCallbackInboxStatus")
           AND "attempts" < 5
           AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= $2)
         )
         OR (
           "status" = CAST('PROCESSING' AS "TtlockCallbackInboxStatus")
           AND "processingLeaseUntil" IS NOT NULL
           AND "processingLeaseUntil" < $2
         )
       )
     RETURNING "id"`,
    input.inboxId,
    now,
    leaseUntil,
    input.workerId
  );
  return rows.length > 0;
}

export async function claimCallbackInboxBatch(input: {
  limit: number;
  workerId: string;
  leaseMs?: number;
}): Promise<string[]> {
  const leaseMs = input.leaseMs ?? TTLOCK_CALLBACK_PROCESSING_LEASE_MS;
  const leaseUntil = new Date(Date.now() + leaseMs);
  const now = new Date();

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "ttlock_callback_inbox" AS t
     SET "status" = CAST('PROCESSING' AS "TtlockCallbackInboxStatus"),
         "processingStartedAt" = $2,
         "processingLeaseUntil" = $3,
         "processingWorkerId" = $4,
         "updatedAt" = $2
     FROM (
       SELECT "id"
       FROM "ttlock_callback_inbox"
       WHERE "status" = CAST('RECEIVED' AS "TtlockCallbackInboxStatus")
          OR (
            "status" = CAST('FAILED' AS "TtlockCallbackInboxStatus")
            AND "attempts" < 5
            AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= $2)
          )
          OR (
            "status" = CAST('PROCESSING' AS "TtlockCallbackInboxStatus")
            AND "processingLeaseUntil" IS NOT NULL
            AND "processingLeaseUntil" < $2
          )
       ORDER BY "receivedAt" ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     ) AS picked
     WHERE t."id" = picked."id"
     RETURNING t."id"`,
    input.limit,
    now,
    leaseUntil,
    input.workerId
  );
  return rows.map((r) => r.id);
}

export async function markInboxStatus(
  inboxId: string,
  status: TtlockCallbackInboxStatus,
  error?: { code: string; message: string }
): Promise<void> {
  const now = new Date();
  await prisma.ttlockCallbackInbox.update({
    where: { id: inboxId },
    data: {
      status,
      processedAt:
        status === "PROCESSED" ||
        status === "DUPLICATE" ||
        status === "UNRESOLVED"
          ? now
          : undefined,
      lastErrorCode: error?.code ?? null,
      lastErrorMessage: error?.message ?? null,
      ...(status === "PROCESSING"
        ? {
            processingStartedAt: now,
          }
        : {}),
      ...(status === "PROCESSED" ||
      status === "FAILED" ||
      status === "UNRESOLVED"
        ? {
            processingLeaseUntil: null,
            processingWorkerId: null,
          }
        : {}),
    },
  });
}

export async function markInboxFailedWithRetry(input: {
  inboxId: string;
  attempts: number;
  code: string;
  message: string;
  maxAttempts?: number;
}): Promise<void> {
  const max = input.maxAttempts ?? 5;
  const nextAttempts = input.attempts + 1;
  const backoffMs = [60_000, 300_000, 900_000, 3_600_000, 14_400_000][
    Math.min(nextAttempts - 1, 4)
  ];
  const status = nextAttempts >= max ? "UNRESOLVED" : "FAILED";
  await prisma.ttlockCallbackInbox.update({
    where: { id: input.inboxId },
    data: {
      status,
      attempts: nextAttempts,
      nextRetryAt:
        status === "FAILED" ? new Date(Date.now() + backoffMs) : null,
      lastErrorCode: input.code,
      lastErrorMessage: input.message,
      processedAt: status === "UNRESOLVED" ? new Date() : null,
      processingLeaseUntil: null,
      processingWorkerId: null,
    },
  });
}

export async function countCallbackInboxByStatus() {
  const rows = await prisma.ttlockCallbackInbox.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const map: Record<string, number> = {};
  for (const r of rows) map[r.status] = r._count._all;
  return map;
}

export async function getLatestCallbackTimestamps(connectionId: string | null) {
  if (!connectionId) return { receivedAt: null, processedAt: null };
  const conn = await prisma.ttlockConnection.findUnique({
    where: { id: connectionId },
    select: {
      lastCallbackReceivedAt: true,
      lastCallbackProcessedAt: true,
    },
  });
  return {
    receivedAt: conn?.lastCallbackReceivedAt?.toISOString() ?? null,
    processedAt: conn?.lastCallbackProcessedAt?.toISOString() ?? null,
  };
}
