/**
 * Production-safe workspace backfill.
 * - Creates internal workspace if missing
 * - Attaches SUPER_ADMIN / EMPLOYEE users
 * - Sets workspaceId on rows where it is null
 * - NEVER deletes data
 *
 * Usage: node scripts/migrate-workspaces.mjs
 * Requires DATABASE_URL in env.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

try {
  await import("./prisma-env.mjs");
} catch {
  // optional local env loader
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
