-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('VISITA', 'APRESENTACAO', 'LIGACAO', 'REUNIAO', 'EMAIL', 'PROPOSTA', 'OUTRO');

-- CreateEnum
CREATE TYPE "CommercialRoadmapStatus" AS ENUM ('PLANEJAMENTO', 'EM_ANDAMENTO', 'PROPOSTA', 'GANHO', 'PERDIDO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "StakeholderRole" AS ENUM ('DECISOR', 'INFLUENCIADOR', 'TECNICO', 'APROVADOR', 'USUARIO');

-- CreateEnum
CREATE TYPE "StakeholderPosture" AS ENUM ('FAVORAVEL', 'NEUTRO', 'CONTRARIO', 'DESCONHECIDO');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "empreendimentoId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "empreendimentoId" TEXT,
ADD COLUMN     "reportsToId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "empreendimentoId" TEXT,
ADD COLUMN     "roadmapId" TEXT,
ADD COLUMN     "type" "TaskType";

-- AlterTable
ALTER TABLE "deep_research" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "empreendimentos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "location" TEXT,
    "estimatedValue" DECIMAL(14,2),
    "phase" TEXT,
    "expectedDecisionDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "notes" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empreendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbook_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_steps" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "actionType" "TaskType" NOT NULL DEFAULT 'OUTRO',
    "targetRole" "StakeholderRole",
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT,

    CONSTRAINT "playbook_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_roadmaps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "empreendimentoId" TEXT,
    "dealId" TEXT,
    "deepResearchId" TEXT,
    "playbookTemplateId" TEXT,
    "status" "CommercialRoadmapStatus" NOT NULL DEFAULT 'PLANEJAMENTO',
    "targetProposalDate" TIMESTAMP(3),
    "notes" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_roadmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_stakeholders" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "roleInDecision" "StakeholderRole" NOT NULL DEFAULT 'USUARIO',
    "posture" "StakeholderPosture" NOT NULL DEFAULT 'DESCONHECIDO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "empreendimentos_tenantId_idx" ON "empreendimentos"("tenantId");

-- CreateIndex
CREATE INDEX "empreendimentos_tenantId_companyId_idx" ON "empreendimentos"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "empreendimentos_tenantId_status_idx" ON "empreendimentos"("tenantId", "status");

-- CreateIndex
CREATE INDEX "empreendimentos_tenantId_deletedAt_idx" ON "empreendimentos"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "playbook_templates_tenantId_idx" ON "playbook_templates"("tenantId");

-- CreateIndex
CREATE INDEX "playbook_templates_tenantId_isBuiltin_idx" ON "playbook_templates"("tenantId", "isBuiltin");

-- CreateIndex
CREATE INDEX "playbook_steps_templateId_idx" ON "playbook_steps"("templateId");

-- CreateIndex
CREATE INDEX "commercial_roadmaps_tenantId_idx" ON "commercial_roadmaps"("tenantId");

-- CreateIndex
CREATE INDEX "commercial_roadmaps_tenantId_status_idx" ON "commercial_roadmaps"("tenantId", "status");

-- CreateIndex
CREATE INDEX "commercial_roadmaps_tenantId_companyId_idx" ON "commercial_roadmaps"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "commercial_roadmaps_tenantId_empreendimentoId_idx" ON "commercial_roadmaps"("tenantId", "empreendimentoId");

-- CreateIndex
CREATE INDEX "commercial_roadmaps_tenantId_deletedAt_idx" ON "commercial_roadmaps"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "roadmap_stakeholders_roadmapId_idx" ON "roadmap_stakeholders"("roadmapId");

-- CreateIndex
CREATE INDEX "roadmap_stakeholders_leadId_idx" ON "roadmap_stakeholders"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_stakeholders_roadmapId_leadId_key" ON "roadmap_stakeholders"("roadmapId", "leadId");

-- CreateIndex
CREATE INDEX "Deal_tenantId_empreendimentoId_idx" ON "Deal"("tenantId", "empreendimentoId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_empreendimentoId_idx" ON "Lead"("tenantId", "empreendimentoId");

-- CreateIndex
CREATE INDEX "Lead_reportsToId_idx" ON "Lead"("reportsToId");

-- CreateIndex
CREATE INDEX "Task_tenantId_companyId_idx" ON "Task"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "Task_tenantId_empreendimentoId_idx" ON "Task"("tenantId", "empreendimentoId");

-- CreateIndex
CREATE INDEX "Task_tenantId_roadmapId_idx" ON "Task"("tenantId", "roadmapId");

-- CreateIndex
CREATE INDEX "Task_tenantId_type_idx" ON "Task"("tenantId", "type");

-- CreateIndex
CREATE INDEX "deep_research_tenantId_companyId_idx" ON "deep_research"("tenantId", "companyId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "empreendimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "empreendimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "empreendimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "commercial_roadmaps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deep_research" ADD CONSTRAINT "deep_research_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empreendimentos" ADD CONSTRAINT "empreendimentos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empreendimentos" ADD CONSTRAINT "empreendimentos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_templates" ADD CONSTRAINT "playbook_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_steps" ADD CONSTRAINT "playbook_steps_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "playbook_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_roadmaps" ADD CONSTRAINT "commercial_roadmaps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_roadmaps" ADD CONSTRAINT "commercial_roadmaps_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_roadmaps" ADD CONSTRAINT "commercial_roadmaps_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "empreendimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_roadmaps" ADD CONSTRAINT "commercial_roadmaps_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_roadmaps" ADD CONSTRAINT "commercial_roadmaps_deepResearchId_fkey" FOREIGN KEY ("deepResearchId") REFERENCES "deep_research"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_roadmaps" ADD CONSTRAINT "commercial_roadmaps_playbookTemplateId_fkey" FOREIGN KEY ("playbookTemplateId") REFERENCES "playbook_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_stakeholders" ADD CONSTRAINT "roadmap_stakeholders_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "commercial_roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_stakeholders" ADD CONSTRAINT "roadmap_stakeholders_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
