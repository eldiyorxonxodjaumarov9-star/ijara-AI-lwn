-- TTLock 9-bosqich: callback inbox + lock-scope dedupe + device timestamps

-- CreateEnum
CREATE TYPE "TtlockCallbackInboxStatus" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'DUPLICATE',
  'UNRESOLVED',
  'FAILED'
);

-- AlterTable: connection callback timestamps
ALTER TABLE "ttlock_connections" ADD COLUMN IF NOT EXISTS "lastCallbackReceivedAt" TIMESTAMP(3);
ALTER TABLE "ttlock_connections" ADD COLUMN IF NOT EXISTS "lastCallbackProcessedAt" TIMESTAMP(3);

-- AlterTable: device last event
ALTER TABLE "ttlock_gateways" ADD COLUMN IF NOT EXISTS "lastEventAt" TIMESTAMP(3);
ALTER TABLE "ttlock_cached_locks" ADD COLUMN IF NOT EXISTS "lastEventAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ttlock_callback_inbox" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "providerDeliveryId" TEXT,
    "eventFingerprint" TEXT NOT NULL,
    "notifyType" INTEGER,
    "semanticEventType" TEXT,
    "externalLockId" TEXT,
    "externalGatewayId" TEXT,
    "providerEventAt" TIMESTAMP(3),
    "status" "TtlockCallbackInboxStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "payloadHash" TEXT NOT NULL,
    "sanitizedMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ttlock_callback_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ttlock_callback_inbox_eventFingerprint_key"
  ON "ttlock_callback_inbox"("eventFingerprint");

CREATE INDEX IF NOT EXISTS "ttlock_callback_inbox_status_nextRetryAt_idx"
  ON "ttlock_callback_inbox"("status", "nextRetryAt");

CREATE INDEX IF NOT EXISTS "ttlock_callback_inbox_connectionId_idx"
  ON "ttlock_callback_inbox"("connectionId");

-- Lock-scope dedupe (property-scope indekslar saqlanadi)
CREATE UNIQUE INDEX IF NOT EXISTS "room_access_log_events_ttlockCachedLockId_externalRecordId_key"
  ON "room_access_log_events"("ttlockCachedLockId", "externalRecordId");

CREATE UNIQUE INDEX IF NOT EXISTS "room_access_log_events_ttlockCachedLockId_recordFingerprint_key"
  ON "room_access_log_events"("ttlockCachedLockId", "recordFingerprint");

-- AddForeignKey
DO $$ BEGIN
 ALTER TABLE "ttlock_callback_inbox" ADD CONSTRAINT "ttlock_callback_inbox_connectionId_fkey"
   FOREIGN KEY ("connectionId") REFERENCES "ttlock_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
