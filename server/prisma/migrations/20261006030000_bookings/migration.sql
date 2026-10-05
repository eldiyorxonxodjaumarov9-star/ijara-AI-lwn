-- Additive: HOTEL_HOSTEL / VILLA_RENTAL bookings. New table only; contracts untouched.

DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "checkInDate" TIMESTAMP(3) NOT NULL,
  "checkOutDate" TIMESTAMP(3) NOT NULL,
  "nights" INTEGER NOT NULL,
  "nightlyRate" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "guestCount" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_dates_check" CHECK ("checkOutDate" > "checkInDate"),
  CONSTRAINT "bookings_nights_check" CHECK ("nights" >= 1),
  CONSTRAINT "bookings_rate_check" CHECK ("nightlyRate" > 0),
  CONSTRAINT "bookings_guests_check" CHECK ("guestCount" >= 1)
);

CREATE INDEX IF NOT EXISTS "bookings_workspaceId_idx" ON "bookings"("workspaceId");
CREATE INDEX IF NOT EXISTS "bookings_propertyId_status_idx" ON "bookings"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "bookings_tenantId_idx" ON "bookings"("tenantId");

DO $$ BEGIN
  ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
