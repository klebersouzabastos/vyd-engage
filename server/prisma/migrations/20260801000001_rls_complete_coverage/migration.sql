-- Completa a cobertura de RLS iniciada em 20260221_rls_tenant_isolation/_phase2.
--
-- Aquelas migrações cobriram 15 tabelas; todas as tabelas criadas depois
-- (goals, attachments, teams, atestados_*, etc.) ficaram sem RLS. Este bloco
-- dinâmico habilita RLS e cria a política de isolamento em TODA tabela do
-- schema public que tenha coluna "tenantId" e ainda não tenha — idempotente e
-- à prova de reaplicação (no-op onde já existe).
--
-- Segurança operacional (migração roda no deploy, com o deployment antigo
-- ainda servindo tráfego no mesmo banco):
--  - lock_timeout de 5s: ENABLE RLS pega ACCESS EXCLUSIVE; se houver query
--    longa concorrente (export, pg_dump do backup às 03:00 BRT), falhamos
--    rápido com rollback limpo (re-deploy resolve) em vez de enfileirar o
--    lock, congelar o tráfego e ser morto pelo healthcheck.
--  - pula o ENABLE em tabelas com relrowsecurity já ativo (as 15 antigas),
--    evitando locks desnecessários.
--
-- IMPORTANTE (estado atual): o app conecta como dona das tabelas e owners
-- ignoram RLS sem FORCE — estas políticas são defesa-em-profundidade, ativas
-- apenas para roles não-donas. Ativação real exige uma role restrita dedicada
-- + SET app.current_tenant_id por transação (decisão futura, fora desta
-- migração). O 2º argumento `true` de current_setting => NULL quando o GUC não
-- está setado => zero linhas (fail-closed) para essas roles.

DO $$
DECLARE t record;
BEGIN
  EXECUTE 'SET LOCAL lock_timeout = ''5s''';

  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN pg_tables pt
      ON pt.schemaname = 'public' AND pt.tablename = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenantId'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class pc
      WHERE pc.relname = t.table_name
        AND pc.relnamespace = 'public'::regnamespace
        AND pc.relrowsecurity
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
    END IF;

    -- Pula tabelas que já têm qualquer política (as 15 da fase 1/2 usam
    -- nomes "tenant_isolation_<nome minúsculo>"; não recriar nem duplicar).
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = t.table_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING ("tenantId" = current_setting(''app.current_tenant_id'', true))',
        'tenant_isolation_' || lower(t.table_name),
        t.table_name
      );
    END IF;
  END LOOP;
END $$;
