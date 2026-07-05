-- Upgrade RD parity — P2 (documentos & integrações externas: anexos/arquivos,
-- modelos de proposta + propostas geradas com assinatura, integrações plugáveis
-- gated — assinatura/telefonia).
-- Aditivo e não-destrutivo: 2 enums novos, 1 valor de enum, 5 tabelas novas,
-- FKs Cascade/SetNull. Nenhuma coluna alterada em tabelas existentes.
-- Seguro para produção.

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('NONE', 'SENT', 'VIEWED', 'SIGNED', 'REFUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('SIGNATURE', 'PHONE');

-- AlterEnum: notificação de proposta assinada (status da assinatura).
ALTER TYPE "NotificationType" ADD VALUE 'PROPOSAL_SIGNED';

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'db',
    "storageKey" TEXT NOT NULL,
    "dealId" TEXT,
    "companyId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "uploadedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment_blobs" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "attachment_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "templateId" TEXT,
    "version" INTEGER NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "totalValue" DECIMAL(12,2),
    "signatureStatus" "SignatureStatus" NOT NULL DEFAULT 'NONE',
    "signatureEnvelopeId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_tenantId_dealId_idx" ON "attachments"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_companyId_idx" ON "attachments"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_deletedAt_idx" ON "attachments"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "proposal_templates_tenantId_idx" ON "proposal_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_attachmentId_key" ON "proposals"("attachmentId");

-- CreateIndex
CREATE INDEX "proposals_tenantId_dealId_idx" ON "proposals"("tenantId", "dealId");

-- CreateIndex
CREATE INDEX "proposals_tenantId_signatureEnvelopeId_idx" ON "proposals"("tenantId", "signatureEnvelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_tenantId_kind_key" ON "integration_configs"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "integration_configs_tenantId_idx" ON "integration_configs"("tenantId");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "proposal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
