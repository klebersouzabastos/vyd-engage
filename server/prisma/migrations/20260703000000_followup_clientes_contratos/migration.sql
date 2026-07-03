-- Follow-up de clientes & contrato guarda-chuva.
-- Aditivo e não-destrutivo (2 enums novos, 2 valores de enum, colunas opcionais/
-- com default em Company e Tenant, FK SetNull e 2 índices); seguro para produção.

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PROSPECT', 'CLIENTE_ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "ContractHolder" AS ENUM ('NOS', 'CONCORRENTE', 'NENHUM');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT_EXPIRING';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CLIENT_FOLLOWUP';

-- AlterTable: status de cliente, dono da conta, cadência própria e contrato guarda-chuva.
ALTER TABLE "Company" ADD COLUMN "clientStatus" "ClientStatus" NOT NULL DEFAULT 'PROSPECT',
ADD COLUMN "assignedTo" TEXT,
ADD COLUMN "followUpIntervalDays" INTEGER,
ADD COLUMN "contractHolder" "ContractHolder" NOT NULL DEFAULT 'NENHUM',
ADD COLUMN "contractCompetitor" TEXT,
ADD COLUMN "contractStartDate" TIMESTAMP(3),
ADD COLUMN "contractEndDate" TIMESTAMP(3),
ADD COLUMN "contractValue" DECIMAL(14,2),
ADD COLUMN "contractScope" TEXT;

-- AlterTable: limiar de inatividade padrão + limiares de alerta de contrato do tenant.
ALTER TABLE "Tenant" ADD COLUMN "clientFollowUpDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "contractAlertDays" JSONB NOT NULL DEFAULT '[90,60,30]';

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Company_tenantId_assignedTo_idx" ON "Company"("tenantId", "assignedTo");

-- CreateIndex
CREATE INDEX "Company_tenantId_contractEndDate_idx" ON "Company"("tenantId", "contractEndDate");
