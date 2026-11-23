import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Contract, Tenant } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import {
  syncContractsFromTenants,
  upsertContractFromTenant,
} from "@/lib/api-server/contract-sync";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const restores: (() => void)[] = [];
function mock(model: object, name: string, impl: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, impl);
  restores.push(() => Reflect.set(model, name, original));
}

afterEach(() => {
  while (restores.length) restores.pop()!();
});

const WS_A = "ws-a";
const WS_B = "ws-b";
const G1 = "prop-g1";
const ROOM_303 = "prop-303";

function tenant(partial: Partial<Tenant> & { id: string; workspaceId: string }): Tenant {
  return {
    fullName: partial.fullName ?? "Test",
    phone: "+998",
    passport: "AA",
    rentAmount: partial.rentAmount ?? 4_000_000,
    contractDuration: partial.contractDuration ?? 6,
    entryDate: partial.entryDate ?? new Date("2026-06-01T00:00:00.000Z"),
    paymentDueDate: null,
    depositPaid: false,
    depositAmount: 0,
    leftAt: partial.leftAt ?? null,
    createdAt: partial.createdAt ?? new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date(),
    clientNumber: null,
    login: null,
    password: null,
    telegram: null,
    telegramChatId: null,
    email: null,
    address: null,
    ...partial,
  } as Tenant;
}

function contractRow(
  partial: Partial<Contract> & {
    id: string;
    tenantId: string;
    propertyId: string;
    workspaceId: string;
    status: Contract["status"];
  }
): Contract {
  return {
    startDate: partial.startDate ?? new Date("2026-06-01T00:00:00.000Z"),
    endDate: partial.endDate ?? new Date("2026-12-01T00:00:00.000Z"),
    monthlyRent: partial.monthlyRent ?? 4_000_000,
    deposit: 0,
    depositPaid: false,
    notes: partial.notes ?? null,
    createdAt: partial.createdAt ?? new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date(),
    ...partial,
  } as Contract;
}

describe("contract-sync source guards", () => {
  it("server sync has no defaultPropertyId / first-room fallback", () => {
    const src = read("src/lib/api-server/contract-sync.ts");
    assert.equal(/defaultPropertyId/.test(src), false);
    assert.equal(/findFirst\(\s*\{\s*orderBy:\s*\{\s*createdAt:\s*"asc"/.test(src), false);
    assert.match(src, /leftAt/);
    assert.match(src, /TERMINATED/);
    assert.match(src, /workspaceId/);
  });

  it("sync-tenants route is workspace-scoped", () => {
    const src = read("src/app/api/contracts/sync-tenants/route.ts");
    assert.match(src, /resolveUserWorkspaceContext/);
    assert.match(src, /syncContractsFromTenants\(wsCtx\.workspace\.id\)/);
  });

  it("contracts page does not auto-sync on empty list", () => {
    const src = read("src/app/(dashboard)/contracts/page.tsx");
    assert.equal(/autoSynced/.test(src), false);
    assert.equal(/data\.length === 0/.test(src), false);
    assert.match(src, /runSync/);
  });

  it("client sync does not pick properties\\[0\\]", () => {
    const src = read("src/lib/contract-sync.ts");
    assert.equal(/properties\[0\]/.test(src), false);
    assert.match(src, /leftAt/);
    assert.match(src, /terminated/);
  });
});

describe("upsertContractFromTenant — safety", () => {
  it("blocks ACTIVE create for departed tenant (leftAt set)", async () => {
    let created = 0;
    mock(prisma.contract, "findFirst", async () => null);
    mock(prisma.contract, "create", async () => {
      created += 1;
      throw new Error("must not create");
    });

    const result = await upsertContractFromTenant(
      tenant({
        id: "t-left",
        workspaceId: WS_A,
        leftAt: new Date("2026-07-23T00:00:00.000Z"),
        fullName: "206 Avto sale",
      }),
      { propertyId: G1 }
    );
    assert.equal(result, null);
    assert.equal(created, 0);
  });

  it("does not reactivate TERMINATED contracts", async () => {
    const terminated = contractRow({
      id: "c-term",
      tenantId: "t1",
      propertyId: ROOM_303,
      workspaceId: WS_A,
      status: "TERMINATED",
      monthlyRent: 4_200_000,
    });
    let updated = 0;
    mock(prisma.contract, "findFirst", async () => terminated);
    mock(prisma.contract, "update", async () => {
      updated += 1;
      throw new Error("must not update terminated");
    });
    mock(prisma.contract, "findUniqueOrThrow", async () => ({
      ...terminated,
      property: { id: ROOM_303, title: "303 Room", status: "AVAILABLE" },
      tenant: tenant({ id: "t1", workspaceId: WS_A }),
    }));

    const result = await upsertContractFromTenant(
      tenant({ id: "t1", workspaceId: WS_A, rentAmount: 5_000_000 })
    );
    assert.ok(result);
    assert.equal(result!.status, "TERMINATED");
    assert.equal(updated, 0);
  });

  it("does not invent G1 when propertyId missing — no create", async () => {
    let created = 0;
    mock(prisma.contract, "findFirst", async () => null);
    mock(prisma.contract, "create", async () => {
      created += 1;
      throw new Error("no default room");
    });
    mock(prisma.property, "findFirst", async () => {
      throw new Error("must not probe default property");
    });

    const result = await upsertContractFromTenant(
      tenant({ id: "t-new", workspaceId: WS_A, fullName: "206 Logistics" })
    );
    assert.equal(result, null);
    assert.equal(created, 0);
  });

  it("preserves real 303 Room ACTIVE contract on update (no status flip)", async () => {
    const real303 = contractRow({
      id: "c-303-real",
      tenantId: "t-303-real",
      propertyId: ROOM_303,
      workspaceId: WS_A,
      status: "ACTIVE",
      monthlyRent: 4_200_000,
      startDate: new Date("2026-09-04T00:00:00.000Z"),
      notes: "Arendatordan avtomatik (6 oy)",
    });
    mock(prisma.contract, "findFirst", async (args: { where: { tenantId: string } }) => {
      assert.equal(args.where.tenantId, "t-303-real");
      return real303;
    });
    mock(prisma.contract, "update", async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      assert.equal(args.where.id, "c-303-real");
      assert.equal("status" in args.data, false);
      assert.equal(args.data.monthlyRent, 4_200_000);
      return {
        ...real303,
        ...args.data,
        property: { id: ROOM_303, title: "303 Room", status: "RENTED" },
        tenant: tenant({ id: "t-303-real", workspaceId: WS_A, rentAmount: 4_200_000 }),
      };
    });

    const result = await upsertContractFromTenant(
      tenant({
        id: "t-303-real",
        workspaceId: WS_A,
        rentAmount: 4_200_000,
        fullName: "303 Marketing",
      })
    );
    assert.ok(result);
    assert.equal(result!.id, "c-303-real");
    assert.equal(result!.propertyId, ROOM_303);
    assert.equal(result!.status, "ACTIVE");
  });

  it("rejects create when another tenant already has ACTIVE on the room", async () => {
    mock(prisma.contract, "findFirst", async (args: { where: Record<string, unknown> }) => {
      // Occupancy probe uses status + propertyId; tenant lookup does not.
      if (args.where.status && args.where.propertyId === G1) {
        return { id: "other-open" };
      }
      return null;
    });
    mock(prisma.property, "findFirst", async () => ({ id: G1 }));
    let created = 0;
    mock(prisma.contract, "create", async () => {
      created += 1;
      throw new Error("conflict");
    });

    const result = await upsertContractFromTenant(
      tenant({ id: "t-phantom", workspaceId: WS_A }),
      { propertyId: G1 }
    );
    assert.equal(result, null);
    assert.equal(created, 0);
  });

  it("workspace isolation: sync only loads tenants for given workspace", async () => {
    const seen: unknown[] = [];
    mock(prisma.tenant, "findMany", async (args: { where: { workspaceId: string; leftAt: null } }) => {
      seen.push(args.where);
      assert.equal(args.where.workspaceId, WS_A);
      assert.equal(args.where.leftAt, null);
      return [];
    });
    const synced = await syncContractsFromTenants(WS_A);
    assert.deepEqual(synced, []);
    assert.equal(seen.length, 1);
  });

  it("repeated sync does not create duplicates for tenant without contract", async () => {
    let createCount = 0;
    mock(prisma.tenant, "findMany", async () => [
      tenant({ id: "t-orphan", workspaceId: WS_A, fullName: "303 Marketing G1 dup" }),
    ]);
    mock(prisma.contract, "findFirst", async () => null);
    mock(prisma.contract, "create", async () => {
      createCount += 1;
      throw new Error("bulk sync must not create without propertyId");
    });

    const first = await syncContractsFromTenants(WS_A);
    const second = await syncContractsFromTenants(WS_A);
    assert.deepEqual(first, []);
    assert.deepEqual(second, []);
    assert.equal(createCount, 0);
  });

  it("empty workspaceId sync is a no-op (other workspaces untouched)", async () => {
    let listed = 0;
    mock(prisma.tenant, "findMany", async () => {
      listed += 1;
      return [tenant({ id: "t-b", workspaceId: WS_B })];
    });
    const synced = await syncContractsFromTenants("");
    assert.deepEqual(synced, []);
    assert.equal(listed, 0);
  });
});
