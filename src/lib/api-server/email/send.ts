import {
  getEmailFrom,
  getOtpExpiryMinutes,
  isEmailSendingConfigured,
} from "@/lib/api-server/email/config";
import {
  buildOtpEmailHtml,
  buildOtpEmailSubject,
} from "@/lib/api-server/email/templates/otp-email";

export { isEmailSendingConfigured };

export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

export async function sendOtpEmail(opts: {
  to: string;
  code: string;
}): Promise<void> {
  if (!isEmailSendingConfigured()) {
    throw new EmailSendError("Email provider sozlanmagan", 503);
  }

  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = getEmailFrom();
  const expiryMinutes = getOtpExpiryMinutes();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: buildOtpEmailSubject(),
      html: buildOtpEmailHtml({ code: opts.code, expiryMinutes }),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[email/send] Resend error", res.status, body.slice(0, 200));
    throw new EmailSendError("Email yuborib bo‘lmadi", 502);
  }
}
