-- Reconciliação de DRIFT schema↔migração (P3 depende disto para o req 23).
--
-- As colunas Interaction.dealId / Interaction.companyId (+ índices + FKs) estão
-- declaradas em schema.prisma há tempo, mas NUNCA foram criadas por nenhuma
-- migração — foram aplicadas fora-de-banda em produção. Assim, um banco LIMPO
-- reconstruído a partir das migrações (CI/staging) fica SEM essas colunas e todo o
-- caminho do req 23 (vincular a mensagem de WhatsApp à timeline do deal/empresa)
-- quebra em runtime ("column does not exist").
--
-- Esta migração é IDEMPOTENTE: no-op onde as colunas/índices/FKs já existem
-- (produção), e cria tudo num banco limpo. Não é destrutiva.

-- Colunas (no-op em prod via IF NOT EXISTS).
ALTER TABLE "Interaction" ADD COLUMN IF NOT EXISTS "dealId" TEXT;
ALTER TABLE "Interaction" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- Índices de consulta da timeline (por tenant + deal/empresa).
CREATE INDEX IF NOT EXISTS "Interaction_tenantId_dealId_idx" ON "Interaction"("tenantId", "dealId");
CREATE INDEX IF NOT EXISTS "Interaction_tenantId_companyId_idx" ON "Interaction"("tenantId", "companyId");

-- FKs (SetNull) — Postgres não tem ADD CONSTRAINT IF NOT EXISTS, então guardamos
-- com um bloco condicional em pg_constraint.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Interaction_dealId_fkey') THEN
    ALTER TABLE "Interaction"
      ADD CONSTRAINT "Interaction_dealId_fkey"
      FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Interaction_companyId_fkey') THEN
    ALTER TABLE "Interaction"
      ADD CONSTRAINT "Interaction_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
