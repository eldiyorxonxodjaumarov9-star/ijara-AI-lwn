/**
 * DATABASE_URL manbasini maxfiy qiymatlarsiz klassifikatsiya qiladi.
 * Chiqish: JSON { source, hostKind, providerHint, databaseName }
 */
import fs from "fs";

function parseUrl(raw) {
  if (!raw) return null;
  let val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  try {
    return new URL(val);
  } catch {
    return null;
  }
}

function readDatabaseUrl(filePath) {
  if (!fs.existsSync(filePath)) return null;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("DATABASE_URL=")) {
      return trimmed.slice("DATABASE_URL=".length);
    }
  }
  return null;
}

function classifyHost(hostname) {
  const h = (hostname || "").toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return "localhost";
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h))
    return "private-network";
  if (h.includes("neon.tech")) return "cloud-neon";
  if (h.includes("supabase")) return "cloud-supabase";
  if (h.includes("amazonaws.com") || h.includes("rds.amazonaws.com"))
    return "cloud-aws-rds";
  if (h.includes("render.com")) return "cloud-render";
  if (h.endsWith(".internal")) return "private-network";
  return "remote-hosted";
}

function classify(source, raw) {
  const url = parseUrl(raw);
  if (!url) return { source, configured: false };
  const hostKind = classifyHost(url.hostname);
  const dbName = url.pathname.replace(/^\//, "").split("?")[0] || "(unknown)";
  const ssl = url.searchParams.get("sslmode") || url.searchParams.get("ssl") || null;
  const isProductionLikely =
    hostKind.startsWith("cloud-") ||
    (hostKind === "remote-hosted" && ssl === "require");
  return {
    source,
    configured: true,
    hostKind,
    databaseName: dbName,
    sslMode: ssl,
    productionLikely: isProductionLikely,
    safeForLocalMigration: hostKind === "localhost" || hostKind === "private-network",
  };
}

const results = [];
if (process.env.DATABASE_URL) {
  results.push(classify("process.env.DATABASE_URL", process.env.DATABASE_URL));
}
results.push(classify(".env", readDatabaseUrl(".env")));
results.push(classify(".env.local", readDatabaseUrl(".env.local")));
results.push(classify("server/.env", readDatabaseUrl("server/.env")));

// prisma-env.mjs tartibi: .env keyin .env.local (override)
let merged = readDatabaseUrl(".env");
const local = readDatabaseUrl(".env.local");
if (local) merged = local;
results.push(classify("prisma-env.mjs-effective", merged));

console.log(JSON.stringify(results, null, 2));
