import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { POST as createRoute } from "@/app/api/[resource]/route";
import { PATCH as patchRoute } from "@/app/api/[resource]/[id]/route";
import { withoutGuestCredentials } from "@/lib/api-server/tenants";
import { prisma } from "@/lib/api-server/prisma";
import { getIndustryTerminology } from "@/lib/industry-terminology";
import { tenantUsesPortalCredentials } from "@/lib/tenant-credentials";
import { tenantSchema } from "@/lib/validations";

const signingKey = randomBytes(32).toString("hex");
const originalEnv = { database: process.env.DATABASE_URL, jwt: process.env.JWT_ACCESS_SECRET };
const restores: (() => void)[] = [];
function mock(model: object, name: string, impl: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, impl);
  restores.push(() => Reflect.set(model, name, original));
}

type Row = Record<string, unknown>;
const MODELS = ["tenant", "tenantArchive", "client", "contract", "property", "employee", "vehicle"] as const;
let tables: Record<string, Row[]> = {};
const workspaces = new Map<string, Row>();

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond === null) return row[key] == null;
    if (cond && typeof cond === "object" && "not" in cond) return row[key] !== (cond as Row).not;
    if (cond && typeof cond === "object" && "in" in cond) return ((cond as Row).in as unknown[]).includes(row[key]);
    if (cond && typeof cond === "object") return true;
    return row[key] === cond;
  });
}

function modelImpl(name: string) {
  const rows = () => tables[name]!;
  return {
    findMany: async (a: { where?: Row } = {}) => rows().filter((r) => matches(r, a.where)),
    findFirst: async (a: { where?: Row } = {}) => rows().find((r) => matches(r, a.where)) ?? null,
    findUnique: async (a: { where: Row }) => rows().find((r) => matches(r, a.where)) ?? null,
    count: async (a: { where?: Row } = {}) => rows().filter((r) => matches(r, a.where)).length,
    create: async (a: { data: Row }) => {
      const now = new Date();
      const r: Row = { id: randomUUID(), createdAt: now, updatedAt: now, login: null, password: null, ...a.data };
      for (const [k, v] of Object.entries(r)) if (v === undefined) r[k] = null;
      rows().push(r);
      return r;
    },
    update: async (a: { where: Row; data: Row }) => {
      const r = rows().find((x) => matches(x, a.where));
      if (!r) throw new Error(`${name} not found`);
      for (const [k, v] of Object.entries(a.data)) if (v !== undefined) r[k] = v;
      return r;
    },
    updateMany: async () => ({ count: 0 }),
  };
}

function token(userId: string) {
  return jwt.sign({ sub: userId, email: `${userId}@example.invalid`, role: "ADMIN" }, signingKey, { expiresIn: "1h" });
}
function req(method: string, url: string, userId: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${token(userId)}` },
    body: JSON.stringify(body),
  });
}
const create = (ws: string, resource: string, body: unknown) =>
  createRoute(req("POST", `/api/${resource}`, `owner-${ws}`, body), { params: Promise.resolve({ resource }) });
async function patch(ws: string, resource: string, id: string, body: unknown) {
  const res = await patchRoute(req("PATCH", `/api/${resource}/${id}`, `owner-${ws}`, body), {
    params: Promise.resolve({ resource, id }),
  });
  assert.ok(res, "PATCH returned a response");
  return res;
}

function addWorkspace(id: string, industry: string) {
  workspaces.set(id, {
    id, name: id, slug: null, industry, isInternal: false, createdAt: new Date(), updatedAt: new Date(),
    subscription: { id: `sub-${id}`, workspaceId: id, status: "ACTIVE", plan: "PRO", startedAt: new Date() },
  });
}

const guestBody = (extra: Row = {}) => ({
  fullName: "Test Mehmon",
  phone: "+998901112233",
  rentAmount: 300000,
  passport: "",
  entryDate: "2026-10-06",
  paymentDueDate: "2026-10-06",
  contractDuration: 1,
  depositPaid: false,
  depositAmount: 0,
  ...extra,
});

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;

  mock(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => ({
    id: where.id, email: `${where.id}@example.invalid`, fullName: where.id,
    role: "ADMIN", isActive: true, isInternalAccount: false,
  }));
  mock(prisma.user, "findMany", async () => []);
  mock(prisma.company, "findFirst", async () => null);
  for (const model of [prisma.user, prisma.payment, prisma.expense, prisma.maintenance, prisma.partnerCompany,
    prisma.contactLead, prisma.workTask, prisma.notification]) {
    mock(model, "updateMany", async () => ({ count: 0 }));
  }
  mock(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => {
    const ws = workspaces.get(where.userId.replace(/^owner-/, ""));
    return ws ? { role: "OWNER", workspace: ws } : null;
  });
  for (const name of MODELS) {
    const model = Reflect.get(prisma, name) as object;
    for (const [method, fn] of Object.entries(modelImpl(name))) mock(model, method, fn);
  }
  mock(prisma.workspace, "findFirst", async () => ({ id: "internal", isInternal: true }));
  mock(prisma.workspace, "findUnique", async ({ where }: { where: { id: string } }) => workspaces.get(where.id) ?? null);
  mock(prisma.workspaceSubscription, "findUnique", async ({ where }: { where: { workspaceId: string } }) =>
    where.workspaceId === "internal"
      ? { workspaceId: "internal", status: "ACTIVE", plan: "internal" }
      : ((workspaces.get(where.workspaceId)?.subscription as Row | undefined) ?? null)
  );
  mock(prisma, "$queryRaw", async () => []);
  mock(prisma.workspaceActivityEvent, "createMany", async () => ({ count: 0 }));
  mock(prisma, "$transaction", async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
});

after(() => {
  restores.reverse().forEach((r) => r());
  for (const [key, value] of [["DATABASE_URL", originalEnv.database], ["JWT_ACCESS_SECRET", originalEnv.jwt]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  tables = Object.fromEntries(MODELS.map((m) => [m, []]));
  workspaces.clear();
  addWorkspace("hotel", "HOTEL_HOSTEL");
  addWorkspace("villa", "VILLA_RENTAL");
  addWorkspace("office", "OFFICE_RENTAL");
});

const tenantRow = (id: string) => tables.tenant!.find((t) => t.id === id)!;

describe("guest credentials — HOTEL/VILLA", () => {
  for (const ws of ["hotel", "villa"]) {
    it(`${ws}: guest without login/password → 201, login and password stored as null`, async () => {
      const res = await create(ws, "tenants", guestBody());
      assert.equal(res.status, 201);
      const { data } = (await res.json()) as { data: Row };
      assert.equal(data.fullName, "Test Mehmon");
      assert.equal(data.workspaceId, ws);
      assert.equal("password" in data, false);
      const row = tenantRow(String(data.id));
      assert.equal(row.login, null);
      assert.equal(row.password, null);
      assert.ok(tables.client!.some((c) => c.tenantId === data.id), "customer record created");
    });
  }

  it("hotel: credentials sent anyway are ignored, no portal account is created", async () => {
    const res = await create("hotel", "tenants", guestBody({ login: "guest1", password: "secret123" }));
    assert.equal(res.status, 201);
    const { data } = (await res.json()) as { data: Row };
    const row = tenantRow(String(data.id));
    assert.equal(row.login, null);
    assert.equal(row.password, null);
  });

  it("hotel: room assignment contract is created for the guest", async () => {
    tables.property!.push({ id: "room-1", workspaceId: "hotel", title: "101", status: "available", price: 300000 });
    const t = (await (await create("hotel", "tenants", guestBody())).json()) as { data: Row };
    const res = await create("hotel", "contracts", {
      propertyId: "room-1", tenantId: t.data.id, startDate: "2026-10-06", endDate: "2026-11-06",
      monthlyPayment: 300000, deposit: 0, depositPaid: false, status: "active",
    });
    assert.equal(res.status, 201);
    assert.ok(tables.contract!.some((c) => c.tenantId === t.data.id && c.propertyId === "room-1"));
  });

  it("hotel: edit works and keeps credentials null even if sent", async () => {
    const t = (await (await create("hotel", "tenants", guestBody())).json()) as { data: Row };
    const res = await patch("hotel", "tenants", String(t.data.id), {
      fullName: "Yangi Ism", phone: "+998907776655", rentAmount: 450000, login: "x", password: "secret123",
    });
    assert.equal(res.status, 200);
    const row = tenantRow(String(t.data.id));
    assert.equal(row.fullName, "Yangi Ism");
    assert.equal(row.phone, "+998907776655");
    assert.equal(row.rentAmount, 450000);
    assert.equal(row.login, null);
    assert.equal(row.password, null);
  });
});

describe("guest credentials — other industries unchanged", () => {
  it("office: login stored and password hashed on create", async () => {
    const res = await create("office", "tenants", guestBody({ login: "user01112233", password: "123456" }));
    assert.equal(res.status, 201);
    const { data } = (await res.json()) as { data: Row };
    assert.equal(data.login, "user01112233");
    assert.equal("password" in data, false);
    const row = tenantRow(String(data.id));
    assert.match(String(row.password), /^\$2[aby]\$/);
  });

  it("office: login update still applied on edit", async () => {
    const t = (await (await create("office", "tenants", guestBody({ login: "old01", password: "123456" }))).json()) as {
      data: Row;
    };
    const res = await patch("office", "tenants", String(t.data.id), { login: "new01" });
    assert.equal(res.status, 200);
    assert.equal(tenantRow(String(t.data.id)).login, "new01");
  });
});

describe("guest credentials — helpers and form", () => {
  it("only booking industries skip portal credentials", () => {
    assert.equal(tenantUsesPortalCredentials("HOTEL_HOSTEL"), false);
    assert.equal(tenantUsesPortalCredentials("VILLA_RENTAL"), false);
    for (const industry of ["OFFICE_RENTAL", "APARTMENT_RENTAL", "CAR_RENTAL", undefined, null]) {
      assert.equal(tenantUsesPortalCredentials(industry), true, String(industry));
    }
  });

  it("withoutGuestCredentials strips only for booking industries", () => {
    const body = { fullName: "A", login: "l", password: "p" };
    assert.deepEqual(withoutGuestCredentials(body, "HOTEL_HOSTEL"), { fullName: "A" });
    assert.deepEqual(withoutGuestCredentials(body, "VILLA_RENTAL"), { fullName: "A" });
    assert.equal(withoutGuestCredentials(body, "OFFICE_RENTAL"), body);
  });

  it("dialog description mentions login/parol only where credentials exist", () => {
    for (const industry of ["HOTEL_HOSTEL", "VILLA_RENTAL"]) {
      assert.doesNotMatch(getIndustryTerminology(industry).customerDialogDescription, /login|parol/i, industry);
    }
    assert.match(getIndustryTerminology("OFFICE_RENTAL").customerDialogDescription, /login\/parol/);
  });

  it("tenant form schema accepts a guest without login/password", () => {
    const parsed = tenantSchema.safeParse({
      fullName: "Test Mehmon", phone: "+998901112233", rentAmount: 0,
      entryDate: "2026-10-06", paymentDueDate: "2026-10-06", contractDuration: 1,
    });
    assert.equal(parsed.success, true);
  });

  it("tenant dialog renders Login/Parol and the generator only behind withCredentials", () => {
    const src = readFileSync(path.join(process.cwd(), "src/components/tenants/tenant-dialog.tsx"), "utf8");
    const gate = src.indexOf("{withCredentials && (");
    assert.ok(gate > 0, "credential fields are gated");
    for (const marker of ["<Label>Login</Label>", "Yangi parol (ixtiyoriy)", "<RefreshCw"]) {
      const at = src.indexOf(marker);
      assert.ok(at > gate, `${marker} rendered inside the gate`);
    }
    assert.match(src, /password: withCredentials \? generateTenantPassword\(\) : ""/);
    assert.match(src, /if \(tenant \|\| !open \|\| !withCredentials\) return;/);
  });
});
