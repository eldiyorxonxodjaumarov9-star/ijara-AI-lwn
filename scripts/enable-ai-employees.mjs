import fs from "fs";
import { PrismaClient } from "@prisma/client";

function load(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

load(".env");
load(".env.local");

const prisma = new PrismaClient();
const s = await prisma.agentSettings.upsert({
  where: { id: "default" },
  create: {
    id: "default",
    masterEnabled: true,
    dryRunDefault: true,
    telegramReportsEnabled: false,
    timezone: "Asia/Tashkent",
    dailyReportHour: 8,
  },
  update: {
    masterEnabled: true,
    dryRunDefault: true,
    telegramReportsEnabled: false,
  },
});

console.log(
  JSON.stringify({
    id: s.id,
    masterEnabled: s.masterEnabled,
    dryRunDefault: s.dryRunDefault,
    telegramReportsEnabled: s.telegramReportsEnabled,
  })
);
await prisma.$disconnect();
