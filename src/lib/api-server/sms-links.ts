import { randomUUID } from "crypto";

import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import type {
  SmsLinkedTenant,
  SmsNotificationSettings,
} from "@/types/sms-notifications";

type SmsLinkSqlRow = {
  id: string;
  tenantId: string;
  scopeKey: string;
  contractId: string | null;
  propertyId: string | null;
  propertyLabel: string;
  smsEnabled: boolean;
  dueSoon: boolean;
  debtReminder: boolean;
  paymentReceived: boolean;
  general: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenantName: string | null;
  tenantPhone: string | null;
  propertyTitle: string | null;
};

let smsLinksReady: boolean | null = null;
let ensurePromise: Promise<boolean> | null = null;

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const msg = e.message ?? "";
  return (
    e.code === "P2021" ||
    e.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("sms_tenant_links")
  );
}

async function ensureSmsTenantLinksTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "sms_tenant_links" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "scopeKey" TEXT NOT NULL DEFAULT 'none',
      "contractId" TEXT,
      "propertyId" TEXT,
      "propertyLabel" TEXT NOT NULL DEFAULT '',
      "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
      "dueSoon" BOOLEAN NOT NULL DEFAULT true,
      "debtReminder" BOOLEAN NOT NULL DEFAULT true,
      "paymentReceived" BOOLEAN NOT NULL DEFAULT false,
      "general" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "sms_tenant_links_tenantId_scopeKey_key"
    ON "sms_tenant_links"("tenantId", "scopeKey")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "sms_tenant_links_tenantId_idx"
    ON "sms_tenant_links"("tenantId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "sms_tenant_links_contractId_idx"
    ON "sms_tenant_links"("contractId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "sms_tenant_links_createdAt_idx"
    ON "sms_tenant_links"("createdAt")
  `);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "sms_tenant_links"
      ADD CONSTRAINT "sms_tenant_links_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  } catch {
    /* mavjud */
  }
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "sms_tenant_links"
      ADD CONSTRAINT "sms_tenant_links_contractId_fkey"
      FOREIGN KEY ("contractId") REFERENCES "contracts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
  } catch {
    /* mavjud */
  }
}

/** Jadval yo‘q bo‘lsa yaratadi (migratsiya/generate shart emas) */
export async function isSmsLinksDbReady(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  if (smsLinksReady === true) return true;

  if (!ensurePromise) {
    ensurePromise = (async () => {
      try {
        await prisma.$queryRawUnsafe(
          `SELECT "id" FROM "sms_tenant_links" LIMIT 1`
        );
        smsLinksReady = true;
        return true;
      } catch (err) {
        if (!isMissingTableError(err)) {
          try {
            await ensureSmsTenantLinksTable();
            smsLinksReady = true;
            return true;
          } catch (createErr) {
            console.error("sms_tenant_links yaratilmadi", createErr);
            smsLinksReady = false;
            return false;
          }
        }
        try {
          await ensureSmsTenantLinksTable();
          smsLinksReady = true;
          return true;
        } catch (createErr) {
          console.error("sms_tenant_links yaratilmadi", createErr);
          smsLinksReady = false;
          return false;
        }
      }
    })().finally(() => {
      ensurePromise = null;
    });
  }

  return ensurePromise;
}

export function resetSmsLinksDbReadyCache() {
  smsLinksReady = null;
}

export function scopeKeyForContract(contractId: string | null | undefined) {
  const id = contractId?.trim();
  return id ? id : "none";
}

export function mapSmsLinkRow(row: SmsLinkSqlRow): SmsLinkedTenant {
  const propertyFromJoin =
    row.propertyTitle?.trim() ||
    (row.propertyLabel?.trim() ? row.propertyLabel.trim() : "");
  return {
    id: row.id,
    tenantId: row.tenantId,
    contractId: row.contractId,
    propertyId: row.propertyId,
    scopeKey: row.scopeKey,
    fullName: row.tenantName?.trim() || "—",
    phone: row.tenantPhone?.trim() || "",
    propertyLabel: propertyFromJoin || "—",
    smsEnabled: row.smsEnabled,
    settings: {
      dueSoon: row.dueSoon,
      debtReminder: row.debtReminder,
      paymentReceived: row.paymentReceived,
      general: row.general,
    },
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export function settingsFromBody(
  settings: Partial<SmsNotificationSettings> | undefined,
  defaults: SmsNotificationSettings
): SmsNotificationSettings {
  return {
    dueSoon: settings?.dueSoon ?? defaults.dueSoon,
    debtReminder: settings?.debtReminder ?? defaults.debtReminder,
    paymentReceived: settings?.paymentReceived ?? defaults.paymentReceived,
    general: settings?.general ?? defaults.general,
  };
}

const LIST_SQL = `
  SELECT
    l."id",
    l."tenantId",
    l."scopeKey",
    l."contractId",
    l."propertyId",
    l."propertyLabel",
    l."smsEnabled",
    l."dueSoon",
    l."debtReminder",
    l."paymentReceived",
    l."general",
    l."createdAt",
    l."updatedAt",
    t."fullName" AS "tenantName",
    t."phone" AS "tenantPhone",
    p."title" AS "propertyTitle"
  FROM "sms_tenant_links" l
  LEFT JOIN "tenants" t ON t."id" = l."tenantId"
  LEFT JOIN "contracts" c ON c."id" = l."contractId"
  LEFT JOIN "properties" p ON p."id" = COALESCE(l."propertyId", c."propertyId")
  ORDER BY l."createdAt" DESC
`;

export async function listSmsLinks(): Promise<SmsLinkedTenant[]> {
  const rows = await prisma.$queryRawUnsafe<SmsLinkSqlRow[]>(LIST_SQL);
  return rows.map(mapSmsLinkRow);
}

export async function findSmsLinkById(
  id: string
): Promise<SmsLinkedTenant | null> {
  const rows = await prisma.$queryRawUnsafe<SmsLinkSqlRow[]>(
    `
  SELECT
    l."id",
    l."tenantId",
    l."scopeKey",
    l."contractId",
    l."propertyId",
    l."propertyLabel",
    l."smsEnabled",
    l."dueSoon",
    l."debtReminder",
    l."paymentReceived",
    l."general",
    l."createdAt",
    l."updatedAt",
    t."fullName" AS "tenantName",
    t."phone" AS "tenantPhone",
    p."title" AS "propertyTitle"
  FROM "sms_tenant_links" l
  LEFT JOIN "tenants" t ON t."id" = l."tenantId"
  LEFT JOIN "contracts" c ON c."id" = l."contractId"
  LEFT JOIN "properties" p ON p."id" = COALESCE(l."propertyId", c."propertyId")
  WHERE l."id" = $1
  LIMIT 1
  `,
    id
  );
  return rows[0] ? mapSmsLinkRow(rows[0]) : null;
}

export async function findExistingLinkId(
  tenantId: string,
  scopeKey: string
): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "sms_tenant_links" WHERE "tenantId" = $1 AND "scopeKey" = $2 LIMIT 1`,
    tenantId,
    scopeKey
  );
  return rows[0]?.id ?? null;
}

export async function insertSmsLink(input: {
  tenantId: string;
  scopeKey: string;
  contractId: string | null;
  propertyId: string | null;
  propertyLabel: string;
  smsEnabled: boolean;
  settings: SmsNotificationSettings;
}): Promise<SmsLinkedTenant> {
  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "sms_tenant_links" (
      "id", "tenantId", "scopeKey", "contractId", "propertyId", "propertyLabel",
      "smsEnabled", "dueSoon", "debtReminder", "paymentReceived", "general",
      "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    id,
    input.tenantId,
    input.scopeKey,
    input.contractId,
    input.propertyId,
    input.propertyLabel,
    input.smsEnabled,
    input.settings.dueSoon,
    input.settings.debtReminder,
    input.settings.paymentReceived,
    input.settings.general,
    now,
    now
  );
  const created = await findSmsLinkById(id);
  if (!created) throw new Error("Yaratilgan yozuv topilmadi");
  return created;
}

export async function updateSmsLinkRow(
  id: string,
  patch: {
    smsEnabled?: boolean;
    settings: SmsNotificationSettings;
  }
): Promise<SmsLinkedTenant | null> {
  const existing = await prisma.$queryRawUnsafe<
    {
      id: string;
      smsEnabled: boolean;
      dueSoon: boolean;
      debtReminder: boolean;
      paymentReceived: boolean;
      general: boolean;
    }[]
  >(
    `SELECT "id", "smsEnabled", "dueSoon", "debtReminder", "paymentReceived", "general"
     FROM "sms_tenant_links" WHERE "id" = $1 LIMIT 1`,
    id
  );
  if (!existing[0]) return null;

  const smsEnabled =
    typeof patch.smsEnabled === "boolean"
      ? patch.smsEnabled
      : existing[0].smsEnabled;

  await prisma.$executeRawUnsafe(
    `UPDATE "sms_tenant_links" SET
      "smsEnabled" = $2,
      "dueSoon" = $3,
      "debtReminder" = $4,
      "paymentReceived" = $5,
      "general" = $6,
      "updatedAt" = $7
     WHERE "id" = $1`,
    id,
    smsEnabled,
    patch.settings.dueSoon,
    patch.settings.debtReminder,
    patch.settings.paymentReceived,
    patch.settings.general,
    new Date()
  );
  return findSmsLinkById(id);
}

export async function deleteSmsLinkRow(id: string): Promise<boolean> {
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM "sms_tenant_links" WHERE "id" = $1`,
    id
  );
  return Number(result) > 0;
}
