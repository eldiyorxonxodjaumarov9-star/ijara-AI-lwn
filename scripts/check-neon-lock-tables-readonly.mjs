/** Neon (productionLikely) bazada jadvallar mavjudligini faqat READ tekshiradi — migratsiya qilmaydi. */
import fs from "fs";
import { PrismaClient } from "@prisma/client";

function readDatabaseUrl(filePath) {
  if (!fs.existsSync(filePath)) return null;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
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
    if (h.includes("neon.tech")) return "cloud-neon";
    if (h === "localhost" || h === "127.0.0.1") return "localhost";
    return "remote";
  } catch {
    return "invalid";
  }
}

const url = readDatabaseUrl(".env.local");
const hostKind = url ? classifyHost(url) : "missing";

if (hostKind !== "cloud-neon") {
  console.log(JSON.stringify({ hostKind, checked: false, reason: "not-neon-or-missing" }));
  process.exit(0);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  const rows = await prisma.$queryRaw`
    SELECT
      to_regclass('public.room_lock_settings') IS NOT NULL AS lock_settings,
      to_regclass('public.room_access_grants') IS NOT NULL AS access_grants,
      to_regclass('public.room_access_log_events') IS NOT NULL AS access_log
  `;
  console.log(
    JSON.stringify({
      hostKind,
      productionLikely: true,
      tables: rows[0],
      note: "Faqat o'qish; migratsiya bajarilmadi",
    })
  );
} catch (e) {
  console.log(
    JSON.stringify({
      hostKind,
      productionLikely: true,
      error: e instanceof Error ? e.message : "connect-failed",
    })
  );
} finally {
  await prisma.$disconnect();
}
