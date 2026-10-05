-- Additive: payments for CAR vehicle rentals and HOTEL/VILLA bookings.
-- Legacy "payments" (contractId NOT NULL) is untouched.

DO $$ BEGIN
  CREATE TYPE "PaymentSourceType" AS ENUM ('VEHICLE_RENTAL', 'BOOKING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "source_payments" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceType" "PaymentSourceType" NOT NULL,
  "vehicleRentalId" TEXT,
  "bookingId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "source_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "source_payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "source_payments_one_source_check" CHECK (
    ("sourceType" = 'VEHICLE_RENTAL' AND "vehicleRentalId" IS NOT NULL AND "bookingId" IS NULL)
    OR ("sourceType" = 'BOOKING' AND "bookingId" IS NOT NULL AND "vehicleRentalId" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "source_payments_workspaceId_paymentDate_idx" ON "source_payments"("workspaceId", "paymentDate");
CREATE INDEX IF NOT EXISTS "source_payments_vehicleRentalId_idx" ON "source_payments"("vehicleRentalId");
CREATE INDEX IF NOT EXISTS "source_payments_bookingId_idx" ON "source_payments"("bookingId");

DO $$ BEGIN
  ALTER TABLE "source_payments"
    ADD CONSTRAINT "source_payments_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "source_payments"
    ADD CONSTRAINT "source_payments_vehicleRentalId_fkey"
    FOREIGN KEY ("vehicleRentalId") REFERENCES "vehicle_rentals"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "source_payments"
    ADD CONSTRAINT "source_payments_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
