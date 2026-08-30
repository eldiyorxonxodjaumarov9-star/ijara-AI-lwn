-- TTLock phase7: access sync SENT holati (API’ga yuborilgan, hali ACTIVE emas)
-- Neon’ga qo‘llanmagan. Oldingi migrationlar o‘zgartirilmagan.

ALTER TYPE "TtlockAccessSyncStatus" ADD VALUE IF NOT EXISTS 'SENT';
