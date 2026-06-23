-- AlterEnum
ALTER TYPE "AutomationLogStatus" ADD VALUE IF NOT EXISTS 'WAITING';
ALTER TYPE "AutomationLogStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable
ALTER TABLE "AutomationLog" ADD COLUMN IF NOT EXISTS "executeAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationLog_executeAt_idx" ON "AutomationLog"("executeAt");
