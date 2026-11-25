/**
 * Local dry-run: submit QR 01 + QR 32 feedback and verify Telegram delivery=SENT (dry-run).
 * Does NOT call real Telegram API when IJARA_QR_FEEDBACK_TELEGRAM_DRY_RUN=1.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

process.env.IJARA_QR_FEEDBACK_TELEGRAM_ENABLED = "true";
process.env.IJARA_QR_FEEDBACK_TELEGRAM_DRY_RUN = "1";

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function waitDelivery(id) {
  for (let i = 0; i < 20; i += 1) {
    const row = await prisma.cleanlinessFeedback.findUnique({ where: { id } });
    if (row && row.telegramDelivery !== "PENDING") return row;
    await new Promise((r) => setTimeout(r, 150));
  }
  return prisma.cleanlinessFeedback.findUnique({ where: { id } });
}

async function submitViaHttp(token, rating, comment) {
  const origin = "http://127.0.0.1:3000";
  const form = new FormData();
  form.set("rating", String(rating));
  form.set("comment", comment);
  form.set("idempotencyKey", `smoke-tg-${token.slice(0, 8)}-${Date.now()}`);
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUWFxUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/9oADAMBAAIQAxAAAAGhQf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
    "base64"
  );
  form.append("photos", new Blob([jpeg], { type: "image/jpeg" }), "smoke.jpg");
  const res = await fetch(`${origin}/api/public/feedback/${token}`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(JSON.stringify(json));
  }
  return json.data;
}

const q01 = await prisma.feedbackQrCode.findFirst({
  where: { codeIndex: 1 },
  orderBy: { createdAt: "asc" },
});
const q32 = await prisma.feedbackQrCode.findFirst({
  where: { codeIndex: 32 },
  orderBy: { createdAt: "asc" },
});
if (!q01 || !q32) throw new Error("QR 01/32 missing");

const a = await submitViaHttp(q01.publicToken, 5, "Smoke QR01 dry-run");
const b = await submitViaHttp(q32.publicToken, 1, "Smoke QR32 dry-run salbiy");
const ra = await waitDelivery(a.feedbackId);
const rb = await waitDelivery(b.feedbackId);

console.log(
  JSON.stringify(
    {
      q01: {
        id: a.feedbackId,
        delivery: ra?.telegramDelivery,
        msg: ra?.telegramMessageId,
      },
      q32: {
        id: b.feedbackId,
        delivery: rb?.telegramDelivery,
        msg: rb?.telegramMessageId,
        error: rb?.telegramLastError,
      },
      dryRun: process.env.IJARA_QR_FEEDBACK_TELEGRAM_DRY_RUN,
    },
    null,
    2
  )
);

const ok =
  ra?.telegramDelivery === "SENT" &&
  rb?.telegramDelivery === "SENT" &&
  String(ra.telegramMessageId || "").startsWith("dry-run:");
console.log(ok ? "TELEGRAM_DRY_RUN_OK" : "TELEGRAM_DRY_RUN_FAIL");
await prisma.$disconnect();
process.exit(ok ? 0 : 1);
