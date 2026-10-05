-- Keep rental history when a customer is deleted: tenant FK CASCADE -> NO ACTION.
-- Same column, same target; only the delete rule changes. No data is touched.
-- Drop + add run in one transaction-scoped DO block so the FK is never missing.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicle_rentals_tenantId_fkey' AND confdeltype = 'c'
  ) THEN
    ALTER TABLE "vehicle_rentals" DROP CONSTRAINT "vehicle_rentals_tenantId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_rentals_tenantId_fkey') THEN
    ALTER TABLE "vehicle_rentals"
      ADD CONSTRAINT "vehicle_rentals_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END $$;
