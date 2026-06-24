# PRD — Growth Roadmap: VYD Engage (jun/2026 →)

**Versão:** 1.0  
**Autor:** Claude + Kleber Bastos  
**Criado em:** 2026-06-23  
**Status:** Aprovado para implementação

---

## Contexto

O VYD Engage saiu da fase de "foundation" e está em produção em `engage.vydhub.com`. Os épicos já concluídos cobrem a base técnica (TD), features CRM essenciais (leads, deals, pipeline, automações, metas, win/loss, produtos), UX de poder (Ctrl+K, filtros, dnd) e segurança (CORS, rate limit, webhooks).

O próximo ciclo de crescimento tem um objetivo claro: **converter avaliadores em clientes pagantes e reduzir churn**. Os três bloqueadores mais comuns nessa fase são:

1. **Migração impossível** — sem import, o cliente não consegue sair do CRM atual
2. **Diferenciação fraca** — outros CRMs têm features similares; IA muda a percepção de valor
3. **Ecossistema fechado** — sem integrações / campanhas, o time usa múltiplas ferramentas

O roadmap abaixo resolve esses três bloqueadores em sequência, maximizando o impacto por tempo investido.

---

## Épicos — Sequência Recomendada

| Ordem | Épico | ID | Duração | Bloqueador que resolve |
|-------|-------|-----|---------|----------------------|
| 1 | **Import Pro** | EPIC-IMPORT-PRO | 3-4 sem | Migração de CRM anterior |
| 2 | **AI Sales Assistant** | EPIC-AI-SALES | 3-4 sem | Diferenciador competitivo |
| 3 | **Email Campaigns** | EPIC-EMAIL-CAMPAIGNS | 4-5 sem | Ecossistema completo |
| 4 | **API Hub** | EPIC-API-HUB | 4-6 sem | Integrações e parceiros |

**Total estimado:** 14-19 semanas (≈ 4-5 meses, trabalhando em paralelo quando possível)

---

## Épico 1 — Import Pro

**Objetivo:** Qualquer cliente consegue migrar seus dados de outro CRM em menos de 30 minutos.

**PRD:** [`docs/prd/prd-import-pro.md`](prd-import-pro.md)  
**Epic:** [`docs/stories/epic-import-pro.md`](../stories/epic-import-pro.md)

### Stories

| ID | Título | Pts | Fase |
|----|--------|-----|------|
| IMP-1.1 | Upload CSV/Excel com Mapeamento de Campos | 8 | 1 |
| IMP-1.2 | Deduplicação e Preview antes de Importar | 5 | 1 |
| IMP-2.1 | Importação de Deals e Histórico de Interações | 5 | 2 |
| IMP-2.2 | Histórico e Rollback de Importações | 3 | 2 |

**Total:** 21 pts

### Base existente aproveitada
- `leadService.create` — criação em massa via loop
- `server/src/routes/exports.ts` — padrão de rota existente
- Todos os modelos Prisma (`Lead`, `Deal`, `Company`, `Interaction`) já existem

---

## Épico 2 — AI Sales Assistant

**Objetivo:** Vendedor vê em 10 segundos o contexto completo do lead e sabe exatamente o que fazer a seguir.

**PRD:** [`docs/prd/prd-ai-sales-assistant.md`](prd-ai-sales-assistant.md)  
**Epic:** [`docs/stories/epic-ai-sales-assistant.md`](../stories/epic-ai-sales-assistant.md)

### Stories

| ID | Título | Pts | Fase |
|----|--------|-----|------|
| AI-1.1 | Resumo Contextual do Lead (IA) | 5 | 1 |
| AI-1.2 | Sugestão de Próxima Ação com Justificativa | 5 | 1 |
| AI-2.1 | Score de Propensão de Fechamento por Deal | 8 | 2 |
| AI-2.2 | Chat Contextual no Lead | 8 | 2 |

**Total:** 26 pts

### Base existente aproveitada
- `aiDraftService.ts` — chamada ao AI provider (Anthropic/OpenAI)
- `nextActionService.ts` — sugestão de próxima ação existente
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `AI_PROVIDER` já no `.env.example`
- `scoringService.ts` — scoring de lead existente (base para deal score)

---

## Épico 3 — Email Campaigns

**Objetivo:** Time de vendas envia campanhas segmentadas diretamente do CRM, sem Mailchimp externo.

**PRD:** [`docs/prd/prd-email-campaigns.md`](prd-email-campaigns.md)  
**Epic:** [`docs/stories/epic-email-campaigns.md`](../stories/epic-email-campaigns.md)

### Stories

| ID | Título | Pts | Fase |
|----|--------|-----|------|
| EC-1.1 | Criação de Campanha com Editor de Blocos | 13 | 1 |
| EC-1.2 | Segmentação de Audiência e Agendamento | 5 | 1 |
| EC-2.1 | Tracking de Abertura e Clique por Campanha | 5 | 2 |
| EC-2.2 | Dashboard de Resultados de Campanha | 5 | 2 |

**Total:** 28 pts

### Base existente aproveitada
- `emailMessagingService.ts` — envio via Resend/SMTP
- `server/src/routes/tracking.ts` — pixel e link tracking existentes
- `EmailConfig` model — configuração de SMTP por tenant
- Filter Builder (UX-2.1) — segmentação de leads por filtros

---

## Épico 4 — API Hub

**Objetivo:** Desenvolvedores e parceiros integram com o VYD Engage em < 1 dia.

**PRD:** [`docs/prd/prd-api-hub.md`](prd-api-hub.md)  
**Epic:** [`docs/stories/epic-api-hub.md`](../stories/epic-api-hub.md)

### Stories

| ID | Título | Pts | Fase |
|----|--------|-----|------|
| API-1.1 | Documentação Interativa da API (Swagger/Redoc) | 5 | 1 |
| API-1.2 | Webhooks de Saída Configuráveis por Evento | 8 | 1 |
| API-2.1 | Scopes e Permissões por API Key | 5 | 2 |
| API-2.2 | Zapier App Nativo | 13 | 2 |

**Total:** 31 pts

### Base existente aproveitada
- `server/src/routes/outgoingWebhooks.ts` — webhooks de saída (esqueleto)
- `server/src/routes/apiKeys.ts` — gestão de API keys
- `ApiKey` model com `keyHash`, `active`, `lastUsedAt`
- Toda a API REST já documentável via anotações JSDoc

---

## Roadmap Visual

```
2026-07                2026-08               2026-09              2026-10
│                      │                     │                    │
├── EPIC-IMPORT-PRO ───┤                     │                    │
│   IMP-1.1 + 1.2      │                     │                    │
│                  IMP-2.1 + 2.2             │                    │
│                      │                     │                    │
│                      ├── EPIC-AI-SALES ────┤                    │
│                      │   AI-1.1 + 1.2      │                    │
│                      │               AI-2.1 + 2.2               │
│                      │                     │                    │
│                      │                     ├── EPIC-EMAIL-CAMP ─┤
│                      │                     │   EC-1.1 + 1.2     │
│                      │                     │               EC-2.x│
│                      │                     │                    │
│                      │                     │       EPIC-API-HUB ┤
│                      │                     │       API-1.x      │
│                      │                     │              API-2.x│
```

---

## Requisitos Não-Funcionais (todos os épicos)

- **Multi-tenancy:** todo model novo tem `tenantId` + filtro em todas as queries
- **CSRF:** novas rotas autenticadas adicionadas à whitelist `server/src/index.ts:163-190`
- **Rate limiting:** rotas pesadas (import, AI) com limiter dedicado
- **Soft delete:** novos modelos com `deletedAt DateTime?` onde aplicável
- **Indexes:** `(tenantId, createdAt)` e `(tenantId, status)` em novos models
- **Testes:** `npx vitest run` + `npm run build` passando antes de cada commit

---

## Métricas de Sucesso do Roadmap

| Épico | Métrica | Meta |
|-------|---------|------|
| Import Pro | % clientes que completam onboarding < 30min | > 80% |
| AI Sales | NPS da feature "Resumo do Lead" | > 4.5/5 |
| Email Campaigns | Campanhas criadas / tenant / mês | > 2 |
| API Hub | Integrações ativas (Zapier + custom) / tenant | > 1 |

---

## Controle de Progresso

| Épico | Status | Stories Done | Stories Total | Commit |
|-------|--------|-------------|--------------|--------|
| EPIC-IMPORT-PRO | 🔵 Planejado | 0 | 4 | — |
| EPIC-AI-SALES | 🔵 Planejado | 0 | 4 | — |
| EPIC-EMAIL-CAMPAIGNS | 🔵 Planejado | 0 | 4 | — |
| EPIC-API-HUB | 🔵 Planejado | 0 | 4 | — |
