# Épico: AI Sales Assistant

**Epic ID:** EPIC-AI-SALES  
**PRD:** [docs/prd/prd-ai-sales-assistant.md](../prd/prd-ai-sales-assistant.md)  
**Roadmap:** [docs/prd/prd-growth-roadmap.md](../prd/prd-growth-roadmap.md)  
**Prioridade:** P0  
**Status:** Planejado  
**Criado em:** 2026-06-23  
**Sequência:** 2º épico do Growth Roadmap (iniciar após EPIC-IMPORT-PRO Sprint 1)

---

## Contexto

Diferenciador competitivo: nenhum CRM BR de médio porte entrega assistente de IA integrado ao contexto real do lead. Aumenta retenção e percepção de valor premium.

**Pré-requisito de infra:** `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` configurados em produção.

---

## Stories

### Fase 1 — Contexto e Próxima Ação (Sprint 1, P0)

| Story | Título | Pts | Status | Paralelo com |
|-------|--------|-----|--------|-------------|
| [AI-1.1](ai-1.1-lead-summary.md) | Resumo Contextual do Lead (IA) | 5 | Draft | AI-1.2 |
| [AI-1.2](ai-1.2-next-action-suggestion.md) | Sugestão de Próxima Ação com Justificativa | 5 | Draft | AI-1.1 |

### Fase 2 — Predição e Chat (Sprint 2, P1)

| Story | Título | Pts | Status | Dependência |
|-------|--------|-----|--------|------------|
| [AI-2.1](ai-2.1-deal-closing-score.md) | Score de Propensão de Fechamento por Deal | 8 | Draft | AI-1.1 (padrão de integração AI) |
| [AI-2.2](ai-2.2-contextual-chat.md) | Chat Contextual no Lead | 8 | Draft | AI-1.1 (padrão de integração AI) |

---

## Grafo de Dependências

```
AI-1.1 ─── AI-1.2 (paralelo, Sprint 1)
    │
    ├─── AI-2.1 (Sprint 2)
    └─── AI-2.2 (Sprint 2)
```

**Sprint 1 paralelo:** AI-1.1 + AI-1.2 (10 pts)  
**Sprint 2:** AI-2.1 + AI-2.2 (16 pts)

---

## Novos Arquivos Previstos

| Arquivo | Tipo |
|---------|------|
| `server/src/routes/ai.ts` (já existe) | Backend — adicionar endpoints de summary e score |
| `server/src/services/aiSalesService.ts` | Backend — prompts especializados para vendas |
| `server/src/jobs/dealScorer.ts` | Backend — job BullMQ para score em batch |
| `src/components/leads/AISummaryCard.tsx` | Frontend — card de resumo colapsável |
| `src/components/leads/NextActionBadge.tsx` | Frontend — badge com tooltip de justificativa |
| `src/components/deals/DealAIScore.tsx` | Frontend — gauge circular de score |
| `src/components/leads/AIChatPanel.tsx` | Frontend — chat contextual |

## Migração Prisma necessária

```prisma
// Deal — adicionar:
aiScore          Float?
aiScoreUpdatedAt DateTime?
aiScoreFactors   Json?
```

---

## Total

| Fase | Stories | Pontos |
|------|---------|--------|
| Fase 1 — Contexto | 2 | 10 |
| Fase 2 — Predição+Chat | 2 | 16 |
| **Total** | **4** | **26** |

---

## Próximos Passos

1. **@po (Pax)** — `*validate-story-draft` em AI-1.1 e AI-1.2
2. **@dev (Dex)** — Sprint 1: AI-1.1 + AI-1.2 em paralelo
3. **@qa (Quinn)** — QA gate por story
4. **@devops (Gage)** — push + PR após Sprint 1 done
5. **@dev (Dex)** — Sprint 2: AI-2.1 + AI-2.2
