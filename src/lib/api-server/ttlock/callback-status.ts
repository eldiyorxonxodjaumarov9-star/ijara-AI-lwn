/**
 * TTLock callback — public status (secret yo‘q).
 */

import {
  TTLOCK_CALLBACK_VERIFY_MODE,
  getTtlockCallbackUrl,
} from "@/lib/api-server/ttlock/callback-config";
import { countCallbackInboxByStatus } from "@/lib/api-server/ttlock/callback-inbox";
import { isTtlockConfigured } from "@/lib/api-server/ttlock/config";
import { findConnectionByOwner } from "@/lib/api-server/ttlock/db";
import { prisma } from "@/lib/api-server/prisma";

export type TtlockCallbackPublicStatus = {
  callbackUrl: string;
  verificationMode: typeof TTLOCK_CALLBACK_VERIFY_MODE;
  configured: boolean;
  ready: boolean;
  lastReceivedAt: string | null;
  lastProcessedAt: string | null;
  failedCount: number;
  unresolvedCount: number;
  setupHint: string;
};

export async function buildTtlockCallbackPublicStatus(
  ownerUserId: string | null
): Promise<TtlockCallbackPublicStatus> {
  const callbackUrl = getTtlockCallbackUrl();
  const configured = isTtlockConfigured();
  let lastReceivedAt: string | null = null;
  let lastProcessedAt: string | null = null;

  if (ownerUserId) {
    const conn = await findConnectionByOwner(ownerUserId);
    if (conn) {
      try {
        const row = await prisma.ttlockConnection.findUnique({
          where: { id: conn.id },
          select: {
            lastCallbackReceivedAt: true,
            lastCallbackProcessedAt: true,
          },
        });
        lastReceivedAt = row?.lastCallbackReceivedAt?.toISOString() ?? null;
        lastProcessedAt = row?.lastCallbackProcessedAt?.toISOString() ?? null;
      } catch {
        /* phase 9 migration qo‘llanmagan — timestamp null qoladi */
      }
    }
  }

  const counts = await countCallbackInboxByStatus().catch(
    (): Record<string, number> => ({})
  );
  const failedCount = (counts["FAILED"] ?? 0) + (counts["RECEIVED"] ?? 0);
  const unresolvedCount = counts["UNRESOLVED"] ?? 0;

  return {
    callbackUrl,
    verificationMode: TTLOCK_CALLBACK_VERIFY_MODE,
    configured,
    ready: configured,
    lastReceivedAt,
    lastProcessedAt,
    failedCount,
    unresolvedCount,
    setupHint:
      "Callback URL’ni Sciener Developer kabinetida Application tasdiqlangach kiriting.",
  };
}
