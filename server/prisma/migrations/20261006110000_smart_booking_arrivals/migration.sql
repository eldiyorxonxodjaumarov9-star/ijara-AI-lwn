-- Additive: smart hotel bookings. A reservation needs only a guest name; the guest record is linked on arrival.
-- Re-runnable. No row is deleted; tenantId is only relaxed to nullable.

DO $$ BEGIN
  CREATE TYPE "BookingArrivalStatus" AS ENUM ('EXPECTED', 'ARRIVED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "guestName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "arrivalStatus" "BookingArrivalStatus" NOT NULL DEFAULT 'EXPECTED';
ALTER TABLE "bookings" ALTER COLUMN "tenantId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "bookings_workspaceId_checkInDate_idx" ON "bookings"("workspaceId", "checkInDate");

UPDATE "bookings" b
SET "guestName" = t."fullName",
    "guestPhone" = COALESCE(b."guestPhone", NULLIF(t."phone", ''))
FROM "tenants" t
WHERE b."tenantId" = t."id" AND b."guestName" = '';

UPDATE "bookings"
SET "arrivalStatus" = 'ARRIVED'
WHERE "status" IN ('CHECKED_IN', 'CHECKED_OUT') AND "arrivalStatus" = 'EXPECTED';
