-- Arenda schema baseline bridge (additive only)
-- Source: prisma migrate diff from legacy Warehouse migrations -> 8ac4f6e pre-employee schema
-- Stripped: DROP/TRUNCATE for Warehouse legacy tables (left intact)
-- Does NOT include: startedAt, employees.phone unique, WorkTask/*, TTLock, RecurringExpense, SmsTenantLink
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'RESERVED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('UTILITIES', 'SALARY', 'TAX', 'REPAIR', 'MARKETING', 'ADVANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "MonthlyExpenseType" AS ENUM ('WATER', 'ELECTRICITY', 'OFFICE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'SUCCESS', 'CONTRACT_EXPIRED', 'LATE_PAYMENT');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('NEW', 'MATCHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContactInterest" AS ENUM ('INTERESTED', 'CALLED', 'THINKING', 'VISITED', 'FOLLOW_UP', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "RentalListingStatus" AS ENUM ('ACTIVE', 'DRAFT', 'RENTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PostingPlatform" AS ENUM ('ARENDA_INTERNAL', 'TELEGRAM', 'INSTAGRAM', 'OLX', 'JOYMEE', 'EGASI', 'BESTE');

-- CreateEnum
CREATE TYPE "PostingJobStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'MANUAL_REQUIRED');

-- CreateEnum
CREATE TYPE "TelegramPostingStatus" AS ENUM ('PENDING', 'SENDING', 'POSTED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "language" TEXT NOT NULL DEFAULT 'uz',
    "refreshTokenHash" TEXT,
    "resetToken" TEXT,
    "resetTokenExp" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "telegramAdminChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'ArendaHub',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.04,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "building" TEXT,
    "rentPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rooms" INTEGER NOT NULL DEFAULT 0,
    "area" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "clientNumber" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passport" TEXT NOT NULL,
    "login" TEXT,
    "password" TEXT,
    "telegram" TEXT,
    "telegramChatId" TEXT,
    "email" TEXT,
    "address" TEXT,
    "rentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contractDuration" INTEGER,
    "entryDate" TIMESTAMP(3),
    "paymentDueDate" TIMESTAMP(3),
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "monthlyRent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodYear" INTEGER,
    "periodMonth" INTEGER,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "position" TEXT,
    "monthlySalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salaryPayDay" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "receiptUrl" TEXT,
    "employeeId" TEXT,
    "monthlyType" "MonthlyExpenseType",
    "monthlyTypeCustom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'PENDING',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'NEW',
    "tenantId" TEXT,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loginCount" INTEGER NOT NULL DEFAULT 1,
    "firstLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_archives" (
    "id" TEXT NOT NULL,
    "clientNumber" TEXT NOT NULL,
    "tenantId" TEXT,
    "contractId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passport" TEXT,
    "propertyId" TEXT,
    "propertyName" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3),
    "leaveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractStart" TIMESTAMP(3) NOT NULL,
    "contractEnd" TIMESTAMP(3) NOT NULL,
    "monthlyRent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "contractDuration" INTEGER,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_leads" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "interest" "ContactInterest" NOT NULL DEFAULT 'CALLED',
    "notes" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_sessions" (
    "chatId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'menu',
    "pendingEmail" TEXT,
    "ownerUserId" TEXT,
    "pendingUserId" TEXT,
    "pendingOtp" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_sessions_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable
CREATE TABLE "telegram_admin_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_admin_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bot_users" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "phone" TEXT,
    "selectedRole" TEXT,
    "tenantId" TEXT,
    "startCount" INTEGER NOT NULL DEFAULT 1,
    "firstStartAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStartAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phoneVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_listings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "region" TEXT,
    "district" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "rooms" INTEGER NOT NULL DEFAULT 1,
    "area" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "status" "RentalListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "landlordEmail" TEXT NOT NULL,
    "landlordName" TEXT,
    "legacyLocalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_listing_images" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_listing_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_channels" (
    "id" TEXT NOT NULL,
    "platform" "PostingPlatform" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "secrets" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posting_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_jobs" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "platform" "PostingPlatform" NOT NULL,
    "status" "PostingJobStatus" NOT NULL DEFAULT 'PENDING',
    "generatedText" TEXT,
    "manualPackage" JSONB,
    "externalPostId" TEXT,
    "postUrl" TEXT,
    "channelName" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posting_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posting_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "chatId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "regionFilters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "propertyTypeFilters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isBotAdmin" BOOLEAN,
    "lastAdminCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_posting_jobs" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "TelegramPostingStatus" NOT NULL DEFAULT 'PENDING',
    "caption" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "externalPostId" TEXT,
    "postUrl" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_posting_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_posting_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_posting_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramAdminChatId_key" ON "users"("telegramAdminChatId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_region_idx" ON "properties"("region");

-- CreateIndex
CREATE INDEX "properties_building_idx" ON "properties"("building");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_clientNumber_key" ON "tenants"("clientNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_login_key" ON "tenants"("login");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_telegramChatId_key" ON "tenants"("telegramChatId");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_propertyId_idx" ON "contracts"("propertyId");

-- CreateIndex
CREATE INDEX "contracts_tenantId_idx" ON "contracts"("tenantId");

-- CreateIndex
CREATE INDEX "payments_contractId_idx" ON "payments"("contractId");

-- CreateIndex
CREATE INDEX "payments_paymentDate_idx" ON "payments"("paymentDate");

-- CreateIndex
CREATE INDEX "payments_periodYear_periodMonth_idx" ON "payments"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_active_idx" ON "companies"("active");

-- CreateIndex
CREATE INDEX "employees_active_idx" ON "employees"("active");

-- CreateIndex
CREATE INDEX "employees_fullName_idx" ON "employees"("fullName");

-- CreateIndex
CREATE INDEX "employees_salaryPayDay_idx" ON "employees"("salaryPayDay");

-- CreateIndex
CREATE INDEX "employees_companyId_idx" ON "employees"("companyId");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_employeeId_idx" ON "expenses"("employeeId");

-- CreateIndex
CREATE INDEX "expenses_monthlyType_idx" ON "expenses"("monthlyType");

-- CreateIndex
CREATE INDEX "maintenance_status_idx" ON "maintenance"("status");

-- CreateIndex
CREATE INDEX "maintenance_propertyId_idx" ON "maintenance"("propertyId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_tenantId_idx" ON "clients"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_archives_clientNumber_idx" ON "tenant_archives"("clientNumber");

-- CreateIndex
CREATE INDEX "tenant_archives_tenantId_idx" ON "tenant_archives"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_archives_leaveDate_idx" ON "tenant_archives"("leaveDate");

-- CreateIndex
CREATE INDEX "tenant_archives_propertyName_idx" ON "tenant_archives"("propertyName");

-- CreateIndex
CREATE INDEX "contact_leads_phone_idx" ON "contact_leads"("phone");

-- CreateIndex
CREATE INDEX "contact_leads_interest_idx" ON "contact_leads"("interest");

-- CreateIndex
CREATE INDEX "contact_leads_createdAt_idx" ON "contact_leads"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_admin_devices_chatId_key" ON "telegram_admin_devices"("chatId");

-- CreateIndex
CREATE INDEX "telegram_admin_devices_userId_idx" ON "telegram_admin_devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bot_users_chatId_key" ON "telegram_bot_users"("chatId");

-- CreateIndex
CREATE INDEX "telegram_bot_users_phone_idx" ON "telegram_bot_users"("phone");

-- CreateIndex
CREATE INDEX "telegram_bot_users_tenantId_idx" ON "telegram_bot_users"("tenantId");

-- CreateIndex
CREATE INDEX "telegram_bot_users_lastStartAt_idx" ON "telegram_bot_users"("lastStartAt");

-- CreateIndex
CREATE INDEX "rental_listings_landlordEmail_idx" ON "rental_listings"("landlordEmail");

-- CreateIndex
CREATE INDEX "rental_listings_status_idx" ON "rental_listings"("status");

-- CreateIndex
CREATE INDEX "rental_listing_images_listingId_idx" ON "rental_listing_images"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "posting_channels_platform_key" ON "posting_channels"("platform");

-- CreateIndex
CREATE INDEX "posting_jobs_status_idx" ON "posting_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "posting_jobs_listingId_platform_key" ON "posting_jobs"("listingId", "platform");

-- CreateIndex
CREATE INDEX "posting_logs_jobId_idx" ON "posting_logs"("jobId");

-- CreateIndex
CREATE INDEX "telegram_channels_enabled_idx" ON "telegram_channels"("enabled");

-- CreateIndex
CREATE INDEX "telegram_posting_jobs_status_idx" ON "telegram_posting_jobs"("status");

-- CreateIndex
CREATE INDEX "telegram_posting_jobs_scheduledAt_idx" ON "telegram_posting_jobs"("scheduledAt");

-- CreateIndex
CREATE INDEX "telegram_posting_jobs_listingId_idx" ON "telegram_posting_jobs"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_posting_jobs_listingId_channelId_key" ON "telegram_posting_jobs"("listingId", "channelId");

-- CreateIndex
CREATE INDEX "telegram_posting_logs_jobId_idx" ON "telegram_posting_logs"("jobId");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_archives" ADD CONSTRAINT "tenant_archives_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_archives" ADD CONSTRAINT "tenant_archives_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_admin_devices" ADD CONSTRAINT "telegram_admin_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bot_users" ADD CONSTRAINT "telegram_bot_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_listing_images" ADD CONSTRAINT "rental_listing_images_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "rental_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_jobs" ADD CONSTRAINT "posting_jobs_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "rental_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_logs" ADD CONSTRAINT "posting_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "posting_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_posting_jobs" ADD CONSTRAINT "telegram_posting_jobs_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "rental_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_posting_jobs" ADD CONSTRAINT "telegram_posting_jobs_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "telegram_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_posting_logs" ADD CONSTRAINT "telegram_posting_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "telegram_posting_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
