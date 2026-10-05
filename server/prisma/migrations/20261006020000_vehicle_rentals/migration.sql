-- Additive: CAR_RENTAL vehicle rentals. New table only; contracts untouched.

DO $$ BEGIN
  CREATE TYPE "VehicleRentalStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "vehicle_rentals" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "days" INTEGER NOT NULL,
  "dailyRate" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "status" "VehicleRentalStatus" NOT NULL DEFAULT 'PLANNED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_rentals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vehicle_rentals_workspaceId_idx" ON "vehicle_rentals"("workspaceId");
CREATE INDEX IF NOT EXISTS "vehicle_rentals_vehicleId_status_idx" ON "vehicle_rentals"("vehicleId", "status");
CREATE INDEX IF NOT EXISTS "vehicle_rentals_tenantId_idx" ON "vehicle_rentals"("tenantId");

DO $$ BEGIN
  ALTER TABLE "vehicle_rentals"
    ADD CONSTRAINT "vehicle_rentals_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vehicle_rentals"
    ADD CONSTRAINT "vehicle_rentals_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vehicle_rentals"
    ADD CONSTRAINT "vehicle_rentals_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
