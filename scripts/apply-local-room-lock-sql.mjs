/**
 * Faqat server/.env dagi localhost bazaga ensure-room-lock-settings.sql qo'llaydi.
 * .env.local (Neon) ishlatilmaydi.
 */
import fs from "fs";
import { spawnSync } from "child_process";

function readDatabaseUrl(filePath) {
  if (!fs.existsSync(filePath)) return null;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("DATABASE_URL=")) {
      let val = trimmed.slice("DATABASE_URL=".length).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return null;
}

function classifyHost(raw) {
  try {
    const h = new URL(raw).hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "::1") return "localhost";
    return "remote";
  } catch {
    return "invalid";
  }
}

const url = readDatabaseUrl("server/.env");
if (!url) {
  console.error("server/.env ichida DATABASE_URL topilmadi.");
  process.exit(1);
}

const hostKind = classifyHost(url);
if (hostKind !== "localhost") {
  console.error(
    `Xavfsizlik: server/.env host=${hostKind}. Migratsiya faqat localhost uchun ruxsat etilgan.`
  );
  process.exit(1);
}

const sqlPath = "scripts/ensure-room-lock-settings.sql";
if (!fs.existsSync(sqlPath)) {
  console.error("SQL fayl topilmadi:", sqlPath);
  process.exit(1);
}

console.log("Maqsad: localhost (server/.env) — ensure-room-lock-settings.sql");

const result = spawnSync(
  "npx",
  [
    "prisma",
    "db",
    "execute",
    "--schema=server/prisma/schema.prisma",
    "--file",
    sqlPath,
  ],
  {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
    shell: true,
  }
);

process.exit(result.status ?? 1);
