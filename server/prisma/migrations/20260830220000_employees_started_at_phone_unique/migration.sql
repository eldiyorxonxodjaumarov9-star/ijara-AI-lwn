-- Xodimlar moduli: startedAt + phone unique (nullable unique — bir nechta NULL ruxsat)
-- Production yozuvlarini o'chirmaydi / destructive reset talab qilmaydi.

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

-- Bo'sh string telefonlarni NULL qilish (unique uchun)
UPDATE "employees" SET "phone" = NULL WHERE "phone" IS NOT NULL AND btrim("phone") = '';

CREATE UNIQUE INDEX IF NOT EXISTS "employees_phone_key" ON "employees"("phone");
