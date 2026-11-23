/**
 * Move mistaken TELEGRAM_BOT_TOKEN bot-token value into IJARA_ATTENDANCE_BOT_TOKEN.
 * Never prints secrets. Local .env.local only.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { config } from "dotenv";

const path = ".env.local";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
let fromMain = "";

const clearedMain = lines.map((line) => {
  const m = line.match(/^TELEGRAM_BOT_TOKEN=(.*)$/);
  if (!m) return line;
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (v && /^\d+:[A-Za-z0-9_-]{20,}$/.test(v)) {
    fromMain = v;
    return 'TELEGRAM_BOT_TOKEN=""';
  }
  return line;
});

if (!fromMain) {
  console.log(JSON.stringify({ ok: false, reason: "no_bot_token_on_TELEGRAM_BOT_TOKEN" }));
  process.exit(1);
}

let moved = false;
let secretSet = false;
const out = clearedMain.map((line) => {
  if (line.match(/^IJARA_ATTENDANCE_BOT_TOKEN=/)) {
    moved = true;
    return `IJARA_ATTENDANCE_BOT_TOKEN="${fromMain}"`;
  }
  if (line.match(/^IJARA_ATTENDANCE_ENABLED=/)) {
    return "IJARA_ATTENDANCE_ENABLED=true";
  }
  if (line.match(/^IJARA_ATTENDANCE_WEBHOOK_SECRET=/)) {
    const cur = line
      .slice("IJARA_ATTENDANCE_WEBHOOK_SECRET=".length)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!cur) {
      secretSet = true;
      return `IJARA_ATTENDANCE_WEBHOOK_SECRET="${crypto.randomBytes(24).toString("hex")}"`;
    }
  }
  return line;
});

if (!moved) {
  out.push(`IJARA_ATTENDANCE_BOT_TOKEN="${fromMain}"`);
  moved = true;
}

fs.writeFileSync(path, out.join("\n"), "utf8");
config({ path, override: true });

const t = process.env.IJARA_ATTENDANCE_BOT_TOKEN || "";
const main = process.env.TELEGRAM_BOT_TOKEN || "";
console.log(
  JSON.stringify(
    {
      ok: true,
      movedToAttendance: /^\d+:/.test(t),
      attendanceLen: t.length,
      mainCleared: main.length === 0,
      enabled: process.env.IJARA_ATTENDANCE_ENABLED,
      secretPresent: Boolean(process.env.IJARA_ATTENDANCE_WEBHOOK_SECRET?.trim()),
      secretWasGenerated: secretSet,
    },
    null,
    2
  )
);
