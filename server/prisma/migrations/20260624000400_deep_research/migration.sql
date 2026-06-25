-- Deep Research (Pesquisa Profunda): fluxo paste-in (v1).
-- Adiciona DeepResearch / DeepResearchTemplate. Os campos status/reportMeta
-- já preveem a futura integração assíncrona com a OpenAI Deep Research API.

-- CreateEnum
CREATE TYPE "DeepResearchStatus" AS ENUM ('DRAFT', 'RESEARCHING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "deep_research_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "promptBody" TEXT NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deep_research_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deep_research" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "templateId" TEXT,
    "promptUsed" TEXT NOT NULL DEFAULT '',
    "variables" JSONB NOT NULL DEFAULT '{}',
    "status" "DeepResearchStatus" NOT NULL DEFAULT 'DRAFT',
    "reportMarkdown" TEXT,
    "reportMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deep_research_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deep_research_templates_tenantId_idx" ON "deep_research_templates"("tenantId");

-- CreateIndex
CREATE INDEX "deep_research_templates_tenantId_isBuiltin_idx" ON "deep_research_templates"("tenantId", "isBuiltin");

-- CreateIndex
CREATE INDEX "deep_research_tenantId_idx" ON "deep_research"("tenantId");

-- CreateIndex
CREATE INDEX "deep_research_tenantId_status_idx" ON "deep_research"("tenantId", "status");

-- CreateIndex
CREATE INDEX "deep_research_tenantId_createdAt_idx" ON "deep_research"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "deep_research_templates" ADD CONSTRAINT "deep_research_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deep_research" ADD CONSTRAINT "deep_research_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deep_research" ADD CONSTRAINT "deep_research_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "deep_research_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
