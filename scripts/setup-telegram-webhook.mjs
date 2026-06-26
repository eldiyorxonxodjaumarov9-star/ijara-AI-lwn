import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const match = envText.match(/TELEGRAM_BOT_TOKEN\s*=\s*"?([^"\r\n]+)"?/m);
const token = match?.[1] ?? process.env.TELEGRAM_BOT_TOKEN;
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://www.arendaai.uz";

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN topilmadi (.env.local)");
  process.exit(1);
}

const webhookUrl = `${appUrl}/api/telegram/webhook`;

const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  }),
});
const setData = await setRes.json();
console.log("setWebhook:", setData.ok ? "OK" : "FAIL", setData.description ?? "");

const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const infoData = await infoRes.json();
console.log("webhook url:", infoData.result?.url ?? "—");
console.log("pending:", infoData.result?.pending_update_count ?? 0);

if (!setData.ok) process.exit(1);
