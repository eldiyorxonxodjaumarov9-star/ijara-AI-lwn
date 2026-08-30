-- TTLock/Sciener integratsiya (bosqich 1)
-- Bu fayl faqat migratsiya sifatida saqlangan — Neon/production'ga qo'llanmagan.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TtlockConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'TOKEN_EXPIRED', 'ERROR', 'SYNCING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ttlock_connections" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'TTLOCK',
    "status" "TtlockConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "ttlockUid" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ttlock_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ttlock_cached_locks" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalLockId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mac" TEXT,
    "model" TEXT,
    "battery" INTEGER,
    "hasGateway" BOOLEAN NOT NULL DEFAULT false,
    "remoteUnlock" BOOLEAN,
    "online" BOOLEAN,
    "capabilities" JSONB,
    "rawSafe" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ttlock_cached_locks_pkey" PRIMARY KEY ("id")
);

-- AlterTable room_lock_settings (ixtiyoriy bog‘lanish)
ALTER TABLE "room_lock_settings" ADD COLUMN IF NOT EXISTS "ttlockCachedLockId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ttlock_connections_ownerUserId_provider_key" ON "ttlock_connections"("ownerUserId", "provider");
CREATE INDEX IF NOT EXISTS "ttlock_connections_status_idx" ON "ttlock_connections"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "ttlock_cached_locks_connectionId_externalLockId_key" ON "ttlock_cached_locks"("connectionId", "externalLockId");
CREATE INDEX IF NOT EXISTS "ttlock_cached_locks_connectionId_idx" ON "ttlock_cached_locks"("connectionId");
CREATE INDEX IF NOT EXISTS "room_lock_settings_ttlockCachedLockId_idx" ON "room_lock_settings"("ttlockCachedLockId");

DO $$ BEGIN
  ALTER TABLE "ttlock_connections"
    ADD CONSTRAINT "ttlock_connections_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ttlock_cached_locks"
    ADD CONSTRAINT "ttlock_cached_locks_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "ttlock_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "room_lock_settings"
    ADD CONSTRAINT "room_lock_settings_ttlockCachedLockId_fkey"
    FOREIGN KEY ("ttlockCachedLockId") REFERENCES "ttlock_cached_locks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
