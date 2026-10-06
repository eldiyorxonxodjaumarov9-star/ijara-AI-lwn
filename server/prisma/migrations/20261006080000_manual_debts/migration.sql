-- Additive: manual (non-contract) debts + their own payment ledger. No existing table is altered.

DO $$ BEGIN
  CREATE TYPE "ManualDebtStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "manual_debts" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "propertyId" TEXT,
  "debtorName" TEXT NOT NULL,
  "debtorPhone" TEXT,
  "debtorOccupation" TEXT,
  "description" TEXT,
  "originalAmount" DOUBLE PRECISION NOT NULL,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "remainingAmount" DOUBLE PRECISION NOT NULL,
  "debtDate" TIMESTAMP(3) NOT NULL,
  "status" "ManualDebtStatus" NOT NULL DEFAULT 'OPEN',
  "telegramChatId" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancelReason" TEXT,
  CONSTRAINT "manual_debts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "manual_debts_original_check" CHECK ("originalAmount" > 0),
  CONSTRAINT "manual_debts_paid_check" CHECK ("paidAmount" >= 0),
  CONSTRAINT "manual_debts_remaining_check" CHECK ("remainingAmount" >= 0 AND "remainingAmount" <= "originalAmount")
);

CREATE INDEX IF NOT EXISTS "manual_debts_workspaceId_status_idx" ON "manual_debts"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "manual_debts_propertyId_idx" ON "manual_debts"("propertyId");

DO $$ BEGIN
  ALTER TABLE "manual_debts" ADD CONSTRAINT "manual_debts_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "manual_debts" ADD CONSTRAINT "manual_debts_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "manual_debts" ADD CONSTRAINT "manual_debts_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "manual_debts" ADD CONSTRAINT "manual_debts_cancelledById_fkey"
    FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "manual_debt_payments" (
  "id" TEXT NOT NULL,
  "manualDebtId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "manual_debt_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "manual_debt_payments_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX IF NOT EXISTS "manual_debt_payments_manualDebtId_idx" ON "manual_debt_payments"("manualDebtId");
CREATE INDEX IF NOT EXISTS "manual_debt_payments_workspaceId_idx" ON "manual_debt_payments"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "manual_debt_payments" ADD CONSTRAINT "manual_debt_payments_manualDebtId_fkey"
    FOREIGN KEY ("manualDebtId") REFERENCES "manual_debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "manual_debt_payments" ADD CONSTRAINT "manual_debt_payments_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "manual_debt_payments" ADD CONSTRAINT "manual_debt_payments_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
