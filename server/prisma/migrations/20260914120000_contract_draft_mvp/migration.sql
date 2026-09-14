-- Additive: Company lessor fields + ContractRequest MVP tables
-- Non-destructive: no DROP / RENAME / TRUNCATE

ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorFullName" TEXT;
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorPassport" TEXT;
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorJshshir" TEXT;
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorAddress" TEXT;
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorCity" TEXT DEFAULT 'Тошкент шаҳри';
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorBankStir" TEXT;
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorBankMfo" TEXT;
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorBankName" TEXT;
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorAccount" TEXT;
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorCardNumber" TEXT;
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "lessorPhone" TEXT;

DO $$ BEGIN
  CREATE TYPE "ContractDraftStatus" AS ENUM (
    'DRAFT', 'AWAITING_CLIENT', 'CLIENT_FORM_OPENED', 'GENERATING',
    'CREATED', 'FAILED', 'EXPIRED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContractPartyCategory" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContractPartySubtype" AS ENUM ('NONE', 'SELF_EMPLOYED', 'YTT', 'MCHJ');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContractTemplateKind" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContractDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "contract_requests" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "partyCategory" "ContractPartyCategory" NOT NULL,
  "partySubtype" "ContractPartySubtype" NOT NULL DEFAULT 'NONE',
  "templateKind" "ContractTemplateKind" NOT NULL,
  "templateVersion" TEXT NOT NULL DEFAULT 'v1',
  "status" "ContractDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "phoneNormalized" TEXT NOT NULL,
  "phoneDisplay" TEXT,
  "contractNumber" TEXT,
  "contractDate" TIMESTAMP(3),
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "serviceName" TEXT NOT NULL,
  "areaSqm" INTEGER NOT NULL,
  "ratePerSqm" INTEGER NOT NULL,
  "monthCount" INTEGER NOT NULL,
  "monthlyAmount" INTEGER NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "paymentDueDay" INTEGER NOT NULL,
  "depositAmount" INTEGER NOT NULL,
  "adminSnapshot" JSONB NOT NULL,
  "clientSnapshot" JSONB,
  "lessorSnapshot" JSONB NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "telegramChatId" TEXT,
  "telegramUserId" TEXT,
  "failReasonSafe" TEXT,
  "leaseContractId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_requests_contractNumber_key" ON "contract_requests"("contractNumber");
CREATE INDEX IF NOT EXISTS "contract_requests_tenantId_status_idx" ON "contract_requests"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "contract_requests_propertyId_idx" ON "contract_requests"("propertyId");
CREATE INDEX IF NOT EXISTS "contract_requests_phoneNormalized_status_idx" ON "contract_requests"("phoneNormalized", "status");
CREATE INDEX IF NOT EXISTS "contract_requests_status_createdAt_idx" ON "contract_requests"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "contract_requests_tokenHash_idx" ON "contract_requests"("tokenHash");

DO $$ BEGIN
  ALTER TABLE "contract_requests"
    ADD CONSTRAINT "contract_requests_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "contract_requests"
    ADD CONSTRAINT "contract_requests_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "contract_requests"
    ADD CONSTRAINT "contract_requests_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "contract_status_events" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "fromStatus" "ContractDraftStatus",
  "toStatus" "ContractDraftStatus" NOT NULL,
  "actorUserId" TEXT,
  "actorKind" TEXT NOT NULL DEFAULT 'SYSTEM',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contract_status_events_requestId_createdAt_idx"
  ON "contract_status_events"("requestId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "contract_status_events"
    ADD CONSTRAINT "contract_status_events_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "contract_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "contract_status_events"
    ADD CONSTRAINT "contract_status_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "contract_generated_documents" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "storageUrl" TEXT NOT NULL,
  "storageKey" TEXT,
  "mimeType" TEXT NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  "originalName" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "contentSha256" TEXT NOT NULL,
  "templateKind" "ContractTemplateKind" NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_generated_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_generated_documents_requestId_key"
  ON "contract_generated_documents"("requestId");

DO $$ BEGIN
  ALTER TABLE "contract_generated_documents"
    ADD CONSTRAINT "contract_generated_documents_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "contract_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "contract_delivery_events" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'TELEGRAM',
  "status" "ContractDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "telegramChatId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "lastErrorSafe" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_delivery_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contract_delivery_events_status_nextRetryAt_idx"
  ON "contract_delivery_events"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "contract_delivery_events_requestId_idx"
  ON "contract_delivery_events"("requestId");

DO $$ BEGIN
  ALTER TABLE "contract_delivery_events"
    ADD CONSTRAINT "contract_delivery_events_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "contract_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- At most one "active" request per tenant (app also enforces)
CREATE UNIQUE INDEX IF NOT EXISTS "contract_requests_one_active_per_tenant"
  ON "contract_requests"("tenantId")
  WHERE "status" IN ('DRAFT', 'AWAITING_CLIENT', 'CLIENT_FORM_OPENED', 'GENERATING', 'FAILED');
