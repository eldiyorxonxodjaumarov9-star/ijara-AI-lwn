-- RobotRent Global (additive)

CREATE TYPE "RobotRentApplicationType" AS ENUM ('CUSTOMER', 'DISTRIBUTOR', 'MANUFACTURER');
CREATE TYPE "RobotRentApplicationStatus" AS ENUM ('RECEIVED', 'SITE_INSPECTION', 'TRIAL_OFFER', 'MONTHLY_RENTAL', 'REJECTED');

CREATE TABLE IF NOT EXISTS "robotrent_robot_models" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "highlights" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robotrent_robot_models_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "robotrent_robot_models_slug_key" ON "robotrent_robot_models"("slug");

CREATE TABLE IF NOT EXISTS "robotrent_applications" (
    "id" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "type" "RobotRentApplicationType" NOT NULL,
    "status" "RobotRentApplicationStatus" NOT NULL DEFAULT 'RECEIVED',
    "submitIpHash" TEXT,
    "companyName" TEXT,
    "city" TEXT,
    "objectType" TEXT,
    "areaSqm" DECIMAL(12,2),
    "phone" TEXT,
    "startDate" TIMESTAMP(3),
    "serviceCity" TEXT,
    "robotModel" TEXT,
    "hasDemoRobot" BOOLEAN,
    "serviceCapability" TEXT,
    "country" TEXT,
    "techDocumentNote" TEXT,
    "monthlyRentalTerms" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robotrent_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "robotrent_applications_trackingCode_key" ON "robotrent_applications"("trackingCode");
CREATE INDEX IF NOT EXISTS "robotrent_applications_type_status_idx" ON "robotrent_applications"("type", "status");
CREATE INDEX IF NOT EXISTS "robotrent_applications_createdAt_idx" ON "robotrent_applications"("createdAt");
CREATE INDEX IF NOT EXISTS "robotrent_applications_phone_idx" ON "robotrent_applications"("phone");

CREATE TABLE IF NOT EXISTS "robotrent_status_events" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "RobotRentApplicationStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robotrent_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "robotrent_status_events_applicationId_createdAt_idx" ON "robotrent_status_events"("applicationId", "createdAt");

ALTER TABLE "robotrent_status_events" DROP CONSTRAINT IF EXISTS "robotrent_status_events_applicationId_fkey";
ALTER TABLE "robotrent_status_events" ADD CONSTRAINT "robotrent_status_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "robotrent_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "robotrent_status_events" DROP CONSTRAINT IF EXISTS "robotrent_status_events_actorUserId_fkey";
ALTER TABLE "robotrent_status_events" ADD CONSTRAINT "robotrent_status_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "robotrent_trials" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "robotModelId" TEXT,
    "trialZone" TEXT,
    "startDate" TIMESTAMP(3),
    "trialDays" INTEGER,
    "dailyRate" DECIMAL(14,2),
    "dailyCleanedAreaSqm" DECIMAL(12,2),
    "costNotes" TEXT,
    "reportSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robotrent_trials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "robotrent_trials_applicationId_key" ON "robotrent_trials"("applicationId");

ALTER TABLE "robotrent_trials" DROP CONSTRAINT IF EXISTS "robotrent_trials_applicationId_fkey";
ALTER TABLE "robotrent_trials" ADD CONSTRAINT "robotrent_trials_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "robotrent_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "robotrent_trials" DROP CONSTRAINT IF EXISTS "robotrent_trials_robotModelId_fkey";
ALTER TABLE "robotrent_trials" ADD CONSTRAINT "robotrent_trials_robotModelId_fkey" FOREIGN KEY ("robotModelId") REFERENCES "robotrent_robot_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "robotrent_rental_offers" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "terms" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robotrent_rental_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "robotrent_rental_offers_applicationId_idx" ON "robotrent_rental_offers"("applicationId");

ALTER TABLE "robotrent_rental_offers" DROP CONSTRAINT IF EXISTS "robotrent_rental_offers_applicationId_fkey";
ALTER TABLE "robotrent_rental_offers" ADD CONSTRAINT "robotrent_rental_offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "robotrent_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "robotrent_robot_models" ("id", "slug", "name", "description", "imageUrl", "highlights", "active", "sortOrder", "createdAt", "updatedAt")
SELECT 'rr50-seed-001', 'rr-50', 'RR-50', 'Kommunal va tarixiy yuzalar uchun yengil industrial tozalash roboti.', NULL, '["Kichik maydon", "Avtonom xarita", "IP54"]'::jsonb, true, 10, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "robotrent_robot_models" WHERE "slug" = 'rr-50');

INSERT INTO "robotrent_robot_models" ("id", "slug", "name", "description", "imageUrl", "highlights", "active", "sortOrder", "createdAt", "updatedAt")
SELECT 'rr80-seed-001', 'rr-80', 'RR-80', 'Katta obyektlar va yukli zonalarning professional tozalash roboti.', NULL, '["Katta maydon", "Yo‘l sifat rejimi", "IP66"]'::jsonb, true, 20, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "robotrent_robot_models" WHERE "slug" = 'rr-80');