import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { GET as cronDaily } from "@/app/api/cron/ai-employees-daily/route";
import { GET as dashboard, PATCH as patchSettings } from "@/app/api/ai-employees/route";
import { POST as trigger } from "@/app/api/ai-employees/trigger/route";
import { POST as hermesRuns } from "@/app/api/internal/agent/v1/runs/route";
import { POST as hermesTelegram } from "@/app/api/internal/agent/v1/notifications/telegram/route";
import { GET as hermesOverdue } from "@/app/api/internal/agent/v1/payments/overdue/route";
import { prisma } from "@/lib/api-server/prisma";

const signingKey = randomBytes(32).toString("hex");
const ENV_KEYS = ["DATABASE_URL", "JWT_ACCESS_SECRET", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "CRON_SECRET"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const restores: (() => void)[] = [];
function mock(model: object, name: string, impl: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, impl);
  restores.push(() => Reflect.set(model, name, original));
}

type Row = Record<string, unknown>;
const workspaces = new Map<string, Row>();
const users = new Map<string, { ws: string; role: string }>();
let settingsRows: Row[] = [];
let runWheres: Row[] = [];
let auditWheres: Row[] = [];

function addWorkspace(id: string) {
  workspaces.set(id, {
    id, name: id, slug: null, industry: "OFFICE_RENTAL", isInternal: false, createdAt: new Date(), updatedAt: new Date(),
    demoSeededAt: null, demoDataClearedAt: null,
    subscription: { id: `sub-${id}`, workspaceId: id, status: "ACTIVE", plan: "PREMIUM", startedAt: new Date() },
  });
  for (const role of ["ADMIN", "MANAGER", "EMPLOYEE"]) users.set(`${role.toLowerCase()}-${id}`, { ws: id, role });
}

function req(method: string, url: string, userId?: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (userId) {
    const role = users.get(userId)?.role ?? "ADMIN";
    headers.authorization = `Bearer ${jwt.sign({ sub: userId, email: `${userId}@example.invalid`, role }, signingKey, { expiresIn: "1h" })}`;
  }
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(res: Response) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- route payloads differ per endpoint
  const body = (await res.json()) as { data?: any; error?: any; code?: string };
  return { status: res.status, data: body.data, body };
}

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;
  process.env.CRON_SECRET = "cron-secret-for-tests-0123456789";

  mock(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => {
    const u = users.get(where.id);
    return u
      ? { id: where.id, email: `${where.id}@example.invalid`, fullName: where.id, role: u.role, isActive: true, isInternalAccount: false }
      : null;
  });
  mock(prisma.user, "findMany", async () => []);
  mock(prisma.company, "findFirst", async () => null);
  mock(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => {
    const ws = workspaces.get(users.get(where.userId)?.ws ?? "");
    return ws ? { role: "OWNER", workspace: ws } : null;
  });
  mock(prisma.workspace, "findFirst", async () => ({ id: "internal", isInternal: true }));
  mock(prisma.workspace, "findUnique", async ({ where }: { where: { id: string } }) => workspaces.get(where.id) ?? null);
  mock(prisma.workspaceSubscription, "findUnique", async ({ where }: { where: { workspaceId: string } }) =>
    (workspaces.get(where.workspaceId)?.subscription as Row | undefined) ?? null
  );
  mock(prisma, "$queryRaw", async () => []);
  for (const model of [prisma.user, prisma.property, prisma.tenant, prisma.contract, prisma.employee, prisma.client,
    prisma.payment, prisma.expense, prisma.maintenance, prisma.partnerCompany, prisma.contactLead, prisma.workTask,
    prisma.notification]) {
    mock(model, "updateMany", async () => ({ count: 0 }));
  }

  const findSettings = (where: Row) =>
    settingsRows.find((s) => (where.workspaceId !== undefined ? s.workspaceId === where.workspaceId : s.id === where.id)) ?? null;
  const defaults = { masterEnabled: false, managerEnabled: true, paymentEnabled: true, analystEnabled: true,
    telegramReportsEnabled: false, dryRunDefault: true, dailyReportHour: 8, timezone: "Asia/Tashkent" };
  mock(prisma.agentSettings, "findUnique", async ({ where }: { where: Row }) => findSettings(where));
  mock(prisma.agentSettings, "upsert", async ({ where, create }: { where: Row; create: Row }) => {
    const hit = findSettings(where);
    if (hit) return hit;
    const row = { ...defaults, ...create };
    settingsRows.push(row);
    return row;
  });
  mock(prisma.agentSettings, "update", async ({ where, data }: { where: Row; data: Row }) => {
    const row = findSettings(where)!;
    Object.assign(row, data);
    return row;
  });
  mock(prisma.agentSettings, "findMany", async () => []);
  mock(prisma.agentRun, "count", async ({ where }: { where: Row }) => (runWheres.push(where), 0));
  mock(prisma.agentRun, "aggregate", async ({ where }: { where: Row }) => (runWheres.push(where), { _sum: { inputTokens: null, outputTokens: null } }));
  mock(prisma.agentRun, "findFirst", async ({ where }: { where: Row }) => (runWheres.push(where), null));
  mock(prisma.agentActionAudit, "findMany", async ({ where }: { where: Row }) => (auditWheres.push(where), []));
});

after(() => {
  restores.reverse().forEach((r) => r());
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

beforeEach(() => {
  workspaces.clear();
  users.clear();
  settingsRows = [];
  runWheres = [];
  auditWheres = [];
  addWorkspace("ws-a");
  addWorkspace("ws-b");
  addWorkspace("internal");
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_MODEL;
});

describe("AI Employees API — auth, RBAC, isolation", () => {
  it("24. unauthenticated → 401 on every endpoint", async () => {
    assert.equal((await dashboard(req("GET", "/api/ai-employees"))).status, 401);
    assert.equal((await patchSettings(req("PATCH", "/api/ai-employees", undefined, { masterEnabled: true }))).status, 401);
    assert.equal((await trigger(req("POST", "/api/ai-employees/trigger", undefined, { mode: "test" }))).status, 401);
  });

  it("25. RBAC: admin all, manager view+run, employee nothing", async () => {
    const adminGet = await json(await dashboard(req("GET", "/api/ai-employees", "admin-ws-a")));
    assert.equal(adminGet.status, 200);
    assert.deepEqual(adminGet.data.permissions, { canRun: true, canEditSettings: true });

    const managerGet = await json(await dashboard(req("GET", "/api/ai-employees", "manager-ws-a")));
    assert.equal(managerGet.status, 200);
    assert.deepEqual(managerGet.data.permissions, { canRun: true, canEditSettings: false });
    assert.equal((await patchSettings(req("PATCH", "/api/ai-employees", "manager-ws-a", { masterEnabled: true }))).status, 403);

    assert.equal((await dashboard(req("GET", "/api/ai-employees", "employee-ws-a"))).status, 403);
    assert.equal((await trigger(req("POST", "/api/ai-employees/trigger", "employee-ws-a", { mode: "test" }))).status, 403);
    assert.equal((await patchSettings(req("PATCH", "/api/ai-employees", "employee-ws-a", { masterEnabled: true }))).status, 403);
  });

  it("12/20. dashboard runs, tokens, audits and settings are scoped to the caller's workspace", async () => {
    await patchSettings(req("PATCH", "/api/ai-employees", "admin-ws-a", { masterEnabled: true, telegramReportsEnabled: true }));
    const b = await json(await dashboard(req("GET", "/api/ai-employees", "admin-ws-b")));
    assert.equal(b.status, 200);
    assert.equal(b.data.settings.masterEnabled, false, "ws-b does not see ws-a's settings");
    assert.ok(runWheres.length > 0 && runWheres.every((w) => w.workspaceId === "ws-b"));
    assert.ok(auditWheres.every((w) => w.workspaceId === "ws-b"));
    assert.deepEqual(
      settingsRows.map((s) => [s.workspaceId, s.masterEnabled]).sort(),
      [["ws-a", true], ["ws-b", false]]
    );
  });

  it("13. client cannot name a workspace in settings or trigger", async () => {
    const p = await patchSettings(req("PATCH", "/api/ai-employees", "admin-ws-a", { masterEnabled: true, workspaceId: "ws-b" }));
    assert.equal(p.status, 400);
    assert.equal(settingsRows.find((s) => s.workspaceId === "ws-b")?.masterEnabled ?? false, false);
    process.env.DEEPSEEK_API_KEY = "k";
    process.env.DEEPSEEK_MODEL = "m";
    const t = await trigger(req("POST", "/api/ai-employees/trigger", "admin-ws-a", { mode: "test", workspaceId: "ws-b" }));
    assert.equal(t.status, 400);
  });

  it("2. no DeepSeek key → dashboard says not connected, trigger refuses (no fake report)", async () => {
    const g = await json(await dashboard(req("GET", "/api/ai-employees", "admin-ws-a")));
    assert.equal(g.data.provider.name, "DeepSeek");
    assert.equal(g.data.provider.configured, false);
    assert.equal(g.data.provider.mode, "read-only");
    assert.deepEqual(g.data.stats.tokensToday, { input: null, output: null, runsWithUsage: 0 });
    const t = await json(await trigger(req("POST", "/api/ai-employees/trigger", "admin-ws-a", { mode: "test" })));
    assert.equal(t.status, 503);
    assert.equal(t.body.error?.code ?? t.body.code, "DEEPSEEK_NOT_CONFIGURED");
    assert.equal(t.data, undefined);
  });

  it("dashboard never exposes the API key", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-must-not-leak-123456";
    process.env.DEEPSEEK_MODEL = "m-x";
    const res = await dashboard(req("GET", "/api/ai-employees", "admin-ws-a"));
    const text = await res.text();
    assert.ok(!text.includes("sk-must-not-leak-123456"));
    assert.ok(text.includes('"configured":true'));
  });

  it("cron requires the cron secret", async () => {
    const res = await cronDaily(new Request("http://localhost/api/cron/ai-employees-daily"));
    assert.ok([401, 403].includes(res.status), String(res.status));
  });

  it("22. Hermes runner endpoints are retired (410)", async () => {
    for (const res of [await hermesRuns(), await hermesTelegram(), await hermesOverdue()]) {
      assert.equal(res.status, 410);
    }
  });
});
