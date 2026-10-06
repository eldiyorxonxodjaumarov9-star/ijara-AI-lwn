-- Additive: demo seed lifecycle markers on workspaces. Plan/subscription untouched.
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "demoSeededAt" TIMESTAMP(3);
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "demoDataClearedAt" TIMESTAMP(3);
