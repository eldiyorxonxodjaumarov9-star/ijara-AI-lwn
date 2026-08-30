-- TTLock/Sciener 4-bosqich: Gateway, lock kengaytmasi, access credential
-- Mavjud yozuvlar saqlanadi. DROP TABLE/COLUMN yo'q.
-- Neon/production'ga qo'llanmagan.

-- Enums
DO $$ BEGIN
  CREATE TYPE "TtlockDeviceOnlineStatus" AS ENUM ('UNKNOWN', 'ONLINE', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TtlockAccessCredentialType" AS ENUM ('PASSCODE', 'EKEY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TtlockAccessSyncStatus" AS ENUM (
    'PLANNED', 'PENDING_SYNC', 'ACTIVE', 'EXPIRED',
    'REVOKE_PENDING', 'REVOKED', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Gateway
CREATE TABLE IF NOT EXISTS "ttlock_gateways" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalGatewayId" TEXT NOT NULL,
    "name" TEXT,
    "mac" TEXT,
    "onlineStatus" "TtlockDeviceOnlineStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" TIMESTAMP(3),
    "capabilities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ttlock_gateways_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ttlock_gateways_connectionId_externalGatewayId_key"
  ON "ttlock_gateways"("connectionId", "externalGatewayId");
CREATE INDEX IF NOT EXISTS "ttlock_gateways_connectionId_idx" ON "ttlock_gateways"("connectionId");
CREATE INDEX IF NOT EXISTS "ttlock_gateways_isActive_idx" ON "ttlock_gateways"("isActive");

DO $$ BEGIN
  ALTER TABLE "ttlock_gateways"
    ADD CONSTRAINT "ttlock_gateways_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "ttlock_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Lock kengaytmalari (mavjud ustunlar saqlanadi — online DROP qilinmaydi)
ALTER TABLE "ttlock_cached_locks" ADD COLUMN IF NOT EXISTS "firmwareVersion" TEXT;
ALTER TABLE "ttlock_cached_locks" ADD COLUMN IF NOT EXISTS "passcodeCapable" BOOLEAN;
ALTER TABLE "ttlock_cached_locks" ADD COLUMN IF NOT EXISTS "eKeyCapable" BOOLEAN;
ALTER TABLE "ttlock_cached_locks" ADD COLUMN IF NOT EXISTS "onlineStatus" "TtlockDeviceOnlineStatus" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "ttlock_cached_locks" ADD COLUMN IF NOT EXISTS "lastOnlineAt" TIMESTAMP(3);
ALTER TABLE "ttlock_cached_locks" ADD COLUMN IF NOT EXISTS "gatewayId" TEXT;
ALTER TABLE "ttlock_cached_locks" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ttlock_cached_locks" ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);

-- Legacy online boolean → onlineStatus backfill (canonical = onlineStatus)
-- online ustuni 1-bosqichdan qoladi; yangi kod uni yozmaydi. DROP qilinmaydi.
UPDATE "ttlock_cached_locks"
SET "onlineStatus" = CASE
  WHEN "online" IS TRUE THEN 'ONLINE'::"TtlockDeviceOnlineStatus"
  WHEN "online" IS FALSE THEN 'OFFLINE'::"TtlockDeviceOnlineStatus"
  ELSE "onlineStatus"
END
WHERE "online" IS NOT NULL
  AND "onlineStatus" = 'UNKNOWN'::"TtlockDeviceOnlineStatus";

CREATE INDEX IF NOT EXISTS "ttlock_cached_locks_gatewayId_idx" ON "ttlock_cached_locks"("gatewayId");
CREATE INDEX IF NOT EXISTS "ttlock_cached_locks_isActive_idx" ON "ttlock_cached_locks"("isActive");

DO $$ BEGIN
  ALTER TABLE "ttlock_cached_locks"
    ADD CONSTRAINT "ttlock_cached_locks_gatewayId_fkey"
    FOREIGN KEY ("gatewayId") REFERENCES "ttlock_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Room lock: unique (bir qulf — bir xona) + Restrict FK
-- Eski non-unique indexni olib tashlash (unique o'rniga)
DROP INDEX IF EXISTS "room_lock_settings_ttlockCachedLockId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "room_lock_settings_ttlockCachedLockId_key"
  ON "room_lock_settings"("ttlockCachedLockId");

DO $$ BEGIN
  ALTER TABLE "room_lock_settings" DROP CONSTRAINT IF EXISTS "room_lock_settings_ttlockCachedLockId_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "room_lock_settings"
    ADD CONSTRAINT "room_lock_settings_ttlockCachedLockId_fkey"
    FOREIGN KEY ("ttlockCachedLockId") REFERENCES "ttlock_cached_locks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Grant: revokedAt
ALTER TABLE "room_access_grants" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

-- TTLock access credential (1:1 grant)
CREATE TABLE IF NOT EXISTS "ttlock_access_credentials" (
    "id" TEXT NOT NULL,
    "roomAccessGrantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "ttlockCachedLockId" TEXT NOT NULL,
    "accessType" "TtlockAccessCredentialType" NOT NULL,
    "syncStatus" "TtlockAccessSyncStatus" NOT NULL DEFAULT 'PLANNED',
    "externalAccessId" TEXT,
    "credentialEncrypted" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ttlock_access_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ttlock_access_credentials_roomAccessGrantId_key"
  ON "ttlock_access_credentials"("roomAccessGrantId");
CREATE INDEX IF NOT EXISTS "ttlock_access_credentials_connectionId_idx"
  ON "ttlock_access_credentials"("connectionId");
CREATE INDEX IF NOT EXISTS "ttlock_access_credentials_ttlockCachedLockId_idx"
  ON "ttlock_access_credentials"("ttlockCachedLockId");
CREATE INDEX IF NOT EXISTS "ttlock_access_credentials_syncStatus_idx"
  ON "ttlock_access_credentials"("syncStatus");

DO $$ BEGIN
  ALTER TABLE "ttlock_access_credentials"
    ADD CONSTRAINT "ttlock_access_credentials_roomAccessGrantId_fkey"
    FOREIGN KEY ("roomAccessGrantId") REFERENCES "room_access_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ttlock_access_credentials"
    ADD CONSTRAINT "ttlock_access_credentials_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "ttlock_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ttlock_access_credentials"
    ADD CONSTRAINT "ttlock_access_credentials_ttlockCachedLockId_fkey"
    FOREIGN KEY ("ttlockCachedLockId") REFERENCES "ttlock_cached_locks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
