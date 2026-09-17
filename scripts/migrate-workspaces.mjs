/**
 * Production-safe workspace backfill.
 * - Creates internal workspace if missing
 * - Attaches SUPER_ADMIN / EMPLOYEE users
 * - Sets workspaceId on rows where it is null
 * - NEVER deletes data
 *
 * Usage: npx tsx scripts/migrate-workspaces.mjs
 */
import fs from "node:fs";
import { createRequire } from "node:module";

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

const SLUG = "internal-ijara-ai";

async function main() {
  console.log("[migrate-workspaces] start (non-destructive)");

  let ws = await prisma.workspace.findFirst({ where: { isInternal: true } });
  if (!ws) {
    ws = await prisma.workspace.findFirst({ where: { slug: SLUG } });
  }
  if (!ws) {
    ws = await prisma.workspace.create({
      data: {
        name: "Ijara AI (Internal)",
        slug: SLUG,
        isInternal: true,
        subscription: {
          create: {
            status: "ACTIVE",
            plan: "internal",
            startedAt: new Date(),
          },
        },
      },
    });
    console.log("[migrate-workspaces] created internal workspace", ws.id);
  } else {
    console.log("[migrate-workspaces] using workspace", ws.id);
  }

  const wsId = ws.id;

  const adminUp = await prisma.user.updateMany({
    where: { role: "SUPER_ADMIN", isInternalAccount: false },
    data: { isInternalAccount: true },
  });
  console.log("[migrate-workspaces] marked SUPER_ADMIN internal:", adminUp.count);

  const legacy = await prisma.user.findMany({
    where: {
      OR: [
        { isInternalAccount: true },
        { role: "SUPER_ADMIN" },
        { role: "EMPLOYEE" },
      ],
      workspaceMemberships: { none: {} },
    },
    select: { id: true, role: true },
  });
  for (const u of legacy) {
    await prisma.workspaceMembership.create({
      data: {
        workspaceId: wsId,
        userId: u.id,
        role: u.role === "EMPLOYEE" ? "EMPLOYEE" : "OWNER",
      },
    });
  }
  console.log("[migrate-workspaces] legacy memberships:", legacy.length);

  const tables = [
    "property",
    "tenant",
    "contract",
    "payment",
    "expense",
    "maintenance",
    "employee",
    "partnerCompany",
    "client",
    "contactLead",
    "workTask",
    "notification",
  ];

  for (const key of tables) {
    const model = prisma[key];
    const res = await model.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: wsId },
    });
    console.log(`[migrate-workspaces] ${key} backfill:`, res.count);
  }

  const company = await prisma.company.findFirst();
  if (company && !company.workspaceId) {
    await prisma.company.update({
      where: { id: company.id },
      data: { workspaceId: wsId },
    });
    console.log("[migrate-workspaces] linked company profile");
  }

  console.log("[migrate-workspaces] done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
