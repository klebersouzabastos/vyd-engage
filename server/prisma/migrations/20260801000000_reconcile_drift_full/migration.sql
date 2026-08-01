-- Reconciliação de drift (parte 2/2). Ver parte 1: 20260319000000_reconcile_drift_base.
--
-- Conteúdo gerado a partir de `prisma migrate diff` entre um banco limpo
-- migrado (com a parte 1) e o schema.prisma — ou seja, exatamente o que o
-- `prisma db push` da era pré-baseline criou em produção e nenhuma migração
-- registrava: tabelas CalendarConnection/Report, colunas em Lead/Task/Funnel/
-- Automation, conversões de tipo, índices e FKs.
--
-- Cada statement é condicional: em produção (onde tudo já existe) a migração
-- inteira é no-op; em banco limpo ela converge o schema ao estado final.

-- Falha rápida (rollback limpo, re-deploy resolve) em vez de enfileirar locks
-- contra tráfego vivo e ser morto pelo healthcheck do Railway.
SET lock_timeout = '5s';

-- ============ Enums de drift ============
DO $$ BEGIN
  CREATE TYPE "FunnelType" AS ENUM ('LEAD', 'DEAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationStepType" AS ENUM ('DELAY', 'UPDATE_LEAD', 'ADD_TAG', 'REMOVE_TAG', 'CONDITION', 'SEND_WHATSAPP', 'SEND_EMAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportType" AS ENUM ('LEADS', 'SALES', 'AUTOMATIONS', 'TASKS', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ Colunas de drift ============
ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "flowData" JSONB;

ALTER TABLE "Funnel" ADD COLUMN IF NOT EXISTS "type" "FunnelType" NOT NULL DEFAULT 'LEAD';

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "isContact" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "dealId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;

-- ============ Conversões de tipo (guardadas) ============
-- AutomationLog.stepType: 20260224 criou como TEXT; o schema usa o enum.
-- Converte preservando dados (valores fora do enum viram NULL, defensivo).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AutomationLog'
      AND column_name = 'stepType' AND data_type = 'text'
  ) THEN
    ALTER TABLE "AutomationLog" ALTER COLUMN "stepType" TYPE "AutomationStepType"
      USING (CASE WHEN "stepType" IN ('DELAY','UPDATE_LEAD','ADD_TAG','REMOVE_TAG','CONDITION','SEND_WHATSAPP','SEND_EMAIL')
                  THEN "stepType"::"AutomationStepType" ELSE NULL END);
  END IF;
END $$;

-- Payment.amount / Plan.price: init criou DECIMAL sem precisão (65,30); schema pede (10,2).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'amount'
      AND (numeric_precision IS DISTINCT FROM 10 OR numeric_scale IS DISTINCT FROM 2)
  ) THEN
    ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE DECIMAL(10,2);
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'price'
      AND (numeric_precision IS DISTINCT FROM 10 OR numeric_scale IS DISTINCT FROM 2)
  ) THEN
    ALTER TABLE "Plan" ALTER COLUMN "price" TYPE DECIMAL(10,2);
  END IF;
END $$;

-- ============ Tabelas de drift ============
CREATE TABLE IF NOT EXISTS "CalendarConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL DEFAULT 'GOOGLE',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ReportType" NOT NULL DEFAULT 'CUSTOM',
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- ============ Índices de drift ============
CREATE INDEX IF NOT EXISTS "CalendarConnection_tenantId_idx" ON "CalendarConnection"("tenantId");
CREATE INDEX IF NOT EXISTS "CalendarConnection_userId_idx" ON "CalendarConnection"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarConnection_tenantId_userId_provider_key" ON "CalendarConnection"("tenantId", "userId", "provider");
CREATE INDEX IF NOT EXISTS "Report_tenantId_idx" ON "Report"("tenantId");
CREATE INDEX IF NOT EXISTS "Report_tenantId_createdById_idx" ON "Report"("tenantId", "createdById");
CREATE INDEX IF NOT EXISTS "Company_tenantId_idx" ON "Company"("tenantId");
CREATE INDEX IF NOT EXISTS "Company_tenantId_name_idx" ON "Company"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "Company_tenantId_domain_idx" ON "Company"("tenantId", "domain");
CREATE INDEX IF NOT EXISTS "Deal_tenantId_idx" ON "Deal"("tenantId");
CREATE INDEX IF NOT EXISTS "Deal_tenantId_stage_idx" ON "Deal"("tenantId", "stage");
CREATE INDEX IF NOT EXISTS "Deal_tenantId_assignedTo_idx" ON "Deal"("tenantId", "assignedTo");
CREATE INDEX IF NOT EXISTS "Deal_tenantId_leadId_idx" ON "Deal"("tenantId", "leadId");
CREATE INDEX IF NOT EXISTS "Deal_tenantId_companyId_idx" ON "Deal"("tenantId", "companyId");
CREATE INDEX IF NOT EXISTS "Deal_tenantId_expectedCloseDate_idx" ON "Deal"("tenantId", "expectedCloseDate");
CREATE INDEX IF NOT EXISTS "Deal_tenantId_funnelId_idx" ON "Deal"("tenantId", "funnelId");
CREATE INDEX IF NOT EXISTS "Deal_funnelColumnId_idx" ON "Deal"("funnelColumnId");
CREATE INDEX IF NOT EXISTS "Funnel_tenantId_type_idx" ON "Funnel"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "Invitation_invitedBy_idx" ON "Invitation"("invitedBy");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_isContact_idx" ON "Lead"("tenantId", "isContact");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_companyId_idx" ON "Lead"("tenantId", "companyId");
CREATE INDEX IF NOT EXISTS "Subscription_planId_idx" ON "Subscription"("planId");

-- Unique do Funnel: o init criou (tenantId, name); com o campo `type` a chave
-- correta passou a ser (tenantId, name, type). Cria a nova antes de remover a
-- antiga para não haver janela sem garantia de unicidade.
CREATE UNIQUE INDEX IF NOT EXISTS "Funnel_tenantId_name_type_key" ON "Funnel"("tenantId", "name", "type");
DROP INDEX IF EXISTS "Funnel_tenantId_name_key";

-- ============ FKs de drift (guardadas por conname) ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_companyId_fkey' AND conrelid = '"Lead"'::regclass) THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_assignedTo_fkey' AND conrelid = '"Lead"'::regclass) THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_assignedTo_fkey' AND conrelid = '"Task"'::regclass) THEN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_dealId_fkey' AND conrelid = '"Task"'::regclass) THEN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarConnection_tenantId_fkey' AND conrelid = '"CalendarConnection"'::regclass) THEN
    ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarConnection_userId_fkey' AND conrelid = '"CalendarConnection"'::regclass) THEN
    ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Interaction_automationId_fkey' AND conrelid = '"Interaction"'::regclass) THEN
    ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Interaction_userId_fkey' AND conrelid = '"Interaction"'::regclass) THEN
    ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey' AND conrelid = '"Notification"'::regclass) THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Report_tenantId_fkey' AND conrelid = '"Report"'::regclass) THEN
    ALTER TABLE "Report" ADD CONSTRAINT "Report_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Report_createdById_fkey' AND conrelid = '"Report"'::regclass) THEN
    ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
