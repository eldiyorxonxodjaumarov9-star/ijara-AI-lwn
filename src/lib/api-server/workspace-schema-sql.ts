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

  `DO $$ BEGIN
     CREATE TYPE "RentalIndustry" AS ENUM (
       'OFFICE_RENTAL',
       'APARTMENT_RENTAL',
       'HOTEL_HOSTEL',
       'CAR_RENTAL',
       'RETAIL_RENTAL',
       'WAREHOUSE_RENTAL',
       'VILLA_RENTAL',
       'COMMERCIAL_RENTAL',
       'OTHER'
     );
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "industry" "RentalIndustry" NOT NULL DEFAULT 'OTHER'`,
  `ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "demoSeededAt" TIMESTAMP(3)`,
  `ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "demoDataClearedAt" TIMESTAMP(3)`,

  `DO $$ BEGIN
     CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'INACTIVE');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `CREATE TABLE IF NOT EXISTS "vehicles" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "brand" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "year" INTEGER NOT NULL,
      "plateNumber" TEXT NOT NULL,
      "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
      "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "color" TEXT,
      "vin" TEXT,
      "mileage" INTEGER NOT NULL DEFAULT 0,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_workspaceId_plateNumber_key" ON "vehicles"("workspaceId", "plateNumber")`,
  `CREATE INDEX IF NOT EXISTS "vehicles_workspaceId_idx" ON "vehicles"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "vehicles_status_idx" ON "vehicles"("status")`,
  `DO $$ BEGIN
     ALTER TABLE "vehicles"
       ADD CONSTRAINT "vehicles_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `DO $$ BEGIN
     CREATE TYPE "VehicleRentalStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `CREATE TABLE IF NOT EXISTS "vehicle_rentals" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "vehicleId" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "startDate" TIMESTAMP(3) NOT NULL,
      "endDate" TIMESTAMP(3) NOT NULL,
      "days" INTEGER NOT NULL,
      "dailyRate" DOUBLE PRECISION NOT NULL,
      "totalAmount" DOUBLE PRECISION NOT NULL,
      "status" "VehicleRentalStatus" NOT NULL DEFAULT 'PLANNED',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    )`,
  `CREATE INDEX IF NOT EXISTS "vehicle_rentals_workspaceId_idx" ON "vehicle_rentals"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "vehicle_rentals_vehicleId_status_idx" ON "vehicle_rentals"("vehicleId", "status")`,
  `CREATE INDEX IF NOT EXISTS "vehicle_rentals_tenantId_idx" ON "vehicle_rentals"("tenantId")`,
  `DO $$ BEGIN
     ALTER TABLE "vehicle_rentals"
       ADD CONSTRAINT "vehicle_rentals_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "vehicle_rentals"
       ADD CONSTRAINT "vehicle_rentals_vehicleId_fkey"
       FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id")
       ON DELETE NO ACTION ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     IF EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'vehicle_rentals_tenantId_fkey' AND confdeltype = 'c'
     ) THEN
       ALTER TABLE "vehicle_rentals" DROP CONSTRAINT "vehicle_rentals_tenantId_fkey";
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_rentals_tenantId_fkey') THEN
       ALTER TABLE "vehicle_rentals"
         ADD CONSTRAINT "vehicle_rentals_tenantId_fkey"
         FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
         ON DELETE NO ACTION ON UPDATE CASCADE;
     END IF;
   END $$;`,

  `DO $$ BEGIN
     CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `CREATE TABLE IF NOT EXISTS "bookings" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "checkInDate" TIMESTAMP(3) NOT NULL,
      "checkOutDate" TIMESTAMP(3) NOT NULL,
      "nights" INTEGER NOT NULL,
      "nightlyRate" DOUBLE PRECISION NOT NULL,
      "totalAmount" DOUBLE PRECISION NOT NULL,
      "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
      "guestCount" INTEGER NOT NULL DEFAULT 1,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "bookings_dates_check" CHECK ("checkOutDate" > "checkInDate"),
      CONSTRAINT "bookings_nights_check" CHECK ("nights" >= 1),
      CONSTRAINT "bookings_rate_check" CHECK ("nightlyRate" > 0),
      CONSTRAINT "bookings_guests_check" CHECK ("guestCount" >= 1)
    )`,
  `CREATE INDEX IF NOT EXISTS "bookings_workspaceId_idx" ON "bookings"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "bookings_propertyId_status_idx" ON "bookings"("propertyId", "status")`,
  `CREATE INDEX IF NOT EXISTS "bookings_tenantId_idx" ON "bookings"("tenantId")`,
  `DO $$ BEGIN
     ALTER TABLE "bookings"
       ADD CONSTRAINT "bookings_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "bookings"
       ADD CONSTRAINT "bookings_propertyId_fkey"
       FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
       ON DELETE NO ACTION ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "bookings"
       ADD CONSTRAINT "bookings_tenantId_fkey"
       FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
       ON DELETE NO ACTION ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `DO $$ BEGIN
     CREATE TYPE "PaymentSourceType" AS ENUM ('VEHICLE_RENTAL', 'BOOKING');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `CREATE TABLE IF NOT EXISTS "source_payments" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "sourceType" "PaymentSourceType" NOT NULL,
      "vehicleRentalId" TEXT,
      "bookingId" TEXT,
      "amount" DOUBLE PRECISION NOT NULL,
      "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "source_payments_amount_check" CHECK ("amount" > 0),
      CONSTRAINT "source_payments_one_source_check" CHECK (
        ("sourceType" = 'VEHICLE_RENTAL' AND "vehicleRentalId" IS NOT NULL AND "bookingId" IS NULL)
        OR ("sourceType" = 'BOOKING' AND "bookingId" IS NOT NULL AND "vehicleRentalId" IS NULL)
      )
    )`,
  `CREATE INDEX IF NOT EXISTS "source_payments_workspaceId_paymentDate_idx" ON "source_payments"("workspaceId", "paymentDate")`,
  `CREATE INDEX IF NOT EXISTS "source_payments_vehicleRentalId_idx" ON "source_payments"("vehicleRentalId")`,
  `CREATE INDEX IF NOT EXISTS "source_payments_bookingId_idx" ON "source_payments"("bookingId")`,
  `DO $$ BEGIN
     ALTER TABLE "source_payments"
       ADD CONSTRAINT "source_payments_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "source_payments"
       ADD CONSTRAINT "source_payments_vehicleRentalId_fkey"
       FOREIGN KEY ("vehicleRentalId") REFERENCES "vehicle_rentals"("id")
       ON DELETE NO ACTION ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "source_payments"
       ADD CONSTRAINT "source_payments_bookingId_fkey"
       FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
       ON DELETE NO ACTION ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `DO $$ BEGIN
     CREATE TYPE "DebtAdjustmentType" AS ENUM ('WRITE_OFF');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `CREATE TABLE IF NOT EXISTS "debt_adjustments" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "contractId" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "type" "DebtAdjustmentType" NOT NULL DEFAULT 'WRITE_OFF',
      "reason" TEXT NOT NULL,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "debt_adjustments_amount_check" CHECK ("amount" > 0)
    )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "debt_adjustments_contractId_type_reason_key" ON "debt_adjustments"("contractId", "type", "reason")`,
  `CREATE INDEX IF NOT EXISTS "debt_adjustments_workspaceId_idx" ON "debt_adjustments"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "debt_adjustments_tenantId_idx" ON "debt_adjustments"("tenantId")`,
  `DO $$ BEGIN
     ALTER TABLE "debt_adjustments"
       ADD CONSTRAINT "debt_adjustments_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "debt_adjustments"
       ADD CONSTRAINT "debt_adjustments_contractId_fkey"
       FOREIGN KEY ("contractId") REFERENCES "contracts"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "debt_adjustments"
       ADD CONSTRAINT "debt_adjustments_tenantId_fkey"
       FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "debt_adjustments"
       ADD CONSTRAINT "debt_adjustments_createdById_fkey"
       FOREIGN KEY ("createdById") REFERENCES "users"("id")
       ON DELETE SET NULL ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `DO $$ BEGIN
     CREATE TYPE "ManualDebtStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `CREATE TABLE IF NOT EXISTS "manual_debts" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "propertyId" TEXT,
      "debtorName" TEXT NOT NULL,
      "debtorPhone" TEXT,
      "debtorOccupation" TEXT,
      "description" TEXT,
      "originalAmount" DOUBLE PRECISION NOT NULL,
      "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "remainingAmount" DOUBLE PRECISION NOT NULL,
      "debtDate" TIMESTAMP(3) NOT NULL,
      "status" "ManualDebtStatus" NOT NULL DEFAULT 'OPEN',
      "telegramChatId" TEXT,
      "notes" TEXT,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "closedAt" TIMESTAMP(3),
      "cancelledAt" TIMESTAMP(3),
      "cancelledById" TEXT,
      "cancelReason" TEXT,
      CONSTRAINT "manual_debts_original_check" CHECK ("originalAmount" > 0),
      CONSTRAINT "manual_debts_paid_check" CHECK ("paidAmount" >= 0),
      CONSTRAINT "manual_debts_remaining_check" CHECK ("remainingAmount" >= 0 AND "remainingAmount" <= "originalAmount")
    )`,
  `CREATE INDEX IF NOT EXISTS "manual_debts_workspaceId_status_idx" ON "manual_debts"("workspaceId", "status")`,
  `CREATE INDEX IF NOT EXISTS "manual_debts_propertyId_idx" ON "manual_debts"("propertyId")`,
  `DO $$ BEGIN
     ALTER TABLE "manual_debts" ADD CONSTRAINT "manual_debts_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "manual_debts" ADD CONSTRAINT "manual_debts_propertyId_fkey"
       FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "manual_debts" ADD CONSTRAINT "manual_debts_createdById_fkey"
       FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "manual_debts" ADD CONSTRAINT "manual_debts_cancelledById_fkey"
       FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `CREATE TABLE IF NOT EXISTS "manual_debt_payments" (
      "id" TEXT PRIMARY KEY,
      "manualDebtId" TEXT NOT NULL,
      "workspaceId" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "paymentDate" TIMESTAMP(3) NOT NULL,
      "notes" TEXT,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "manual_debt_payments_amount_check" CHECK ("amount" > 0)
    )`,
  `CREATE INDEX IF NOT EXISTS "manual_debt_payments_manualDebtId_idx" ON "manual_debt_payments"("manualDebtId")`,
  `CREATE INDEX IF NOT EXISTS "manual_debt_payments_workspaceId_idx" ON "manual_debt_payments"("workspaceId")`,
  `DO $$ BEGIN
     ALTER TABLE "manual_debt_payments" ADD CONSTRAINT "manual_debt_payments_manualDebtId_fkey"
       FOREIGN KEY ("manualDebtId") REFERENCES "manual_debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "manual_debt_payments" ADD CONSTRAINT "manual_debt_payments_workspaceId_fkey"
       FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "manual_debt_payments" ADD CONSTRAINT "manual_debt_payments_createdById_fkey"
       FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
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
