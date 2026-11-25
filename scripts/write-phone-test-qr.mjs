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

const QRCode = require("qrcode");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const row = await prisma.feedbackQrCode.findFirst({
  where: { codeIndex: 1 },
  orderBy: { createdAt: "asc" },
});
if (!row) throw new Error("QR 01 missing");
const origin = (process.env.IJARA_QR_PUBLIC_ORIGIN || "").replace(/\/$/, "");
if (!origin || /localhost|127\.0\.0\.1/i.test(origin)) {
  throw new Error("IJARA_QR_PUBLIC_ORIGIN must be LAN/tunnel, not localhost");
}
const url = `${origin}/f/${row.publicToken}`;
fs.mkdirSync(path.join(root, ".data"), { recursive: true });
await QRCode.toFile(path.join(root, ".data", "qr-phone-test.png"), url, {
  width: 900,
  margin: 2,
  errorCorrectionLevel: "M",
});
fs.writeFileSync(path.join(root, ".data", "qr-phone-test-url.txt"), url);
console.log(url);
await prisma.$disconnect();
