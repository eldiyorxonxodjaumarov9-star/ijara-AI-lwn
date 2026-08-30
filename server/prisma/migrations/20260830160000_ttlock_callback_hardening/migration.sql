-- TTLock 9-bosqich production hardening: inbox processing lease

ALTER TABLE "ttlock_callback_inbox" ADD COLUMN IF NOT EXISTS "processingLeaseUntil" TIMESTAMP(3);
ALTER TABLE "ttlock_callback_inbox" ADD COLUMN IF NOT EXISTS "processingWorkerId" TEXT;

CREATE INDEX IF NOT EXISTS "ttlock_callback_inbox_status_processingLeaseUntil_idx"
  ON "ttlock_callback_inbox"("status", "processingLeaseUntil");
