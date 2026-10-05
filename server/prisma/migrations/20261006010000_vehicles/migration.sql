-- Additive: CAR_RENTAL vehicles. New table only; existing tables untouched.

DO $$ BEGIN
  CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "vehicles" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "plateNumber" TEXT NOT NULL,
  "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
  "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "color" TEXT,
  "vin" TEXT,
  "mileage" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_workspaceId_plateNumber_key" ON "vehicles"("workspaceId", "plateNumber");
CREATE INDEX IF NOT EXISTS "vehicles_workspaceId_idx" ON "vehicles"("workspaceId");
CREATE INDEX IF NOT EXISTS "vehicles_status_idx" ON "vehicles"("status");

DO $$ BEGIN
  ALTER TABLE "vehicles"
    ADD CONSTRAINT "vehicles_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
