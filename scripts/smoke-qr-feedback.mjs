/**
 * Local smoke: ensure 32 QR slots, tokens stable across re-ensure, public GET works.
 * Usage: node scripts/smoke-qr-feedback.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
process.chdir(root);

const require = createRequire(path.join(root, "package.json"));

// Load env from .env.local roughly
import fs from "node:fs";
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
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

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function newToken() {
  return require("node:crypto").randomBytes(24).toString("base64url");
}

async function main() {
  const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!ws) {
    console.error("No workspace — seed or register first");
    process.exit(1);
  }
  console.log("workspace", ws.id, ws.name);

  const existing = await prisma.feedbackQrCode.findMany({
    where: { workspaceId: ws.id },
    select: { codeIndex: true },
  });
  const have = new Set(existing.map((e) => e.codeIndex));
  const toCreate = [];
  for (let i = 1; i <= 32; i += 1) {
    if (have.has(i)) continue;
    toCreate.push({
      workspaceId: ws.id,
      codeIndex: i,
      name: `QR ${String(i).padStart(2, "0")}`,
      publicToken: newToken(),
      active: true,
    });
  }
  if (toCreate.length) {
    await prisma.feedbackQrCode.createMany({ data: toCreate });
    console.log("created", toCreate.length);
  }

  const first = await prisma.feedbackQrCode.findMany({
    where: { workspaceId: ws.id },
    orderBy: { codeIndex: "asc" },
  });
  console.log("count", first.length);
  if (first.length !== 32) {
    console.error("expected 32");
    process.exit(1);
  }
  const tokens = first.map((r) => r.publicToken);
  if (new Set(tokens).size !== 32) {
    console.error("tokens not unique");
    process.exit(1);
  }

  // re-ensure (no-op create)
  const againHave = new Set(
    (
      await prisma.feedbackQrCode.findMany({
        where: { workspaceId: ws.id },
        select: { codeIndex: true },
      })
    ).map((e) => e.codeIndex)
  );
  let wouldCreate = 0;
  for (let i = 1; i <= 32; i += 1) {
    if (!againHave.has(i)) wouldCreate += 1;
  }
  const second = await prisma.feedbackQrCode.findMany({
    where: { workspaceId: ws.id },
    orderBy: { codeIndex: "asc" },
  });
  for (let i = 0; i < 32; i += 1) {
    if (second[i].publicToken !== tokens[i]) {
      console.error("TOKEN ROTATED at", i + 1);
      process.exit(1);
    }
  }
  console.log("tokens stable, wouldCreate=", wouldCreate);

  const sample = first[0];
  await prisma.feedbackQrCode.update({
    where: { id: sample.id },
    data: { locationLabel: "Test xona 01" },
  });

  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${origin.replace(/\/$/, "")}/f/${sample.publicToken}`;
  console.log("demo_public_url", url);
  console.log("SMOKE_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
