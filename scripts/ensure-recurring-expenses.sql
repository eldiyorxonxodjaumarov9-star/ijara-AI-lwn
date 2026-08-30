-- Doimiy (recurring) xarajatlar + Expense bog'lanishi
-- Xavfsiz / backward-compatible. Ma'lumot o'chirmaydi.

DO $$ BEGIN
  CREATE TYPE "RecurrenceInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'RECURRING_EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "recurring_expenses" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
  "monthlyType" "MonthlyExpenseType",
  "monthlyTypeCustom" TEXT,
  "notes" TEXT,
  "firstPaymentDate" TIMESTAMP(3) NOT NULL,
  "interval" "RecurrenceInterval" NOT NULL DEFAULT 'MONTHLY',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "recurring_expenses_active_idx" ON "recurring_expenses"("active");
CREATE INDEX IF NOT EXISTS "recurring_expenses_firstPaymentDate_idx" ON "recurring_expenses"("firstPaymentDate");
CREATE INDEX IF NOT EXISTS "recurring_expenses_interval_idx" ON "recurring_expenses"("interval");
CREATE INDEX IF NOT EXISTS "recurring_expenses_companyId_idx" ON "recurring_expenses"("companyId");
CREATE INDEX IF NOT EXISTS "recurring_expenses_name_idx" ON "recurring_expenses"("name");

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "source" "ExpenseSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "recurringExpenseId" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "paymentPeriodKey" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "plannedDueDate" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_recurringExpenseId_fkey"
    FOREIGN KEY ("recurringExpenseId") REFERENCES "recurring_expenses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "expenses_source_idx" ON "expenses"("source");
CREATE INDEX IF NOT EXISTS "expenses_recurringExpenseId_idx" ON "expenses"("recurringExpenseId");
CREATE INDEX IF NOT EXISTS "expenses_paymentPeriodKey_idx" ON "expenses"("paymentPeriodKey");

DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_recurringExpenseId_paymentPeriodKey_key"
    UNIQUE ("recurringExpenseId", "paymentPeriodKey");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
