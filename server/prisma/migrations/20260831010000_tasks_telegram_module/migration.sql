-- Vazifalar (WorkTask) + Telegram linking — additive only
-- Production yozuvlarini o'chirmaydi / DROP/TRUNCATE yo'q.

-- Employee Telegram link
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "telegramUserId" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "telegramLinkedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "employees_telegramChatId_key" ON "employees"("telegramChatId");

-- Telegram session wizard fields
ALTER TABLE "telegram_sessions" ADD COLUMN IF NOT EXISTS "wizardJson" TEXT;
ALTER TABLE "telegram_sessions" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "telegram_sessions" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "telegram_sessions_employeeId_idx" ON "telegram_sessions"("employeeId");
CREATE INDEX IF NOT EXISTS "telegram_sessions_expiresAt_idx" ON "telegram_sessions"("expiresAt");

-- Update dedupe
CREATE TABLE IF NOT EXISTS "telegram_processed_updates" (
    "updateId" BIGINT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_processed_updates_pkey" PRIMARY KEY ("updateId")
);

-- Enums
DO $$ BEGIN
  CREATE TYPE "WorkTaskUnit" AS ENUM ('SUNNUR', 'LWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WorkTaskSource" AS ENUM ('WEB', 'TELEGRAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WorkTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WorkTaskStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'NOT_COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WorkTaskTelegramDelivery" AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WorkTaskReportReviewStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "WorkTaskAttachmentType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "work_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unit" "WorkTaskUnit" NOT NULL,
    "assignedEmployeeId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "source" "WorkTaskSource" NOT NULL DEFAULT 'WEB',
    "priority" "WorkTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "status" "WorkTaskStatus" NOT NULL DEFAULT 'NEW',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notCompletedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "telegramDelivery" "WorkTaskTelegramDelivery" NOT NULL DEFAULT 'PENDING',
    "telegramLastError" TEXT,
    "telegramMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "work_task_reports" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reportText" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "reviewStatus" "WorkTaskReportReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_task_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "work_task_attachments" (
    "id" TEXT NOT NULL,
    "taskReportId" TEXT NOT NULL,
    "type" "WorkTaskAttachmentType" NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "telegramFileId" TEXT,
    "telegramFileUniqueId" TEXT,
    "originalName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_task_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "work_task_status_events" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromStatus" "WorkTaskStatus",
    "toStatus" "WorkTaskStatus" NOT NULL,
    "actorUserId" TEXT,
    "actorKind" TEXT NOT NULL DEFAULT 'SYSTEM',
    "source" "WorkTaskSource" NOT NULL DEFAULT 'WEB',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_task_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "work_tasks_status_idx" ON "work_tasks"("status");
CREATE INDEX IF NOT EXISTS "work_tasks_unit_idx" ON "work_tasks"("unit");
CREATE INDEX IF NOT EXISTS "work_tasks_assignedEmployeeId_idx" ON "work_tasks"("assignedEmployeeId");
CREATE INDEX IF NOT EXISTS "work_tasks_createdByUserId_idx" ON "work_tasks"("createdByUserId");
CREATE INDEX IF NOT EXISTS "work_tasks_dueAt_idx" ON "work_tasks"("dueAt");
CREATE INDEX IF NOT EXISTS "work_tasks_priority_idx" ON "work_tasks"("priority");
CREATE INDEX IF NOT EXISTS "work_tasks_telegramDelivery_idx" ON "work_tasks"("telegramDelivery");
CREATE INDEX IF NOT EXISTS "work_tasks_createdAt_idx" ON "work_tasks"("createdAt");

CREATE INDEX IF NOT EXISTS "work_task_reports_taskId_idx" ON "work_task_reports"("taskId");
CREATE INDEX IF NOT EXISTS "work_task_reports_employeeId_idx" ON "work_task_reports"("employeeId");
CREATE INDEX IF NOT EXISTS "work_task_reports_reviewStatus_idx" ON "work_task_reports"("reviewStatus");

CREATE INDEX IF NOT EXISTS "work_task_attachments_taskReportId_idx" ON "work_task_attachments"("taskReportId");

CREATE INDEX IF NOT EXISTS "work_task_status_events_taskId_idx" ON "work_task_status_events"("taskId");
CREATE INDEX IF NOT EXISTS "work_task_status_events_createdAt_idx" ON "work_task_status_events"("createdAt");

DO $$ BEGIN
  ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_assignedEmployeeId_fkey"
    FOREIGN KEY ("assignedEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "work_task_reports" ADD CONSTRAINT "work_task_reports_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "work_task_reports" ADD CONSTRAINT "work_task_reports_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "work_task_reports" ADD CONSTRAINT "work_task_reports_reviewedByUserId_fkey"
    FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "work_task_attachments" ADD CONSTRAINT "work_task_attachments_taskReportId_fkey"
    FOREIGN KEY ("taskReportId") REFERENCES "work_task_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "work_task_status_events" ADD CONSTRAINT "work_task_status_events_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "work_task_status_events" ADD CONSTRAINT "work_task_status_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
