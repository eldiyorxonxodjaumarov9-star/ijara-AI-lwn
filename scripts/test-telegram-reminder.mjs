import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"\r\n]+)"?$/);
  if (m) process.env[m[1]] ??= m[2];
}

const slot = process.argv[2] ?? "morning";
const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.arendaai.uz"}/api/cron/payment-reminders?slot=${slot}`;
const secret = process.env.CRON_SECRET;

const res = await fetch(url, {
  headers: secret ? { Authorization: `Bearer ${secret}` } : {},
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
