-- Additive: workspace rental industry. Existing rows default to OTHER.

DO $$ BEGIN
  CREATE TYPE "RentalIndustry" AS ENUM (
    'OFFICE_RENTAL',
    'APARTMENT_RENTAL',
    'HOTEL_HOSTEL',
    'CAR_RENTAL',
    'RETAIL_RENTAL',
    'WAREHOUSE_RENTAL',
    'VILLA_RENTAL',
    'COMMERCIAL_RENTAL',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "industry" "RentalIndustry" NOT NULL DEFAULT 'OTHER';
