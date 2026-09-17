export function isEmailSendingConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getEmailFrom(): string {
  return (
    process.env.EMAIL_FROM?.trim() || "Ijara AI <noreply@ijaraai.uz>"
  );
}

export function getOtpExpiryMinutes(): number {
  const raw = process.env.EMAIL_OTP_EXPIRY_MINUTES?.trim();
  const n = raw ? Number(raw) : 10;
  if (!Number.isFinite(n) || n < 1 || n > 60) return 10;
  return Math.floor(n);
}

export function getOtpMaxAttempts(): number {
  return 5;
}

export function getOtpResendCooldownSec(): number {
  return 60;
}
