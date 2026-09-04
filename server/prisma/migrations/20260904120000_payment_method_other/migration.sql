-- AlterEnum: to'lov usuli "Boshqa"
DO $$ BEGIN
  ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'OTHER';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
