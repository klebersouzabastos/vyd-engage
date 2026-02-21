# VYD Engage - Database Specialist Review

**Tipo:** Peer Review do DRAFT de Technical Debt Assessment
**Revisor:** @data-engineer (Dara)
**Data:** 2026-02-20
**Fase:** Brownfield Discovery - Fase 5 (DB Specialist Review)
**Documento Revisado:** `docs/prd/technical-debt-DRAFT.md` — secao Database (DB-01 a DB-20)

---

## Review Summary

| Aspecto | Veredicto |
|---------|-----------|
| Completude dos debitos DB | APROVADO — todos 20 cobertos |
| Severidades corretas | APROVADO com 2 ajustes |
| Priorizacao no roadmap | PARCIALMENTE APROVADO — 3 reordenacoes |
| Dependencias entre fixes | APROVADO |
| Esforco estimado | PARCIALMENTE — 2 subestimados |

**Veredicto Geral:** APROVADO COM OBSERVACOES

---

## Validacao Item por Item

### Severidades Confirmadas

| ID | Severidade DRAFT | Severidade Revisada | Justificativa |
|----|-----------------|---------------------|---------------|
| DB-01 | ALTO | ALTO | Correto — FK faltante com impacto em queries |
| DB-02 | ALTO | ALTO | Correto — mesmo padrao de DB-01 |
| DB-03 | ALTO | ALTO | Correto — orphan records possíveis |
| DB-04 | ALTO | ALTO | Correto |
| DB-05 | ALTO | ALTO | Correto — NOT NULL sem referencial integrity |
| DB-06 | CRITICO | CRITICO | Correto — production blocker absoluto |
| DB-07 | ALTO | **CRITICO** | **UPGRADE:** Sem RLS, um bug de middleware = cross-tenant breach. Deveria ser Sprint 1. |
| DB-08 | MEDIO | MEDIO | Correto |
| DB-09 | ALTO | MEDIO | **DOWNGRADE:** Interaction como append-only e padrao valido para log de comunicacoes. Adicionar `updatedAt` somente se editavel. Recomendo: documentar como intencional. |
| DB-10 | ALTO | ALTO | Correto — Json excessivo, mas fix e gradual |
| DB-11 | MEDIO | MEDIO | Correto |
| DB-12 | MEDIO | MEDIO | Correto |
| DB-13 | MEDIO | MEDIO | Correto |
| DB-14 | BAIXO | BAIXO | Correto — cosmetic |
| DB-15 | BAIXO | MEDIO | **UPGRADE:** Float para money causa erros reais de centavos em billing. Para um SaaS que processa pagamentos, isso e MEDIO. |
| DB-16 | ALTO | ALTO | Correto — query performance |
| DB-17 | MEDIO | MEDIO | Correto |
| DB-18 | POSITIVO | POSITIVO | Correto — indices compostos bem projetados |
| DB-19 | ALTO | ALTO | Correto — pre-requisito para tudo |
| DB-20 | ALTO | ALTO | Correto — seed essencial para devs |

### Ajustes de Severidade: 3

1. **DB-07:** ALTO → **CRITICO** — RLS e defesa-em-profundidade contra cross-tenant. Deve ser Sprint 1.
2. **DB-09:** ALTO → **MEDIO** — Append-only e valido. Documentar decisao, nao "corrigir".
3. **DB-15:** BAIXO → **MEDIO** — Float em billing cause erros financeiros reais.

---

## Priorizacao — Ajustes Recomendados

### Sprint 1 (Production Blockers) — Adicoes

| Adicionar | Justificativa |
|-----------|---------------|
| **DB-07 (RLS)** | Promovido a CRITICO. Mesmo que esforco alto, ao menos RLS basico para tabelas criticas (Lead, User, Task, Payment). |
| **DB-15 (Float→Decimal)** | Mover de Sprint 4 para Sprint 1. Billing com Float causa erros de centavos que impactam receita e confianca. |

### Sprint 1 — Ordem Revisada

1. DB-19: Baseline migration (pre-requisito)
2. DB-06: Hash/encrypt dados sensiveis
3. DB-07: RLS basico (Lead, User, Task, Payment, Interaction)
4. DB-01-05: Adicionar FKs
5. DB-15: Float → Decimal (Plan.price + Payment.amount)
6. DB-16-17: Indices faltantes

### Sprint 2 — Sem Mudancas

DB-09, DB-10 permanecem no Sprint 2-3 como planejado.

### Sprint 3 — Sem Mudancas

DB-08, DB-11-13 (strings → enums) permanecem.

---

## Esforcos Subestimados

### DB-07 (RLS) — Estimativa Original: 1 semana
**Revisao:** 2-3 semanas para implementacao completa.
**Detalhe:**
- Policy design para cada tabela (20 modelos)
- Testing com multiplos tenants
- Integracao com Prisma (RLS + Prisma requer `SET app.current_tenant`)
- Impacto nas queries existentes
- Edge cases: super admin, cross-tenant reports

**Recomendacao:** Implementar em fases:
1. Sprint 1: RLS para tabelas criticas (Lead, User, Task, Payment) — 1 semana
2. Sprint 2: RLS para demais tabelas — 1 semana
3. Sprint 3: Testing e edge cases — 1 semana

### DB-06 (Encryption) — Estimativa Original: 1 semana
**Revisao:** 1-2 semanas.
**Detalhe:**
- Hash de tokens (passwordResetToken, twoFactorSecret, invitation token) — simples
- Encryption de configs JSON (WhatsApp, Email) — requer key management
- Migration de dados existentes — requer script cuidadoso
- Impacto nas queries que buscam por token direto

---

## Perguntas Respondidas

### "Interaction e intencionalmente append-only?"
**Resposta:** SIM, recomendo tratar como intencional. Interacoes (email, whatsapp, call, meeting, note) sao registros historicos que nao devem ser editados. Padrao append-only e correto para log de comunicacoes.
**Acao:** Documentar no schema.prisma com `/// Append-only: interactions are immutable communication records`.

### "Lead.assignedTo / Task.assignedTo — multiple assignees?"
**Resposta:** Para MVP, FK direta e suficiente. Se multiple assignees for necessario no futuro, criar join table `LeadAssignment` e facil de migrar.
**Acao:** Adicionar FK simples agora. Planejar join table como feature futura.

### "Payment.paymentData (Json) — PCI compliance?"
**Resposta:** CRITICO. Este campo NAO deve conter dados de cartao. Deve conter apenas referencia ao ID de transacao do Mercado Pago. Verificar conteudo real do campo.
**Acao:** Auditar dados existentes. Adicionar CHECK constraint ou validacao a nivel de aplicacao.

---

## Debitos NAO Cobertos (Gap Analysis)

| Gap | Descricao | Severidade Sugerida |
|-----|-----------|---------------------|
| DB-NEW-01 | **Sem backup automatizado** — nao ha evidencia de pg_dump scheduled ou Point-in-Time Recovery configurado | ALTO |
| DB-NEW-02 | **Sem connection pooling** — Prisma default sem PgBouncer. Com multi-tenancy, connections podem esgotar | MEDIO |
| DB-NEW-03 | **Sem monitoramento de queries lentas** — nenhum pg_stat_statements ou query logging configurado | MEDIO |
| DB-NEW-04 | **Sem vacuum/analyze policy** — tabelas de alto throughput (Interaction, AutomationLog) sem manutencao periodica | BAIXO |

---

## Conclusao

O DRAFT captura com precisao os debitos de database. Os 3 ajustes de severidade sao:
1. DB-07 (RLS): ALTO → CRITICO (mover para Sprint 1)
2. DB-09 (updatedAt): ALTO → MEDIO (documentar como intencional)
3. DB-15 (Float): BAIXO → MEDIO (mover para Sprint 1)

4 novos gaps identificados (DB-NEW-01 a DB-NEW-04) devem ser adicionados ao inventario.

**Contagem revisada:**
- Database: 19 debitos existentes + 4 novos = **23 debitos**
- Criticos: 1 → **2** (DB-06 + DB-07)
- Total geral projeto: 91 → **95 debitos**

---

*— Dara, arquitetando dados*
