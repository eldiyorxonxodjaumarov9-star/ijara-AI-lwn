-- Additive Bluetooth offline timed-PIN sync support.

DO $$ BEGIN
  CREATE TYPE "TtlockTransport" AS ENUM ('REMOTE_GATEWAY', 'REMOTE_WIFI', 'LOCAL_BLUETOOTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TtlockAccessSyncStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_BLUETOOTH';
  ALTER TYPE "TtlockAccessSyncStatus" ADD VALUE IF NOT EXISTS 'BLUETOOTH_SYNCING';
  ALTER TYPE "TtlockAccessSyncStatus" ADD VALUE IF NOT EXISTS 'INSTALLED_ON_LOCK';
  ALTER TYPE "TtlockAccessSyncStatus" ADD VALUE IF NOT EXISTS 'BLUETOOTH_SYNC_FAILED';
END $$;

DO $$ BEGIN
  CREATE TYPE "TtlockBluetoothSessionStatus" AS ENUM ('CREATED', 'SYNCING', 'COMPLETED', 'FAILED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TtlockBluetoothEntryStatus" AS ENUM ('READY_FOR_BLUETOOTH', 'BLUETOOTH_SYNCING', 'INSTALLED_ON_LOCK', 'BLUETOOTH_SYNC_FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ttlock_access_credentials"
  ADD COLUMN IF NOT EXISTS "transport" "TtlockTransport" NOT NULL DEFAULT 'REMOTE_GATEWAY';

CREATE TABLE IF NOT EXISTS "ttlock_bluetooth_sync_sessions" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "ttlockCachedLockId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "TtlockBluetoothSessionStatus" NOT NULL DEFAULT 'CREATED',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ttlock_bluetooth_sync_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ttlock_bluetooth_sync_entries" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "status" "TtlockBluetoothEntryStatus" NOT NULL DEFAULT 'READY_FOR_BLUETOOTH',
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3) NOT NULL,
  "credentialDeliveredAt" TIMESTAMP(3),
  "installedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ttlock_bluetooth_sync_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ttlock_bluetooth_sync_sessions_tokenHash_key"
  ON "ttlock_bluetooth_sync_sessions"("tokenHash");
CREATE INDEX IF NOT EXISTS "ttlock_bluetooth_sync_sessions_ownerUserId_propertyId_idx"
  ON "ttlock_bluetooth_sync_sessions"("ownerUserId", "propertyId");
CREATE INDEX IF NOT EXISTS "ttlock_bluetooth_sync_sessions_expiresAt_idx"
  ON "ttlock_bluetooth_sync_sessions"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ttlock_bluetooth_sync_entries_sessionId_credentialId_key"
  ON "ttlock_bluetooth_sync_entries"("sessionId", "credentialId");
CREATE INDEX IF NOT EXISTS "ttlock_bluetooth_sync_entries_credentialId_idx"
  ON "ttlock_bluetooth_sync_entries"("credentialId");

DO $$ BEGIN
  ALTER TABLE "ttlock_bluetooth_sync_entries"
    ADD CONSTRAINT "ttlock_bluetooth_sync_entries_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ttlock_bluetooth_sync_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ttlock_bluetooth_sync_entries"
    ADD CONSTRAINT "ttlock_bluetooth_sync_entries_credentialId_fkey"
    FOREIGN KEY ("credentialId") REFERENCES "ttlock_access_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ttlock_bluetooth_sync_entries"
  ADD COLUMN IF NOT EXISTS "credentialDeliveredAt" TIMESTAMP(3);