-- AlterEnum: add COMPANIES to ImportType (PG 12+ allows ADD VALUE in a tx as long
-- as the new value is not used in the same transaction — it is not here).
ALTER TYPE "ImportType" ADD VALUE 'COMPANIES';

-- AlterTable: Company — native fields for the legacy-CRM migration (additive only).
ALTER TABLE "Company" ADD COLUMN "fantasyName" TEXT;
ALTER TABLE "Company" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "Company" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Company" ADD COLUMN "customFields" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Company" ADD COLUMN "importBatchId" TEXT;

-- CreateIndex
CREATE INDEX "Company_tenantId_externalId_idx" ON "Company"("tenantId", "externalId");
CREATE INDEX "Company_tenantId_importBatchId_idx" ON "Company"("tenantId", "importBatchId");
