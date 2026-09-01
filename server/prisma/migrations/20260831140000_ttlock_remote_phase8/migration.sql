-- TTLock 8-bosqich: masofadan boshqarish audit + kirish tarixi dedupe

-- CreateEnum
CREATE TYPE "TtlockRemoteCommandType" AS ENUM ('UNLOCK', 'LOCK');

-- CreateEnum
CREATE TYPE "TtlockRemoteCommandStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "room_lock_settings" ADD COLUMN IF NOT EXISTS "lastAccessHistorySyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "room_access_log_events" ADD COLUMN IF NOT EXISTS "externalRecordId" TEXT;
ALTER TABLE "room_access_log_events" ADD COLUMN IF NOT EXISTS "recordFingerprint" TEXT;
ALTER TABLE "room_access_log_events" ADD COLUMN IF NOT EXISTS "ttlockCachedLockId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ttlock_remote_commands" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ttlockCachedLockId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "commandType" "TtlockRemoteCommandType" NOT NULL,
    "status" "TtlockRemoteCommandStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "providerRequestId" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ttlock_remote_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ttlock_remote_commands_idempotencyKey_key" ON "ttlock_remote_commands"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ttlock_remote_commands_ttlockCachedLockId_status_idx" ON "ttlock_remote_commands"("ttlockCachedLockId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ttlock_remote_commands_propertyId_idx" ON "ttlock_remote_commands"("propertyId");

-- CreateIndex (dedupe - null qiymatlar PG'da bir nechta bo'lishi mumkin)
CREATE UNIQUE INDEX IF NOT EXISTS "room_access_log_events_propertyId_externalRecordId_key" ON "room_access_log_events"("propertyId", "externalRecordId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "room_access_log_events_propertyId_recordFingerprint_key" ON "room_access_log_events"("propertyId", "recordFingerprint");

-- AddForeignKey
DO $$ BEGIN
 ALTER TABLE "ttlock_remote_commands" ADD CONSTRAINT "ttlock_remote_commands_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "ttlock_remote_commands" ADD CONSTRAINT "ttlock_remote_commands_ttlockCachedLockId_fkey" FOREIGN KEY ("ttlockCachedLockId") REFERENCES "ttlock_cached_locks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "ttlock_remote_commands" ADD CONSTRAINT "ttlock_remote_commands_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ttlock_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "ttlock_remote_commands" ADD CONSTRAINT "ttlock_remote_commands_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
