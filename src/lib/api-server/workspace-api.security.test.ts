import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { GET as getProperty } from "@/app/api/properties/[id]/route";
import { GET as getResource } from "@/app/api/[resource]/[id]/route";
import { GET as getEmployee } from "@/app/api/employees/[id]/route";
import { GET as getTask } from "@/app/api/tasks/[id]/route";
import { GET as getAttachment } from "@/app/api/tasks/attachments/[id]/route";
import { GET as getLockSettings } from "@/app/api/lwn-rooms/[propertyId]/lock-settings/route";
import { prisma } from "@/lib/api-server/prisma";

// Exercise the actual handlers, JWT authentication and workspace resolution.
// Only database I/O is replaced; no real database or email service is used.
const signingKey = randomBytes(32).toString("hex");
const originalEnv = { database: process.env.DATABASE_URL, jwt: process.env.JWT_ACCESS_SECRET };
const record = { id: "property-a", workspaceId: "workspace-a", title: "PRIVATE ROOM", contracts: [], maintenances: [] };
let lookups: unknown[] = [];
const restores: (() => void)[] = [];
const mock = {
  method(model: object, name: string, implementation: unknown) {
    const original = Reflect.get(model, name);
    Reflect.set(model, name, implementation);
    restores.push(() => { Reflect.set(model, name, original); });
  },
  restoreAll() { restores.reverse().forEach(restore => restore()); },
};

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;
  mock.method(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => ({
    id: where.id, email: `${where.id}@example.invalid`, role: "ADMIN", isActive: true, isInternalAccount: false,
  }));
  mock.method(prisma.workspace, "findFirst", async () => ({ id: "internal", isInternal: true }));
  mock.method(prisma.user, "findMany", async () => []);
  mock.method(prisma.workspaceSubscription, "findUnique", async () => ({ status: "ACTIVE" }));
  mock.method(prisma.company, "findFirst", async () => null);
  for (const model of [prisma.user, prisma.property, prisma.tenant, prisma.contract, prisma.payment,
    prisma.expense, prisma.maintenance, prisma.employee, prisma.partnerCompany, prisma.client,
    prisma.contactLead, prisma.workTask, prisma.notification]) {
    mock.method(model, "updateMany", async () => ({ count: 0 }));
  }
  mock.method(prisma.workspaceMembership, "findFirst", async ({ where }: { where: { userId: string } }) => ({
    role: "OWNER", workspace: {
      id: where.userId === "user-a" ? "workspace-a" : "workspace-b", isInternal: false,
      subscription: { status: "ACTIVE", demoEndsAt: null },
    },
  }));
  for (const model of [prisma.property, prisma.tenant, prisma.contract, prisma.payment,
    prisma.expense, prisma.maintenance, prisma.notification, prisma.employee, prisma.workTask]) {
    mock.method(model, "findUnique", async ({ where }: { where: { id: string; workspaceId?: string } }) => {
      lookups.push(where);
      // Simulate database filtering. A missing scope deliberately returns the foreign row.
      return where.id === record.id && (!where.workspaceId || where.workspaceId === record.workspaceId) ? record : null;
    });
  }
  mock.method(prisma.workTaskAttachment, "findUnique", async ({ where }: {
    where: { id: string; report?: { task?: { workspaceId?: string } } };
  }) => {
    lookups.push(where);
    assert.equal(where.report?.task?.workspaceId, "workspace-b");
    return null;
  });
});

after(() => {
  mock.restoreAll();
  for (const [key, value] of [["DATABASE_URL", originalEnv.database], ["JWT_ACCESS_SECRET", originalEnv.jwt]]) {
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  }
});

function request(user?: string, spoof = false) {
  const headers: Record<string, string> = {};
  if (user) headers.authorization = `Bearer ${jwt.sign({ sub: user, workspaceId: "workspace-a" }, signingKey)}`;
  if (spoof) headers["x-workspace-id"] = "workspace-a";
  return new NextRequest(`https://example.invalid/api/properties/${record.id}${spoof ? "?workspaceId=workspace-a" : ""}`, { headers });
}

async function assertDenied(response: Response | undefined) {
  assert.ok(response);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal("data" in body, false);
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE ROOM|workspace-a|contracts|tenant|lock/i);
}

describe("property API database-level workspace isolation", () => {
  it("foreign exact ID returns 404 and the database query includes current workspace", async () => {
    lookups = [];
    await assertDenied(await getProperty(request("user-b"), { params: Promise.resolve({ id: record.id }) }));
    assert.deepEqual(lookups, [{ id: record.id, workspaceId: "workspace-b" }]);
  });
  it("same-workspace owner receives 200 and their property", async () => {
    const response = await getProperty(request("user-a"), { params: Promise.resolve({ id: record.id }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.id, record.id);
  });
  it("unauthenticated request receives 401 without a property query", async () => {
    lookups = [];
    const response = await getProperty(request(), { params: Promise.resolve({ id: record.id }) });
    assert.equal(response.status, 401);
    assert.deepEqual(lookups, []);
  });
  it("fake workspace query/header and JWT workspace cannot override membership", async () => {
    lookups = [];
    await assertDenied(await getProperty(request("user-b", true), { params: Promise.resolve({ id: record.id }) }));
    assert.deepEqual(lookups, [{ id: record.id, workspaceId: "workspace-b" }]);
  });
});

describe("related single-record APIs", () => {
  for (const resource of ["tenants", "contracts", "payments", "expenses", "maintenance", "notifications"]) {
    it(`${resource} filters foreign records in the database query`, async () => {
      lookups = [];
      await assertDenied(await getResource(request("user-b", true), { params: Promise.resolve({ resource, id: record.id }) }));
      assert.deepEqual(lookups, [{ id: record.id, workspaceId: "workspace-b" }]);
    });
  }
  for (const [name, handler] of [["employees", getEmployee], ["tasks", getTask]] as const) {
    it(`${name} filters foreign records in the database query`, async () => {
      lookups = [];
      await assertDenied(await handler(request("user-b"), { params: Promise.resolve({ id: record.id }) }));
      assert.deepEqual(lookups, [{ id: record.id, workspaceId: "workspace-b" }]);
    });
  }
  it("foreign room lock settings are rejected before loading lock data", async () => {
    lookups = [];
    await assertDenied(await getLockSettings(request("user-b"), { params: Promise.resolve({ propertyId: record.id }) }));
    assert.deepEqual(lookups, [{ id: record.id, workspaceId: "workspace-b" }]);
  });
  it("task attachments are scoped through the parent task before loading bytes", async () => {
    await assertDenied(await getAttachment(request("user-b"), { params: Promise.resolve({ id: "attachment-a" }) }));
  });
});
