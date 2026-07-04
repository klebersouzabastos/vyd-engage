-- Upgrade RD parity — P0 (qualificação/questionários, segmentos, presets,
-- gatilhos gerenciais e multi-vendas agendadas).
-- Aditivo e não-destrutivo (4 enums novos, 2 valores de enum, 6 tabelas novas,
-- 1 coluna opcional em Company, FKs Cascade/SetNull e índices); seguro para produção.

-- CreateEnum
CREATE TYPE "ScheduledDealType" AS ENUM ('POS_VENDA', 'CROSS_SELL', 'UPSELL', 'RECOMPRA', 'RELACIONAMENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ScheduledDealStatus" AS ENUM ('PENDING', 'CREATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PresetEntity" AS ENUM ('COMPANY', 'CONTACT', 'DEAL');

-- CreateEnum
CREATE TYPE "TriggerConditionType" AS ENUM ('NO_INTERACTION', 'STUCK_IN_STAGE', 'DEAL_LOST', 'BIG_SALE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MANAGER_TRIGGER';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MULTI_SALE_CREATED';

-- CreateTable
CREATE TABLE "questionnaires" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_responses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_segments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_presets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" "PresetEntity" NOT NULL,
    "field" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "allowCustom" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_triggers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditionType" "TriggerConditionType" NOT NULL,
    "conditionConfig" JSONB NOT NULL,
    "notifyOwner" BOOLEAN NOT NULL DEFAULT true,
    "notifyManagers" BOOLEAN NOT NULL DEFAULT false,
    "notifyUserIds" JSONB NOT NULL DEFAULT '[]',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_deals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "originDealId" TEXT NOT NULL,
    "companyId" TEXT,
    "leadId" TEXT,
    "type" "ScheduledDealType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "funnelId" TEXT,
    "funnelColumnId" TEXT,
    "estimatedValue" DECIMAL(12,2),
    "assignedTo" TEXT,
    "notes" TEXT,
    "status" "ScheduledDealStatus" NOT NULL DEFAULT 'PENDING',
    "createdDealId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_deals_pkey" PRIMARY KEY ("id")
);

-- AlterTable: segmento configurável da empresa (FK SetNull; `industry` permanece).
ALTER TABLE "Company" ADD COLUMN "segmentId" TEXT;

-- CreateIndex
CREATE INDEX "questionnaires_tenantId_idx" ON "questionnaires"("tenantId");

-- CreateIndex
CREATE INDEX "questionnaire_responses_tenantId_dealId_idx" ON "questionnaire_responses"("tenantId", "dealId");

-- CreateIndex
CREATE UNIQUE INDEX "company_segments_tenantId_name_key" ON "company_segments"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "field_presets_tenantId_entity_field_key" ON "field_presets"("tenantId", "entity", "field");

-- CreateIndex
CREATE INDEX "manager_triggers_tenantId_active_idx" ON "manager_triggers"("tenantId", "active");

-- CreateIndex
CREATE INDEX "scheduled_deals_tenantId_status_scheduledFor_idx" ON "scheduled_deals"("tenantId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Company_tenantId_segmentId_idx" ON "Company"("tenantId", "segmentId");

-- AddForeignKey
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_segments" ADD CONSTRAINT "company_segments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_presets" ADD CONSTRAINT "field_presets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_triggers" ADD CONSTRAINT "manager_triggers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_deals" ADD CONSTRAINT "scheduled_deals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "company_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
