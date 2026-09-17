import { ok } from "@/lib/api-server/http";

export async function GET() {
  const smsProviderConfigured =
    process.env.SMS_PROVIDER_ENABLED === "true" ||
    Boolean(process.env.SMS_PROVIDER_API_KEY || process.env.TWILIO_AUTH_TOKEN);

  const message = smsProviderConfigured
    ? "Telefon orqali OTP ro'yxatdan o'tish mavjud."
    : "Telefon orqali OTP ro'yxatdan o'tish SMS provayder ulanguncha mavjud emas.";

  return ok({ smsProviderConfigured, message });
}
