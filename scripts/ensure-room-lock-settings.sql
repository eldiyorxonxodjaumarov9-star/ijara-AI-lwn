-- LWN xona aqlli qulf ichki sozlamalari (API integratsiyasiz)
-- Xavfsiz / backward-compatible. Mavjud ma'lumot o'chirmaydi.

DO $$ BEGIN
  CREATE TYPE "RoomAccessGrantStatus" AS ENUM ('PLANNED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RoomAccessPermissionType" AS ENUM ('PIN', 'APP', 'CARD', 'PERMANENT', 'TEMPORARY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "room_lock_settings" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "providerName" TEXT,
  "lockName" TEXT,
  "deviceId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_lock_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "room_lock_settings_propertyId_key"
  ON "room_lock_settings"("propertyId");

DO $$ BEGIN
  ALTER TABLE "room_lock_settings"
    ADD CONSTRAINT "room_lock_settings_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "room_access_grants" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "permissionType" "RoomAccessPermissionType" NOT NULL DEFAULT 'PIN',
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "status" "RoomAccessGrantStatus" NOT NULL DEFAULT 'PLANNED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "room_access_grants_propertyId_idx"
  ON "room_access_grants"("propertyId");
CREATE INDEX IF NOT EXISTS "room_access_grants_tenantId_idx"
  ON "room_access_grants"("tenantId");
CREATE INDEX IF NOT EXISTS "room_access_grants_status_idx"
  ON "room_access_grants"("status");

DO $$ BEGIN
  ALTER TABLE "room_access_grants"
    ADD CONSTRAINT "room_access_grants_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "room_access_grants"
    ADD CONSTRAINT "room_access_grants_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "room_access_log_events" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "personLabel" TEXT,
  "eventType" TEXT NOT NULL,
  "method" TEXT,
  "direction" TEXT NOT NULL DEFAULT 'unknown',
  "result" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_access_log_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "room_access_log_events_propertyId_occurredAt_idx"
  ON "room_access_log_events"("propertyId", "occurredAt");

DO $$ BEGIN
  ALTER TABLE "room_access_log_events"
    ADD CONSTRAINT "room_access_log_events_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
