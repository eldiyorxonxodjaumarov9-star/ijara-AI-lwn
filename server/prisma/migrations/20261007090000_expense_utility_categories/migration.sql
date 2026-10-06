-- Additive: utility expense categories. Existing values (incl. TAX, UTILITIES) and rows are untouched.
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'WASTE_SERVICE';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'ELECTRICITY';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'WATER';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'GAS';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'INTERNET';
