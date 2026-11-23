-- Additive soft-delete for work tasks (audit retention).
ALTER TABLE "work_tasks" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "work_tasks" ADD COLUMN IF NOT EXISTS "deletedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "work_tasks_deletedAt_idx" ON "work_tasks"("deletedAt");

DO $$ BEGIN
  ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_deletedByUserId_fkey"
    FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
