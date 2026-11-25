/**
 * Generate PNG for all workspace QR codes and decode payloads with jsQR.
 * Does NOT rotate tokens.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { PNG } from "pngjs";

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
const jsQR = require("jsqr");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function origin() {
  const raw = (
    process.env.IJARA_QR_PUBLIC_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  return raw;
}

async function decodePngBuffer(buf) {
  const png = PNG.sync.read(buf);
  const code = jsQR(new Uint8ClampedArray(png.data.buffer), png.width, png.height);
  return code?.data || null;
}

async function main() {
  const base = origin();
  console.log("configured_origin", base || "(missing)");
  const rows = await prisma.feedbackQrCode.findMany({
    orderBy: { codeIndex: "asc" },
  });
  console.log("qr_count", rows.length);
  const tokens = new Set();
  const urls = new Set();
  let bad = 0;
  for (const row of rows) {
    tokens.add(row.publicToken);
    const expected = `${base}/f/${row.publicToken}`;
    const dataUrl = await QRCode.toDataURL(expected, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
    });
    const buf = Buffer.from(dataUrl.split(",")[1], "base64");
    const decoded = await decodePngBuffer(buf);
    const ok = decoded === expected;
    if (!ok) {
      bad += 1;
      console.log("FAIL", row.codeIndex, { expected, decoded });
    }
    urls.add(decoded || "");
    if (decoded?.includes("localhost") || decoded?.includes("null")) {
      bad += 1;
      console.log("BLOCKED_HOST", row.codeIndex, decoded);
    }
  }
  console.log("unique_tokens", tokens.size);
  console.log("unique_decoded_urls", urls.size);
  console.log("sample", [...urls][0]);
  console.log(bad === 0 && rows.length === 32 && tokens.size === 32 ? "DECODE_OK" : "DECODE_FAIL");
  process.exit(bad === 0 && rows.length === 32 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
