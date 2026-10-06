-- Additive: utility / tax monthly expense types. WATER and ELECTRICITY already exist and are reused.
ALTER TYPE "MonthlyExpenseType" ADD VALUE IF NOT EXISTS 'WASTE_SERVICE';
ALTER TYPE "MonthlyExpenseType" ADD VALUE IF NOT EXISTS 'GAS';
ALTER TYPE "MonthlyExpenseType" ADD VALUE IF NOT EXISTS 'INTERNET';
ALTER TYPE "MonthlyExpenseType" ADD VALUE IF NOT EXISTS 'TAX';
