import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import {
  findExistingLinkId,
  insertSmsLink,
  isSmsLinksDbReady,
  listSmsLinks,
  scopeKeyForContract,
  settingsFromBody,
} from "@/lib/api-server/sms-links";
import { DEFAULT_SMS_SETTINGS } from "@/lib/sms-notifications";

type AssignItem = {
  tenantId?: string;
  contractId?: string | null;
  propertyId?: string | null;
  propertyLabel?: string;
  smsEnabled?: boolean;
  settings?: {
    dueSoon?: boolean;
    debtReminder?: boolean;
    paymentReceived?: boolean;
    general?: boolean;
  };
};

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  if (!(await isSmsLinksDbReady())) {
    return fail("sms_tenant_links jadvalini yaratib bo'lmadi", 501);
  }

  try {
    const data = await listSmsLinks();
    return ok({ data, meta: { total: data.length } });
  } catch {
    return fail("Biriktirilgan arendatorlarni yuklab bo'lmadi", 500);
  }
}

/** Bir yoki bir nechta arendatorni biriktirish (dublikatsiz) */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  if (!(await isSmsLinksDbReady())) {
    return fail("sms_tenant_links jadvalini yaratib bo'lmadi", 501);
  }

  try {
    const body = (await req.json()) as {
      items?: AssignItem[];
      tenantId?: string;
      contractId?: string | null;
      propertyId?: string | null;
      propertyLabel?: string;
      smsEnabled?: boolean;
      settings?: AssignItem["settings"];
    };

    const rawItems: AssignItem[] = Array.isArray(body.items)
      ? body.items
      : body.tenantId
        ? [
            {
              tenantId: body.tenantId,
              contractId: body.contractId,
              propertyId: body.propertyId,
              propertyLabel: body.propertyLabel,
              smsEnabled: body.smsEnabled,
              settings: body.settings,
            },
          ]
        : [];

    if (rawItems.length === 0) {
      return fail("Kamida bitta arendator kerak", 400);
    }

    const created: Awaited<ReturnType<typeof insertSmsLink>>[] = [];
    let skippedCount = 0;

    for (const item of rawItems) {
      const tenantId = String(item.tenantId ?? "").trim();
      if (!tenantId) continue;

      const tenants = await prisma.$queryRawUnsafe<
        { id: string; leftAt: Date | null }[]
      >(
        `SELECT "id", "leftAt" FROM "tenants" WHERE "id" = $1 LIMIT 1`,
        tenantId
      );
      const tenant = tenants[0];
      if (!tenant || tenant.leftAt) {
        skippedCount += 1;
        continue;
      }

      const contractIdRaw =
        item.contractId != null && String(item.contractId).trim()
          ? String(item.contractId).trim()
          : null;
      let propertyId =
        item.propertyId != null && String(item.propertyId).trim()
          ? String(item.propertyId).trim()
          : null;
      let propertyLabel = String(item.propertyLabel ?? "").trim();

      if (contractIdRaw) {
        const contracts = await prisma.$queryRawUnsafe<
          { id: string; tenantId: string; propertyId: string; title: string | null }[]
        >(
          `SELECT c."id", c."tenantId", c."propertyId", p."title"
           FROM "contracts" c
           LEFT JOIN "properties" p ON p."id" = c."propertyId"
           WHERE c."id" = $1 LIMIT 1`,
          contractIdRaw
        );
        const contract = contracts[0];
        if (!contract || contract.tenantId !== tenantId) {
          skippedCount += 1;
          continue;
        }
        propertyId = contract.propertyId;
        if (!propertyLabel) {
          propertyLabel = contract.title?.trim() || "";
        }
      }

      const scopeKey = scopeKeyForContract(contractIdRaw);
      const existingId = await findExistingLinkId(tenantId, scopeKey);
      if (existingId) {
        skippedCount += 1;
        continue;
      }

      const settings = settingsFromBody(item.settings, DEFAULT_SMS_SETTINGS);
      const row = await insertSmsLink({
        tenantId,
        scopeKey,
        contractId: contractIdRaw,
        propertyId,
        propertyLabel: propertyLabel || "",
        smsEnabled: item.smsEnabled !== false,
        settings,
      });
      created.push(row);
    }

    return ok(
      {
        created,
        skippedCount,
        data: await listSmsLinks(),
      },
      201
    );
  } catch {
    return fail("Biriktirish saqlanmadi", 500);
  }
}
