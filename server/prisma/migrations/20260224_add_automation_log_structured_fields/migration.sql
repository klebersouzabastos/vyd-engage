-- AlterTable: Add structured fields to AutomationLog
-- These fields were previously stored in the JSON `data` column.
-- All new columns are nullable to preserve existing data.

ALTER TABLE "AutomationLog" ADD COLUMN "leadId" TEXT;
ALTER TABLE "AutomationLog" ADD COLUMN "stepOrder" INTEGER;
ALTER TABLE "AutomationLog" ADD COLUMN "stepType" TEXT;
ALTER TABLE "AutomationLog" ADD COLUMN "executionId" TEXT;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AutomationLog_leadId_idx" ON "AutomationLog"("leadId");
CREATE INDEX "AutomationLog_executionId_idx" ON "AutomationLog"("executionId");
CREATE INDEX "AutomationLog_status_idx" ON "AutomationLog"("status");
