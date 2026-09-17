-- Additive: email OTP verification table (passwordless auth)
CREATE TABLE IF NOT EXISTS "email_otp_verifications" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_otp_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_otp_verifications_email_consumedAt_idx"
  ON "email_otp_verifications"("email", "consumedAt");

CREATE INDEX IF NOT EXISTS "email_otp_verifications_expiresAt_idx"
  ON "email_otp_verifications"("expiresAt");
