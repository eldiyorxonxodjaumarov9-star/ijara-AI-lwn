-- Additive: QR cleanliness feedback (Stage 1+2)
-- Safe for existing contracts / tenants / tasks / attendance / debts.

CREATE TYPE "CleanlinessRating" AS ENUM ('VERY_BAD', 'BAD', 'AVERAGE', 'GOOD', 'EXCELLENT');
CREATE TYPE "CleanlinessFeedbackStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED');
CREATE TYPE "CleanlinessFeedbackTelegramDelivery" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "feedback_qr_codes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "codeIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "locationLabel" TEXT,
    "publicToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_qr_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cleanliness_feedbacks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "rating" "CleanlinessRating" NOT NULL,
    "ratingValue" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "CleanlinessFeedbackStatus" NOT NULL DEFAULT 'NEW',
    "clientIpHash" TEXT,
    "userAgent" TEXT,
    "telegramDelivery" "CleanlinessFeedbackTelegramDelivery" NOT NULL DEFAULT 'PENDING',
    "telegramMessageId" TEXT,
    "telegramLastError" TEXT,
    "telegramNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleanliness_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cleanliness_feedback_photos" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cleanliness_feedback_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedback_status_events" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "fromStatus" "CleanlinessFeedbackStatus",
    "toStatus" "CleanlinessFeedbackStatus" NOT NULL,
    "actorUserId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_status_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feedback_qr_codes_publicToken_key" ON "feedback_qr_codes"("publicToken");
CREATE UNIQUE INDEX "feedback_qr_codes_workspaceId_codeIndex_key" ON "feedback_qr_codes"("workspaceId", "codeIndex");
CREATE INDEX "feedback_qr_codes_workspaceId_active_idx" ON "feedback_qr_codes"("workspaceId", "active");

CREATE INDEX "cleanliness_feedbacks_workspaceId_createdAt_idx" ON "cleanliness_feedbacks"("workspaceId", "createdAt");
CREATE INDEX "cleanliness_feedbacks_qrCodeId_createdAt_idx" ON "cleanliness_feedbacks"("qrCodeId", "createdAt");
CREATE INDEX "cleanliness_feedbacks_status_idx" ON "cleanliness_feedbacks"("status");
CREATE INDEX "cleanliness_feedbacks_ratingValue_idx" ON "cleanliness_feedbacks"("ratingValue");
CREATE INDEX "cleanliness_feedbacks_telegramDelivery_idx" ON "cleanliness_feedbacks"("telegramDelivery");

CREATE INDEX "cleanliness_feedback_photos_feedbackId_idx" ON "cleanliness_feedback_photos"("feedbackId");
CREATE INDEX "feedback_status_events_feedbackId_createdAt_idx" ON "feedback_status_events"("feedbackId", "createdAt");

ALTER TABLE "feedback_qr_codes" ADD CONSTRAINT "feedback_qr_codes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleanliness_feedbacks" ADD CONSTRAINT "cleanliness_feedbacks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleanliness_feedbacks" ADD CONSTRAINT "cleanliness_feedbacks_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "feedback_qr_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleanliness_feedback_photos" ADD CONSTRAINT "cleanliness_feedback_photos_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "cleanliness_feedbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_status_events" ADD CONSTRAINT "feedback_status_events_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "cleanliness_feedbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
