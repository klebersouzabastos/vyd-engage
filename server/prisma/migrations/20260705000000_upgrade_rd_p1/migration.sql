-- Upgrade RD parity — P1 (times & governança: equipes, perfis de permissão,
-- visibilidade por entidade, aprovações e lixeira).
-- Aditivo e não-destrutivo: 2 enums novos, 2 valores de enum, 3 tabelas novas,
-- 2 colunas opcionais em "User", Goal.userId → NULLABLE + Goal.teamId, novas
-- constraints unique/índices e FKs SetNull/Cascade. Seguro para produção.

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('EXPORT', 'BULK', 'DELETE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_REQUEST';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_DECIDED';

-- AlterTable: Goal.userId agora opcional (permite metas de equipe) + Goal.teamId.
-- DROP NOT NULL é aditivo/seguro (não altera linhas existentes).
ALTER TABLE "goals" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "goals" ADD COLUMN "teamId" TEXT;

-- AlterTable: User ganha vínculo opcional com equipe e perfil de permissão.
ALTER TABLE "User" ADD COLUMN "teamId" TEXT;
ALTER TABLE "User" ADD COLUMN "permissionProfileId" TEXT;

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "baseRole" "UserRole" NOT NULL,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "visibility" JSONB NOT NULL DEFAULT '{}',
    "requireApprovalFor" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "reason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_tenantId_name_key" ON "teams"("tenantId", "name");

-- CreateIndex
CREATE INDEX "teams_tenantId_idx" ON "teams"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "permission_profiles_tenantId_name_key" ON "permission_profiles"("tenantId", "name");

-- CreateIndex
CREATE INDEX "permission_profiles_tenantId_idx" ON "permission_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "approval_requests_tenantId_status_idx" ON "approval_requests"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "goals_tenantId_teamId_month_year_key" ON "goals"("tenantId", "teamId", "month", "year");

-- CreateIndex
CREATE INDEX "goals_tenantId_teamId_idx" ON "goals"("tenantId", "teamId");

-- CreateIndex
CREATE INDEX "User_tenantId_teamId_idx" ON "User"("tenantId", "teamId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_permissionProfileId_fkey" FOREIGN KEY ("permissionProfileId") REFERENCES "permission_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_profiles" ADD CONSTRAINT "permission_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
