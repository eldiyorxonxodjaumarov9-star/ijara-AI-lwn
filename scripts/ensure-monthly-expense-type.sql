-- Oylik xarajat turi (Expense.monthlyType / monthlyTypeCustom)
DO $$ BEGIN
  CREATE TYPE "MonthlyExpenseType" AS ENUM ('WATER', 'ELECTRICITY', 'OFFICE', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "monthlyType" "MonthlyExpenseType";
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "monthlyTypeCustom" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_monthlyType_idx" ON "expenses"("monthlyType");
