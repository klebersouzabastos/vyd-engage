-- AlterTable: Add soft delete (deletedAt) to Lead, Deal, Task, Company

ALTER TABLE "Lead" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Deal" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Task" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Company" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex: composite indexes for efficient soft-delete filtering
CREATE INDEX "Lead_tenantId_deletedAt_idx" ON "Lead"("tenantId", "deletedAt");

CREATE INDEX "Deal_tenantId_deletedAt_idx" ON "Deal"("tenantId", "deletedAt");

CREATE INDEX "Task_tenantId_deletedAt_idx" ON "Task"("tenantId", "deletedAt");

CREATE INDEX "Company_tenantId_deletedAt_idx" ON "Company"("tenantId", "deletedAt");
