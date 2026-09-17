/**
 * Additive-only SQL for multi-tenant workspace tables/columns.
 * Never DROP TABLE / DROP COLUMN / DELETE.
 */

type SqlRunner = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
};

const STATEMENTS = [
  `DO $$ BEGIN
     CREATE TYPE "WorkspaceMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     CREATE TYPE "SubscriptionStatus" AS ENUM ('DEMO', 'ACTIVE', 'PAST_DUE', 'CANCELED');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `CREATE TABLE IF NOT EXISTS "workspaces" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT,
      "isInternal" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_key" ON "workspaces"("slug")`,
  `CREATE INDEX IF NOT EXISTS "workspaces_isInternal_idx" ON "workspaces"("isInternal")`,

  `CREATE TABLE IF NOT EXISTS "workspace_memberships" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'OWNER',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspace_memberships_workspaceId_userId_key"
     ON "workspace_memberships"("workspaceId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "workspace_memberships_userId_idx"
     ON "workspace_memberships"("userId")`,

  `CREATE TABLE IF NOT EXISTS "workspace_subscriptions" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "status" "SubscriptionStatus" NOT NULL DEFAULT 'DEMO',
      "plan" TEXT DEFAULT 'demo',
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "currentPeriodStart" TIMESTAMP(3),
      "currentPeriodEnd" TIMESTAMP(3),
      "demoStartedAt" TIMESTAMP(3),
      "demoEndsAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspace_subscriptions_workspaceId_key"
     ON "workspace_subscriptions"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "workspace_subscriptions_status_idx"
     ON "workspace_subscriptions"("status")`,

  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isInternalAccount" BOOLEAN NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS "users_isInternalAccount_idx" ON "users"("isInternalAccount")`,
  `CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone")`,

  `ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "company_workspaceId_key" ON "company"("workspaceId")`,

  `ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "properties_workspaceId_idx" ON "properties"("workspaceId")`,

  `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "tenants_workspaceId_idx" ON "tenants"("workspaceId")`,

  `ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "contracts_workspaceId_idx" ON "contracts"("workspaceId")`,

  `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "payments_workspaceId_idx" ON "payments"("workspaceId")`,

  `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "expenses_workspaceId_idx" ON "expenses"("workspaceId")`,

  `ALTER TABLE "maintenance" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "maintenance_workspaceId_idx" ON "maintenance"("workspaceId")`,

  `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "employees_workspaceId_idx" ON "employees"("workspaceId")`,

  `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "companies_workspaceId_idx" ON "companies"("workspaceId")`,

  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "clients_workspaceId_idx" ON "clients"("workspaceId")`,

  `ALTER TABLE "contact_leads" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "contact_leads_workspaceId_idx" ON "contact_leads"("workspaceId")`,

  `ALTER TABLE "work_tasks" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "work_tasks_workspaceId_idx" ON "work_tasks"("workspaceId")`,

  `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "notifications_workspaceId_idx" ON "notifications"("workspaceId")`,

  `DO $$ BEGIN
     ALTER TABLE "workspace_memberships"
       ADD CONSTRAINT "workspace_memberships_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "workspace_memberships"
       ADD CONSTRAINT "workspace_memberships_userId_fkey"
       FOREIGN KEY ("userId") REFERENCES "users"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "workspace_subscriptions"
       ADD CONSTRAINT "workspace_subscriptions_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "company"
       ADD CONSTRAINT "company_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
       ON DELETE SET NULL ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
];

export async function applyWorkspaceSchemaAdditive(db: SqlRunner) {
  let applied = 0;
  for (const sql of STATEMENTS) {
    await db.$executeRawUnsafe(sql);
    applied += 1;
  }
  return { applied, mode: "additive" as const };
}
