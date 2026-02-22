-- CreateEnum
CREATE TYPE "ScoreEvent" AS ENUM ('LEAD_CREATED', 'STATUS_CHANGED', 'TAG_ADDED', 'INTERACTION_CREATED', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'WHATSAPP_REPLIED', 'FORM_SUBMITTED');

-- CreateTable
CREATE TABLE "ScoreRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" "ScoreEvent" NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreRule_tenantId_name_key" ON "ScoreRule"("tenantId", "name");
CREATE INDEX "ScoreRule_tenantId_idx" ON "ScoreRule"("tenantId");
CREATE INDEX "ScoreRule_tenantId_eventType_idx" ON "ScoreRule"("tenantId", "eventType");
CREATE INDEX "ScoreRule_tenantId_active_idx" ON "ScoreRule"("tenantId", "active");

-- AddForeignKey
ALTER TABLE "ScoreRule" ADD CONSTRAINT "ScoreRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
