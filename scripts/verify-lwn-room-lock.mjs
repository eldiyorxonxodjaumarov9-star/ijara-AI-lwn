/**
 * LWN xona qulf API tekshiruvi — faqat localhost bazada.
 * server/.env DATABASE_URL + .env.local JWT (Neon DATABASE_URL ishlatilmaydi).
 *
 * Ishga tushirish: node scripts/verify-lwn-room-lock.mjs
 * Oldin: localhost PostgreSQL + ensure-room-lock-settings.sql qo'llangan bo'lishi kerak.
 */
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

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
    if (override || process.env[key] === undefined) process.env[key] = val;
  }
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

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
}

const dbUrl = readDatabaseUrl("server/.env");
if (!dbUrl || classifyHost(dbUrl) !== "localhost") {
  fail("db-target", "server/.env localhost DATABASE_URL talab qilinadi");
  console.log(JSON.stringify({ results }, null, 2));
  process.exit(1);
}

loadEnvFile(".env.local", true);
process.env.DATABASE_URL = dbUrl;

const prisma = new PrismaClient();
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const LWN = "LWN";

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    pass("db-connect", "localhost");
  } catch (e) {
    fail("db-connect", e instanceof Error ? e.message : String(e));
    console.log(JSON.stringify({ results }, null, 2));
    process.exit(1);
  }

  const tableCheck = await prisma.$queryRaw`
    SELECT to_regclass('public.room_lock_settings') AS t
  `;
  if (!tableCheck?.[0]?.t) {
    fail("db-tables", "room_lock_settings jadvali yo'q — avval apply-local-room-lock-sql.mjs");
    console.log(JSON.stringify({ results }, null, 2));
    process.exit(1);
  }
  pass("db-tables", "room_lock_settings mavjud");

  const lwnRooms = await prisma.property.findMany({
    where: { OR: [{ building: LWN }, { district: LWN }] },
    take: 2,
    select: { id: true, title: true },
  });
  if (lwnRooms.length < 1) {
    fail("fixtures", "LWN xonalari topilmadi");
    console.log(JSON.stringify({ results }, null, 2));
    process.exit(1);
  }
  const roomA = lwnRooms[0];
  const roomB = lwnRooms[1] ?? lwnRooms[0];
  pass("fixtures", `roomA=${roomA.id.slice(0, 8)}…`);

  const nonLwn = await prisma.property.findFirst({
    where: { NOT: { OR: [{ building: LWN }, { district: LWN }] } },
    select: { id: true },
  });

  const user = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    fail("auth-user", "Faol foydalanuvchi yo'q");
    process.exit(1);
  }

  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret) {
    fail("auth-jwt", "JWT_ACCESS_SECRET .env.local da yo'q");
    process.exit(1);
  }
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    accessSecret,
    { expiresIn: "15m" }
  );
  pass("auth-token", user.email);

  // --- autentifikatsiyasiz ---
  const unauth = await api("GET", `/api/lwn-rooms/${roomA.id}/lock-settings`);
  if (unauth.status === 401) pass("perm-unauth", "401");
  else fail("perm-unauth", `kutilgan 401, olindi ${unauth.status}`);

  // --- non-LWN ---
  if (nonLwn) {
    const bad = await api("GET", `/api/lwn-rooms/${nonLwn.id}/lock-settings`, null, token);
    if (bad.status === 403) pass("perm-non-lwn", "403");
    else fail("perm-non-lwn", `kutilgan 403, olindi ${bad.status}`);
  } else {
    results.push({ name: "perm-non-lwn", ok: null, detail: "non-LWN xona yo'q — o'tkazildi" });
  }

  // --- lock settings save / get / edit ---
  const save1 = await api(
    "PUT",
    `/api/lwn-rooms/${roomA.id}/lock-settings`,
    {
      providerName: "TestProvider",
      lockName: "TestLock-A",
      deviceId: "dev-test-001",
      notes: "verify-script v1",
    },
    token
  );
  if (save1.status === 200 && save1.json?.data?.lockName === "TestLock-A") {
    pass("lock-save", save1.json.data.lockName);
  } else {
    fail("lock-save", `status=${save1.status}`);
  }

  const get1 = await api("GET", `/api/lwn-rooms/${roomA.id}/lock-settings`, null, token);
  if (get1.status === 200 && get1.json?.data?.deviceId === "dev-test-001") {
    pass("lock-get", get1.json.data.deviceId);
  } else {
    fail("lock-get", `status=${get1.status}`);
  }

  const save2 = await api(
    "PUT",
    `/api/lwn-rooms/${roomA.id}/lock-settings`,
    {
      providerName: "TestProvider",
      lockName: "TestLock-B",
      deviceId: "dev-test-002",
      notes: "verify-script v2",
    },
    token
  );
  if (save2.status === 200 && save2.json?.data?.lockName === "TestLock-B") {
    pass("lock-edit", save2.json.data.lockName);
  } else {
    fail("lock-edit", `status=${save2.status}`);
  }

  // --- grant create PLANNED ---
  const contract = await prisma.contract.findFirst({
    where: {
      propertyId: roomA.id,
      status: { in: ["ACTIVE", "PENDING", "EXPIRED"] },
    },
    select: { tenantId: true },
  });
  if (!contract) {
    fail("grant-create", "roomA da shartnoma yo'q");
  } else {
    const created = await api(
      "POST",
      `/api/lwn-rooms/${roomA.id}/access-grants`,
      {
        tenantId: contract.tenantId,
        permissionType: "pin",
        notes: "verify grant",
      },
      token
    );
    const grantId = created.json?.data?.id;
    if (created.status === 201 && created.json?.data?.status === "planned") {
      pass("grant-create", grantId?.slice(0, 8));
    } else {
      fail("grant-create", `status=${created.status}`);
    }

    if (grantId) {
      const cancelled = await api(
        "PATCH",
        `/api/lwn-rooms/${roomA.id}/access-grants/${grantId}`,
        { status: "cancelled" },
        token
      );
      if (cancelled.status === 200 && cancelled.json?.data?.status === "cancelled") {
        pass("grant-cancel", "cancelled");
      } else {
        fail("grant-cancel", `status=${cancelled.status}`);
      }

      const listAfter = await api(
        "GET",
        `/api/lwn-rooms/${roomA.id}/access-grants`,
        null,
        token
      );
      const row = listAfter.json?.data?.find((g) => g.id === grantId);
      if (row?.status === "cancelled") pass("grant-persist", "GET cancelled");
      else fail("grant-persist", row?.status ?? "topilmadi");

      // cross-room cancel: grant roomA orqali roomB URL
      if (roomB.id !== roomA.id) {
        const cross = await api(
          "PATCH",
          `/api/lwn-rooms/${roomB.id}/access-grants/${grantId}`,
          { status: "cancelled" },
          token
        );
        if (cross.status === 404) pass("perm-cross-room-grant", "404");
        else fail("perm-cross-room-grant", `kutilgan 404, olindi ${cross.status}`);
      }
    }
  }

  // --- boshqa kompaniya: Property da companyId yo'q — hujjatlashtirish ---
  results.push({
    name: "perm-company-scope",
    ok: null,
    detail:
      "Property/Tenant modellarida companyId yo'q — ilova hozir single-tenant; kompaniyalararo izolyatsiya API darajasida amalga oshirilmagan",
  });
  console.log("○ perm-company-scope: single-tenant (companyId yo'q)");

  console.log("\n--- Xulosa ---");
  const failed = results.filter((r) => r.ok === false);
  console.log(JSON.stringify({ passed: results.filter((r) => r.ok === true).length, failed: failed.length, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main()
  .catch((e) => {
    fail("fatal", e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
