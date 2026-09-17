export function buildOtpEmailHtml(opts: {
  code: string;
  expiryMinutes: number;
}): string {
  const { code, expiryMinutes } = opts;
  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ijara AI — Tasdiqlash kodi</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px 8px;color:#f8fafc;font-size:22px;font-weight:600;">
              Ijara AI
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
              Salom!<br /><br />
              Ijara AI akkauntingizga kirish uchun tasdiqlash kodingiz:
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 28px 24px;">
              <div style="display:inline-block;padding:16px 28px;background:#0ea5e9;color:#ffffff;font-size:32px;font-weight:700;letter-spacing:8px;border-radius:12px;">
                ${code}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;color:#94a3b8;font-size:14px;line-height:1.6;">
              Kod ${expiryMinutes} daqiqa davomida amal qiladi.<br /><br />
              Agar bu so‘rovni siz yubormagan bo‘lsangiz, xabarni e’tiborsiz qoldiring.
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#0f172a;color:#64748b;font-size:12px;">
              Ijara AI · ijaraai.uz
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOtpEmailSubject(): string {
  return "Ijara AI — Tasdiqlash kodi";
}
