-- Additive: debt write-offs (audit trail). Not payments; canonical debt subtracts them separately.

DO $$ BEGIN
  CREATE TYPE "DebtAdjustmentType" AS ENUM ('WRITE_OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "debt_adjustments" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "type" "DebtAdjustmentType" NOT NULL DEFAULT 'WRITE_OFF',
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debt_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "debt_adjustments_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "debt_adjustments_contractId_type_reason_key" ON "debt_adjustments"("contractId", "type", "reason");
CREATE INDEX IF NOT EXISTS "debt_adjustments_workspaceId_idx" ON "debt_adjustments"("workspaceId");
CREATE INDEX IF NOT EXISTS "debt_adjustments_tenantId_idx" ON "debt_adjustments"("tenantId");

DO $$ BEGIN
  ALTER TABLE "debt_adjustments"
    ADD CONSTRAINT "debt_adjustments_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "debt_adjustments"
    ADD CONSTRAINT "debt_adjustments_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "debt_adjustments"
    ADD CONSTRAINT "debt_adjustments_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "debt_adjustments"
    ADD CONSTRAINT "debt_adjustments_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
