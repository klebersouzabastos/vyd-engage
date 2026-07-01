-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'PAUSED');

-- CreateEnum
CREATE TYPE "CustomFieldEntity" AS ENUM ('DEAL', 'COMPANY', 'CONTACT', 'PRODUCT');

-- CreateEnum
CREATE TYPE "CustomFieldVisibility" AS ENUM ('VISIBLE', 'ON_CREATE', 'BY_FUNNEL', 'UNIQUE');

-- AlterEnum
ALTER TYPE "CustomFieldType" ADD VALUE 'MULTI_SELECT';

-- AlterTable
ALTER TABLE "CustomField" ADD COLUMN     "entity" "CustomFieldEntity",
ADD COLUMN     "visibility" "CustomFieldVisibility" NOT NULL DEFAULT 'VISIBLE';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "lostAt" TIMESTAMP(3),
ADD COLUMN     "lostReasonId" TEXT,
ADD COLUMN     "oneTimeValue" DECIMAL(12,2),
ADD COLUMN     "originCampaignId" TEXT,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "qualification" INTEGER,
ADD COLUMN     "recurringValue" DECIMAL(12,2),
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "wonAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FunnelColumn" ADD COLUMN     "abbreviation" TEXT,
ADD COLUMN     "coolingDays" INTEGER,
ADD COLUMN     "coolingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "objective" VARCHAR(200),
ADD COLUMN     "playbook" VARCHAR(1500);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "LostReason" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OriginCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OriginCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealContact" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "roleInDeal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageRequiredField" (
    "id" TEXT NOT NULL,
    "funnelColumnId" TEXT NOT NULL,
    "customFieldId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageRequiredField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LostReason_tenantId_idx" ON "LostReason"("tenantId");

-- CreateIndex
CREATE INDEX "LostReason_tenantId_active_idx" ON "LostReason"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LostReason_tenantId_label_key" ON "LostReason"("tenantId", "label");

-- CreateIndex
CREATE INDEX "DealSource_tenantId_idx" ON "DealSource"("tenantId");

-- CreateIndex
CREATE INDEX "DealSource_tenantId_active_idx" ON "DealSource"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DealSource_tenantId_name_key" ON "DealSource"("tenantId", "name");

-- CreateIndex
CREATE INDEX "OriginCampaign_tenantId_idx" ON "OriginCampaign"("tenantId");

-- CreateIndex
CREATE INDEX "OriginCampaign_tenantId_active_idx" ON "OriginCampaign"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "OriginCampaign_tenantId_name_key" ON "OriginCampaign"("tenantId", "name");

-- CreateIndex
CREATE INDEX "DealContact_dealId_idx" ON "DealContact"("dealId");

-- CreateIndex
CREATE INDEX "DealContact_leadId_idx" ON "DealContact"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "DealContact_dealId_leadId_key" ON "DealContact"("dealId", "leadId");

-- CreateIndex
CREATE INDEX "StageRequiredField_funnelColumnId_idx" ON "StageRequiredField"("funnelColumnId");

-- CreateIndex
CREATE INDEX "StageRequiredField_customFieldId_idx" ON "StageRequiredField"("customFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "StageRequiredField_funnelColumnId_customFieldId_key" ON "StageRequiredField"("funnelColumnId", "customFieldId");

-- CreateIndex
CREATE INDEX "CustomField_tenantId_entity_idx" ON "CustomField"("tenantId", "entity");

-- CreateIndex
CREATE INDEX "Deal_tenantId_status_idx" ON "Deal"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DealSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_originCampaignId_fkey" FOREIGN KEY ("originCampaignId") REFERENCES "OriginCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_lostReasonId_fkey" FOREIGN KEY ("lostReasonId") REFERENCES "LostReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostReason" ADD CONSTRAINT "LostReason_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealSource" ADD CONSTRAINT "DealSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OriginCampaign" ADD CONSTRAINT "OriginCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealContact" ADD CONSTRAINT "DealContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRequiredField" ADD CONSTRAINT "StageRequiredField_funnelColumnId_fkey" FOREIGN KEY ("funnelColumnId") REFERENCES "FunnelColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRequiredField" ADD CONSTRAINT "StageRequiredField_customFieldId_fkey" FOREIGN KEY ("customFieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

