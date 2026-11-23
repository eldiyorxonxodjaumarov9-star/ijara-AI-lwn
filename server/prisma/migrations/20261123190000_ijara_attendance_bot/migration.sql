-- Additive: Ijara Attendance Bot (independent of main Telegram bot)
-- Safe for existing employees / tasks / contracts / debts.

CREATE TYPE "AttendanceCheckInStatus" AS ENUM ('KELDI', 'KETDI');
CREATE TYPE "AttendanceProfileStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

CREATE TABLE "attendance_bot_links" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "telegramDisplayName" TEXT,
    "profileStatus" "AttendanceProfileStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "phone" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectReason" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_bot_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_check_ins" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "workDate" TEXT NOT NULL,
    "status" "AttendanceCheckInStatus" NOT NULL DEFAULT 'KELDI',
    "verificationStatus" "AttendanceProfileStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "selfieFileId" TEXT NOT NULL,
    "selfieUniqueId" TEXT,
    "telegramMessageId" TEXT,
    "selfieStorageKey" TEXT,
    "selfieStorageUrl" TEXT,
    "selfieMimeType" TEXT,
    "selfieByteSize" INTEGER,
    "selfieFetchedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_check_ins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "linkId" TEXT,
    "employeeId" TEXT,
    "checkInId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_bot_processed_updates" (
    "updateId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_bot_processed_updates_pkey" PRIMARY KEY ("updateId")
);

CREATE UNIQUE INDEX "attendance_bot_links_telegramUserId_key" ON "attendance_bot_links"("telegramUserId");
CREATE UNIQUE INDEX "attendance_bot_links_employeeId_workspaceId_key" ON "attendance_bot_links"("employeeId", "workspaceId");
CREATE INDEX "attendance_bot_links_workspaceId_idx" ON "attendance_bot_links"("workspaceId");
CREATE INDEX "attendance_bot_links_telegramChatId_idx" ON "attendance_bot_links"("telegramChatId");
CREATE INDEX "attendance_bot_links_profileStatus_idx" ON "attendance_bot_links"("profileStatus");

CREATE UNIQUE INDEX "attendance_check_ins_employeeId_workDate_key" ON "attendance_check_ins"("employeeId", "workDate");
CREATE INDEX "attendance_check_ins_workspaceId_workDate_idx" ON "attendance_check_ins"("workspaceId", "workDate");
CREATE INDEX "attendance_check_ins_linkId_idx" ON "attendance_check_ins"("linkId");
CREATE INDEX "attendance_check_ins_verificationStatus_idx" ON "attendance_check_ins"("verificationStatus");
CREATE INDEX "attendance_check_ins_createdAt_idx" ON "attendance_check_ins"("createdAt");

CREATE INDEX "attendance_audit_logs_workspaceId_createdAt_idx" ON "attendance_audit_logs"("workspaceId", "createdAt");
CREATE INDEX "attendance_audit_logs_linkId_idx" ON "attendance_audit_logs"("linkId");

ALTER TABLE "attendance_bot_links" ADD CONSTRAINT "attendance_bot_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_bot_links" ADD CONSTRAINT "attendance_bot_links_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_check_ins" ADD CONSTRAINT "attendance_check_ins_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_check_ins" ADD CONSTRAINT "attendance_check_ins_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_check_ins" ADD CONSTRAINT "attendance_check_ins_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "attendance_bot_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
