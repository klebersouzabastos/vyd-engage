-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('LEADS', 'DEALS', 'INTERACTIONS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateTable: import_batches
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorLog" JSONB,
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_tenantId_createdAt_idx" ON "import_batches"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Lead - add importBatchId
ALTER TABLE "Lead" ADD COLUMN "importBatchId" TEXT;

-- AlterTable: Deal - add importBatchId
ALTER TABLE "Deal" ADD COLUMN "importBatchId" TEXT;

-- AlterTable: Interaction - add importBatchId + deletedAt (soft delete for rollback)
ALTER TABLE "Interaction" ADD COLUMN "importBatchId" TEXT;
ALTER TABLE "Interaction" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_tenantId_importBatchId_idx" ON "Lead"("tenantId", "importBatchId");
CREATE INDEX "Deal_tenantId_importBatchId_idx" ON "Deal"("tenantId", "importBatchId");
CREATE INDEX "Interaction_tenantId_importBatchId_idx" ON "Interaction"("tenantId", "importBatchId");
