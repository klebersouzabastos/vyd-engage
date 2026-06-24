# Épico: Email Campaigns

**Epic ID:** EPIC-EMAIL-CAMPAIGNS  
**PRD:** [docs/prd/prd-email-campaigns.md](../prd/prd-email-campaigns.md)  
**Roadmap:** [docs/prd/prd-growth-roadmap.md](../prd/prd-growth-roadmap.md)  
**Prioridade:** P1  
**Status:** Planejado  
**Criado em:** 2026-06-23  
**Sequência:** 3º épico do Growth Roadmap

---

## Contexto

Elimina a necessidade de Mailchimp externo. Campanhas de email integradas ao funil de leads aumentam a visibilidade do ROI de marketing e reduzem fragmentação de ferramentas.

**Pré-requisitos de infra:** `RESEND_API_KEY` ou `SMTP_*` configurados. UX-2.1 (FilterBuilder) concluído para reutilizar lógica de filtros na segmentação.

---

## Stories

### Fase 1 — Criação e Envio (Sprint 1, P0)

| Story | Título | Pts | Status | Paralelo com |
|-------|--------|-----|--------|-------------|
| [EC-1.1](ec-1.1-campaign-editor.md) | Criação de Campanha com Editor de Blocos | 13 | Draft | — |
| [EC-1.2](ec-1.2-segmentation-scheduling.md) | Segmentação de Audiência e Agendamento | 5 | Draft | depende de EC-1.1 |

### Fase 2 — Tracking e Resultados (Sprint 2, P1)

| Story | Título | Pts | Status | Dependência |
|-------|--------|-----|--------|------------|
| [EC-2.1](ec-2.1-click-open-tracking.md) | Tracking de Abertura e Clique por Campanha | 5 | Draft | EC-1.1 completa |
| [EC-2.2](ec-2.2-campaign-dashboard.md) | Dashboard de Resultados de Campanha | 5 | Draft | EC-2.1 completa |

---

## Grafo de Dependências

```
EC-1.1 → EC-1.2 (sequencial, Sprint 1)
EC-1.1 → EC-2.1 → EC-2.2 (sequencial, Sprint 2)
```

**Sprint 1:** EC-1.1 → EC-1.2 (18 pts — sequencial, EC-1.2 depende do modelo criado em EC-1.1)  
**Sprint 2:** EC-2.1 → EC-2.2 (10 pts)

---

## Novos Arquivos Previstos

| Arquivo | Tipo |
|---------|------|
| `server/src/routes/campaigns.ts` | Backend — CRUD + envio |
| `server/src/services/campaignService.ts` | Backend — lógica de envio, merge tags |
| `server/src/jobs/campaignSender.ts` | Backend — job BullMQ para envio em lote |
| `src/pages/Campaigns.tsx` | Frontend — listagem |
| `src/pages/CampaignDetail.tsx` | Frontend — detalhe + resultados |
| `src/components/campaigns/BlockEditor.tsx` | Frontend — editor de blocos |
| `src/components/campaigns/AudienceSelector.tsx` | Frontend — seletor de filtros |
| `src/components/campaigns/CampaignStats.tsx` | Frontend — métricas e gráfico |

## Migração Prisma necessária

```prisma
model Campaign { ... }
model CampaignRecipient { ... }
model CampaignEvent { ... }
enum CampaignStatus { DRAFT SCHEDULED SENDING SENT PAUSED CANCELLED }
enum RecipientStatus { PENDING SENT BOUNCED UNSUBSCRIBED }
enum CampaignEventType { OPENED CLICKED BOUNCED UNSUBSCRIBED }
// Lead.unsubscribed Boolean @default(false)
// Lead.unsubscribedAt DateTime?
```

---

## Total

| Fase | Stories | Pontos |
|------|---------|--------|
| Fase 1 — Criação e Envio | 2 | 18 |
| Fase 2 — Tracking+Dashboard | 2 | 10 |
| **Total** | **4** | **28** |

---

## Próximos Passos

1. **@po (Pax)** — `*validate-story-draft` em EC-1.1
2. **@dev (Dex)** — Sprint 1: EC-1.1 (migração + backend + editor) → EC-1.2
3. **@qa (Quinn)** — QA gate por story
4. **@devops (Gage)** — push + PR após Sprint 1 done
5. **@dev (Dex)** — Sprint 2: EC-2.1 → EC-2.2
