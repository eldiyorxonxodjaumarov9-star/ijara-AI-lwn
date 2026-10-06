import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import * as dashboardRoute from "@/app/api/super-admin/dashboard/route";
import { loadPlatformDashboard, RECENT_REGISTRATIONS_LIMIT } from "@/lib/api-server/platform-admin/dashboard";
import { PLATFORM_ADMIN_COOKIE, signPlatformAdminSession } from "@/lib/api-server/platform-admin/session";
import { prisma } from "@/lib/api-server/prisma";
import {
  RECENT_REGISTRATION_COLUMNS,
  SUPER_ADMIN_INDUSTRY_LABELS,
  tashkentDateKey,
  tashkentDayStart,
} from "@/lib/super-admin-dashboard";

// Real aggregation + route code. Only Prisma I/O is replaced by an in-memory evaluator that
// honours the where/select/orderBy/take arguments the code actually sends.
type Row = Record<string, unknown>;
const signingKey = randomBytes(32).toString("hex");
const ENV_KEYS = ["DATABASE_URL", "JWT_ACCESS_SECRET", "PLATFORM_ADMIN_SESSION_SECRET"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const restores: (() => void)[] = [];
let queryCount = 0;
let users: Row[] = [];
let workspaces: Row[] = [];
let subscriptions: Row[] = [];

// 2026-10-06 00:30 Asia/Tashkent
const NOW = new Date("2026-10-05T19:30:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

function cmp(a: unknown, b: unknown) {
  const x = a instanceof Date ? a.getTime() : (a as number | string);
  const y = b instanceof Date ? b.getTime() : (b as number | string);
  return x < y ? -1 : x > y ? 1 : 0;
}

function matches(record: Row | null | undefined, where: Row | undefined): boolean {
  if (!where) return true;
  if (!record) return false;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((w) => matches(record, w));
    if (key === "AND") return (cond as Row[]).every((w) => matches(record, w));
    const value = record[key];
    if (cond === null) return value == null;
    if (typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Row;
      if ("some" in c) return (value as Row[]).some((item) => matches(item, c.some as Row));
      if ("not" in c) return value !== c.not;
      if ("gte" in c) return value != null && cmp(value, c.gte) >= 0;
      return matches(value as Row, c);
    }
    return value === cond;
  });
}

function sortRows(rows: Row[], orderBy: unknown): Row[] {
  const orders = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []) as Record<string, "asc" | "desc">[];
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const [field, dir] = Object.entries(order)[0]!;
      const r = cmp(a[field], b[field]);
      if (r !== 0) return dir === "desc" ? -r : r;
    }
    return 0;
  });
}

function project(record: Row | null, select: Row): Row | null {
  if (!record) return null;
  const out: Row = {};
  for (const [key, spec] of Object.entries(select)) {
    if (spec === true) out[key] = record[key];
    else if (spec && typeof spec === "object") {
      const s = spec as { select: Row; where?: Row; orderBy?: unknown; take?: number };
      const value = record[key];
      if (Array.isArray(value)) {
        const rows = sortRows(value.filter((v) => matches(v, s.where)), s.orderBy);
        out[key] = rows.slice(0, s.take ?? rows.length).map((v) => project(v, s.select));
      } else out[key] = project((value as Row) ?? null, s.select);
    }
  }
  return out;
}

function findMany(rows: () => Row[]) {
  return async (args: { where?: Row; orderBy?: unknown; take?: number; select: Row }) => {
    queryCount += 1;
    const filtered = sortRows(rows().filter((r) => matches(r, args.where)), args.orderBy);
    return filtered.slice(0, args.take ?? filtered.length).map((r) => project(r, args.select));
  };
}
function count(rows: () => Row[]) {
  return async (args: { where?: Row }) => {
    queryCount += 1;
    return rows().filter((r) => matches(r, args.where)).length;
  };
}
function groupBy(rows: () => Row[]) {
  return async (args: { by: string[]; where?: Row }) => {
    queryCount += 1;
    const field = args.by[0]!;
    const groups = new Map<unknown, number>();
    for (const r of rows().filter((row) => matches(row, args.where))) groups.set(r[field], (groups.get(r[field]) ?? 0) + 1);
    return [...groups].map(([value, n]) => ({ [field]: value, _count: { _all: n } }));
  };
}

function stub(model: object, name: string, impl: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, impl);
  restores.push(() => Reflect.set(model, name, original));
}

function addWorkspace(opts: {
  id: string;
  industry?: string;
  createdAt?: Date;
  isInternal?: boolean;
  plan?: string | null;
  status?: string;
  demoEndsAt?: Date | null;
  noSubscription?: boolean;
}) {
  const ws: Row = {
    id: opts.id,
    name: `Biz ${opts.id}`,
    isInternal: opts.isInternal ?? false,
    industry: opts.industry ?? "OTHER",
    createdAt: opts.createdAt ?? hoursAgo(24 * 30),
    subscription: null,
  };
  if (!opts.noSubscription) {
    const sub: Row = {
      workspaceId: opts.id,
      plan: opts.plan === undefined ? "demo" : opts.plan,
      status: opts.status ?? "DEMO",
      demoEndsAt: opts.demoEndsAt === undefined ? null : opts.demoEndsAt,
      workspace: ws,
    };
    ws.subscription = sub;
    subscriptions.push(sub);
  }
  workspaces.push(ws);
  return ws;
}

function addUser(opts: {
  id: string;
  createdAt: Date;
  workspace?: Row;
  memberRole?: string;
  role?: string;
  isInternalAccount?: boolean;
}) {
  users.push({
    id: opts.id,
    email: `${opts.id}@example.invalid`,
    fullName: `User ${opts.id}`,
    phone: "+998901112233",
    role: opts.role ?? "ADMIN",
    isInternalAccount: opts.isInternalAccount ?? false,
    createdAt: opts.createdAt,
    password: "$2b$10$SECRETHASHSHOULDNEVERLEAK",
    refreshTokenHash: "$2b$10$REFRESHHASHSHOULDNEVERLEAK",
    resetToken: "reset-token-should-never-leak",
    workspaceMemberships: opts.workspace
      ? [{ role: opts.memberRole ?? "OWNER", createdAt: opts.createdAt, workspace: opts.workspace }]
      : [],
  });
}

function seed() {
  users = [];
  workspaces = [];
  subscriptions = [];
  const internal = addWorkspace({ id: "internal", isInternal: true, plan: "PREMIUM", status: "ACTIVE", industry: "OFFICE_RENTAL" });
  addUser({ id: "platform", createdAt: hoursAgo(1), workspace: internal, role: "SUPER_ADMIN", isInternalAccount: true });

  const wsToday = addWorkspace({ id: "w-today", industry: "OFFICE_RENTAL", createdAt: hoursAgo(0.4), plan: "demo", demoEndsAt: hoursAgo(-24 * 7) });
  const wsLateYesterday = addWorkspace({ id: "w-late", industry: "CAR_RENTAL", createdAt: hoursAgo(0.6), plan: "PRO", status: "ACTIVE" });
  const wsPremium = addWorkspace({ id: "w-prem", industry: "OFFICE_RENTAL", createdAt: hoursAgo(24 * 3), plan: "PREMIUM", status: "ACTIVE" });
  const wsPaid = addWorkspace({ id: "w-paid", industry: "HOTEL_HOSTEL", createdAt: hoursAgo(24 * 5), plan: "paid", status: "PAST_DUE" });
  const wsExpired = addWorkspace({ id: "w-exp", industry: "VILLA_RENTAL", createdAt: hoursAgo(24 * 20), plan: "FREE", demoEndsAt: hoursAgo(24) });
  const wsOld = addWorkspace({ id: "w-old", createdAt: hoursAgo(24 * 7 + 1), plan: null, status: "CANCELED" });
  addWorkspace({ id: "w-nosub", industry: "RETAIL_RENTAL", noSubscription: true });

  // 00:06 Tashkent today
  addUser({ id: "u-today", createdAt: hoursAgo(0.4), workspace: wsToday });
  // 23:54 Tashkent yesterday
  addUser({ id: "u-late", createdAt: hoursAgo(0.6), workspace: wsLateYesterday });
  addUser({ id: "u-prem", createdAt: hoursAgo(24 * 3), workspace: wsPremium });
  addUser({ id: "u-paid", createdAt: hoursAgo(24 * 5), workspace: wsPaid });
  addUser({ id: "u-exp", createdAt: hoursAgo(24 * 20), workspace: wsExpired });
  // 7 days + 1h ago: outside the 7-day window (Sep 29 Tashkent)
  addUser({ id: "u-old", createdAt: hoursAgo(24 * 7 + 1), workspace: wsOld });
  // Invited employee: a user, but not a registration
  addUser({ id: "u-employee", createdAt: hoursAgo(2), workspace: wsPremium, memberRole: "EMPLOYEE", role: "EMPLOYEE" });
}

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;
  delete process.env.PLATFORM_ADMIN_SESSION_SECRET;
  stub(prisma.user, "count", count(() => users));
  stub(prisma.user, "findMany", findMany(() => users));
  stub(prisma.workspace, "count", count(() => workspaces));
  stub(prisma.workspace, "groupBy", groupBy(() => workspaces));
  stub(prisma.workspaceSubscription, "count", count(() => subscriptions));
  stub(prisma.workspaceSubscription, "groupBy", groupBy(() => subscriptions));
  stub(prisma.platformAdmin, "findUnique", async ({ where }: { where: { id: string } }) =>
    where.id === "admin-1"
      ? { id: "admin-1", email: "a@example.invalid", name: "A", isActive: true, passwordHash: "$2b$12$ADMINHASH", lastLoginAt: null }
      : null
  );
});

after(() => {
  restores.reverse().forEach((restore) => restore());
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

beforeEach(() => {
  seed();
  queryCount = 0;
});

const dashboardRequest = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/super-admin/dashboard", { headers });

describe("super admin dashboard API access", () => {
  it("no admin session → 401", async () => {
    assert.equal((await dashboardRoute.GET(dashboardRequest())).status, 401);
  });

  it("ordinary workspace auth → 401", async () => {
    const access = jwt.sign({ sub: "u-today", email: "x", role: "ADMIN", workspaceId: "w-today" }, signingKey);
    assert.equal((await dashboardRoute.GET(dashboardRequest({ authorization: `Bearer ${access}` }))).status, 401);
    assert.equal((await dashboardRoute.GET(dashboardRequest({ cookie: `${PLATFORM_ADMIN_COOKIE}=${access}` }))).status, 401);
  });

  it("valid platform admin → 200 without any sensitive field", async () => {
    const res = await dashboardRoute.GET(
      dashboardRequest({ cookie: `${PLATFORM_ADMIN_COOKIE}=${signPlatformAdminSession("admin-1")}` })
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const text = await res.text();
    for (const leak of ["password", "Hash", "SHOULDNEVERLEAK", "reset-token", "token", "ADMINHASH", "secret"]) {
      assert.equal(text.includes(leak), false, `response leaked ${leak}`);
    }
  });

  it("exposes no mutation handlers", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal(method in dashboardRoute, false, `${method} must not exist`);
    }
  });
});

describe("super admin dashboard aggregation", () => {
  it("KPI counts exclude internal accounts/workspaces", async () => {
    const { kpis, workspaceActivity } = await loadPlatformDashboard(NOW);
    assert.equal(kpis.totalUsers, 7);
    assert.equal(kpis.totalWorkspaces, 7);
    // ACTIVE (w-late, w-prem) + unexpired DEMO (w-today); PAST_DUE/expired/canceled/no-sub excluded
    assert.equal(kpis.activeWorkspaces, 3);
    assert.equal(workspaceActivity.activeSubscriptions, 2);
    assert.equal(workspaceActivity.workspacesCreatedToday, 1);
    assert.equal(workspaceActivity.workspacesCreatedLast7Days, 4);
  });

  it("plan breakdown counts every workspace exactly once using canonical plan normalization", async () => {
    const { kpis, planBreakdown } = await loadPlatformDashboard(NOW);
    assert.equal(kpis.proWorkspaces, 2); // PRO + legacy "paid"
    assert.equal(kpis.premiumWorkspaces, 1);
    assert.equal(kpis.demoWorkspaces, 4); // demo, FREE, null plan, no subscription
    assert.deepEqual(planBreakdown, [
      { plan: "FREE", count: 4 },
      { plan: "PRO", count: 2 },
      { plan: "PREMIUM", count: 1 },
    ]);
    assert.equal(planBreakdown.reduce((a, p) => a + p.count, 0), kpis.totalWorkspaces);
  });

  it("industry breakdown lists all nine industries with correct counts", async () => {
    const { industryBreakdown } = await loadPlatformDashboard(NOW);
    assert.equal(industryBreakdown.length, 9);
    const byIndustry = Object.fromEntries(industryBreakdown.map((i) => [i.industry, i.count]));
    assert.deepEqual(byIndustry, {
      OFFICE_RENTAL: 2,
      APARTMENT_RENTAL: 0,
      HOTEL_HOSTEL: 1,
      CAR_RENTAL: 1,
      RETAIL_RENTAL: 1,
      WAREHOUSE_RENTAL: 0,
      VILLA_RENTAL: 1,
      COMMERCIAL_RENTAL: 0,
      OTHER: 1,
    });
  });

  it("uses the Asia/Tashkent day boundary for today", async () => {
    assert.equal(tashkentDayStart(NOW).toISOString(), "2026-10-05T19:00:00.000Z");
    assert.equal(tashkentDateKey(new Date("2026-10-05T19:00:00.000Z")), "2026-10-06");
    assert.equal(tashkentDateKey(new Date("2026-10-05T18:59:59.999Z")), "2026-10-05");
    const { kpis } = await loadPlatformDashboard(NOW);
    assert.equal(kpis.todayRegistrations, 1); // u-today only; u-late was 23:54 yesterday
  });

  it("7-day trend has seven Tashkent dates oldest→newest with correct counts", async () => {
    const { registrationTrend, kpis } = await loadPlatformDashboard(NOW);
    assert.deepEqual(registrationTrend, [
      { date: "2026-09-30", count: 0 },
      { date: "2026-10-01", count: 1 }, // u-paid, 00:30 Tashkent
      { date: "2026-10-02", count: 0 },
      { date: "2026-10-03", count: 1 }, // u-prem, 00:30 Tashkent
      { date: "2026-10-04", count: 0 },
      { date: "2026-10-05", count: 1 }, // u-late
      { date: "2026-10-06", count: 1 }, // u-today
    ]);
    assert.equal(kpis.last7DaysRegistrations, 4);
  });

  it("recent registrations: owners only, newest first, max 10", async () => {
    for (let i = 0; i < 15; i += 1) {
      const ws = addWorkspace({ id: `bulk-${i}`, createdAt: hoursAgo(100 + i) });
      addUser({ id: `bulk-${i}`, createdAt: hoursAgo(100 + i), workspace: ws });
    }
    const { recentRegistrations } = await loadPlatformDashboard(NOW);
    assert.equal(recentRegistrations.length, RECENT_REGISTRATIONS_LIMIT);
    const times = recentRegistrations.map((r) => Date.parse(r.registeredAt));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
    assert.equal(recentRegistrations[0]!.id, "u-today");
    assert.equal(recentRegistrations.some((r) => r.id === "u-employee" || r.id === "platform"), false);
    assert.deepEqual(recentRegistrations[1], {
      id: "u-late",
      name: "User u-late",
      email: "u-late@example.invalid",
      phone: "+998901112233",
      business: "Biz w-late",
      industry: "CAR_RENTAL",
      plan: "PRO",
      registeredAt: hoursAgo(0.6).toISOString(),
    });
    for (const row of recentRegistrations) {
      assert.deepEqual(Object.keys(row).sort(), ["business", "email", "id", "industry", "name", "phone", "plan", "registeredAt"]);
    }
  });

  it("issues a bounded, constant number of queries regardless of data size (no N+1)", async () => {
    await loadPlatformDashboard(NOW);
    const small = queryCount;
    for (let i = 0; i < 200; i += 1) {
      const ws = addWorkspace({ id: `many-${i}`, createdAt: hoursAgo(i) });
      addUser({ id: `many-${i}`, createdAt: hoursAgo(i), workspace: ws });
    }
    queryCount = 0;
    await loadPlatformDashboard(NOW);
    assert.equal(queryCount, small);
    assert.equal(small, 10);
  });
});

describe("super admin dashboard UI labels", () => {
  it("recent registration columns (desktop headers + mobile card labels) match the spec", () => {
    assert.deepEqual(
      RECENT_REGISTRATION_COLUMNS.map((c) => c.label),
      ["Ism", "Email", "Telefon", "Biznes", "Industry", "Plan", "Ro‘yxatdan o‘tgan vaqt"]
    );
    const src = readFileSync(join(process.cwd(), "src/app/super-admin/platform-dashboard.tsx"), "utf8");
    const mobile = src.slice(src.indexOf("md:hidden"));
    assert.match(mobile, /RECENT_REGISTRATION_COLUMNS\.map/);
    assert.match(mobile, /<dt[^>]*>\{c\.label\}<\/dt>/);
    assert.match(src, /Oxirgi ro‘yxatdan o‘tganlar/);
  });

  it("industry labels are Uzbek", () => {
    assert.deepEqual(Object.values(SUPER_ADMIN_INDUSTRY_LABELS), [
      "Ofis / biznes markazi",
      "Kvartira / uy",
      "Mehmonxona / hostel",
      "Avtomobil ijarasi",
      "Savdo joylari",
      "Ombor",
      "Dacha / villa",
      "Tijorat ko‘chmas mulki",
      "Boshqa",
    ]);
  });
});
