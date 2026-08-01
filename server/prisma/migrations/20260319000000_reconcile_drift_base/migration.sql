-- Reconciliação de drift (parte 1/2).
--
-- "Deal" e "Company" nunca foram criadas por migração: entraram em produção via
-- `prisma db push`, antes do baseline registrado em railway.toml (11 migrations
-- marcadas applied via `prisma migrate resolve`). Consequência: um banco limpo
-- reconstruído só pelas migrações quebrava em 20260320_soft_delete_pattern, o
-- primeiro `ALTER TABLE "Deal"/"Company"` da história.
--
-- Esta migração é retro-datada (20260319 < 20260320) para ordenar ANTES do
-- primeiro ALTER, e cria as duas tabelas no estado-base daquele ponto: colunas
-- adicionadas por migrações posteriores ficam de fora, senão os ADD COLUMN
-- delas (sem IF NOT EXISTS) colidiriam no replay. Índices ficam para a parte
-- 2/2 (20260801000000_reconcile_drift_full), junto com CalendarConnection,
-- Report e demais colunas de drift.
--
-- Em produção (tabelas já existem) é 100% no-op: tudo IF NOT EXISTS/guardado.
-- `prisma migrate deploy` aplica migrações pendentes mesmo fora de ordem.

-- Falha rápida (rollback limpo, re-deploy resolve) em vez de enfileirar locks
-- contra tráfego vivo e ser morto pelo healthcheck do Railway.
SET lock_timeout = '5s';

-- Enums de drift usados pelo estado-base (nenhuma migração os criava)
DO $$ BEGIN
  CREATE TYPE "DealStage" AS ENUM ('QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSING', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CompanySize" AS ENUM ('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable (estado pré-20260320)
CREATE TABLE IF NOT EXISTS "Company" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "size" "CompanySize",
    "phone" TEXT,
    "address" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable (estado pré-20260320)
CREATE TABLE IF NOT EXISTS "Deal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'QUALIFICATION',
    "probability" INTEGER NOT NULL DEFAULT 20,
    "expectedCloseDate" TIMESTAMP(3),
    "leadId" TEXT,
    "companyId" TEXT,
    "assignedTo" TEXT,
    "notes" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "lostReason" TEXT,
    "funnelId" TEXT,
    "funnelColumnId" TEXT,
    "positionInColumn" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (Postgres não tem ADD CONSTRAINT IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Company_tenantId_fkey' AND conrelid = '"Company"'::regclass) THEN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_tenantId_fkey' AND conrelid = '"Deal"'::regclass) THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_leadId_fkey' AND conrelid = '"Deal"'::regclass) THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_companyId_fkey' AND conrelid = '"Deal"'::regclass) THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_assignedTo_fkey' AND conrelid = '"Deal"'::regclass) THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_funnelId_fkey' AND conrelid = '"Deal"'::regclass) THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_funnelColumnId_fkey' AND conrelid = '"Deal"'::regclass) THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_funnelColumnId_fkey" FOREIGN KEY ("funnelColumnId") REFERENCES "FunnelColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
