/**
 * Production-safe ADDITIVE workspace schema apply.
 * NEVER DROP / DELETE.
 *
 * Usage: npx tsx scripts/apply-workspace-schema.mjs
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);

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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const root = process.cwd();

async function main() {
  console.log("[apply-workspace-schema] additive only — no drops");
  const mod = await import(
    pathToFileURL(path.join(root, "src/lib/api-server/workspace-schema-sql.ts")).href
  );
  const result = await mod.applyWorkspaceSchemaAdditive(prisma);
  console.log("[apply-workspace-schema] OK", result);
  console.log("[apply-workspace-schema] next: node scripts/migrate-workspaces.mjs");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
