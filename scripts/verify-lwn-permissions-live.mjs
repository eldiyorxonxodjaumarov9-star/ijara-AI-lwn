/** Dev server (Neon) ustida faqat ruxsat tekshiruvlari — yozuv/migratsiya yo'q. */
import fs from "fs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    process.env[k] = v;
  }
}

loadEnvLocal();
const BASE = "http://localhost:3000";
const LWN = "LWN";
const prisma = new PrismaClient();

async function api(method, path, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const user = await prisma.user.findFirst({ where: { isActive: true } });
const lwn = await prisma.property.findFirst({
  where: { OR: [{ building: LWN }, { district: LWN }] },
  select: { id: true },
});
const nonLwn = await prisma.property.findFirst({
  where: { NOT: { OR: [{ building: LWN }, { district: LWN }] } },
  select: { id: true },
});

const secret = process.env.JWT_ACCESS_SECRET;
const token =
  user && secret
    ? jwt.sign({ sub: user.id, email: user.email, role: user.role }, secret, {
        expiresIn: "15m",
      })
    : null;

console.log("unauth", await api("GET", `/api/lwn-rooms/${lwn?.id ?? "x"}/lock-settings`));
console.log(
  "bad-token",
  await api("GET", `/api/lwn-rooms/${lwn?.id ?? "x"}/lock-settings`, "bad")
);
if (token && nonLwn)
  console.log("non-lwn", await api("GET", `/api/lwn-rooms/${nonLwn.id}/lock-settings`, token));
if (token && lwn)
  console.log("lwn-get", await api("GET", `/api/lwn-rooms/${lwn.id}/lock-settings`, token));

await prisma.$disconnect();
