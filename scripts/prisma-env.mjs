/**
 * Prisma CLI faqat .env ni o'qiydi; Next.js esa .env.local dan DATABASE_URL oladi.
 * Bu skript ikkalasini birlashtirib prisma buyruqlarini ishga tushiradi.
 */
import fs from "fs";
import { spawnSync } from "child_process";

function loadEnvFile(filePath, override = false) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Foydalanish: node scripts/prisma-env.mjs <prisma-args>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL topilmadi. .env yoki .env.local fayliga qo'shing.\n" +
      'Misol: DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"'
  );
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
