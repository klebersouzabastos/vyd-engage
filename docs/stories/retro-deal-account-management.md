# Story Retroativa: Deal & Account Management — Full Pipeline CRM

**Story ID:** RETRO-DEAL
**Tipo:** Feature (Retroativa)
**Prioridade:** P1
**Origem:** Commit fb8742c — 2026-03-18
**Status:** Done (pendente validação QA)
**Pontos:** 8
**Agente:** @po (Pax) — documentação retroativa

---

## Descrição

Feature completa de gerenciamento de Deals (negócios/oportunidades) transformando o VYD Engage de gestor de leads para CRM completo com pipeline de vendas, valores monetários, probabilidades e visualização Kanban.

---

## Acceptance Criteria (Retroativos)

### Backend
- [x] Model `Deal` no Prisma: id, tenantId, name, value (Decimal), stage (enum), probability, expectedCloseDate, closedAt, leadId, assignedTo, notes, customFields, lostReason
- [x] Enum `DealStage`: QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSING, WON, LOST
- [x] `server/src/routes/deals.ts`: GET /api/deals (filtros, paginação), GET /api/deals/stats, GET /api/deals/:id, POST, PUT, DELETE
- [x] `server/src/services/dealService.ts`: CRUD, auto-probability por stage, auto-closedAt em WON/LOST
- [x] Deal-Interaction bidirecional (interactionService atualizado)
- [x] Multi-tenant scoped (tenantId em todas as queries)

### Frontend
- [x] `src/pages/Deals.tsx`: lista com search, filtro por stage, toggle List/Pipeline, paginação, CRUD dialogs
- [x] `src/pages/DealDetail.tsx`: layout 70/30, timeline de atividades, sidebar com dados, add note
- [x] `src/components/deals/DealPipelineBoard.tsx`: Kanban com 4 stages ativos + WON/LOST summary, drag-and-drop HTML5
- [x] `src/components/deals/DealForm.tsx`: modal create/edit com todos os campos
- [x] `src/components/deals/DealCard.tsx`: card Kanban com nome, valor, lead, probability
- [x] `src/components/deals/DealStageBadge.tsx`: indicador de cor por stage
- [x] `src/components/deals/DealAnalytics.tsx`: widget de dashboard
- [x] `src/hooks/useDeals.ts`: fetchDeals, createDeal, updateDeal, deleteDeal com toast
- [x] API client: getDeals, getDeal, createDeal, updateDeal, deleteDeal, getDealInteractions, createInteraction (com dealId)
- [x] Types: Deal, DealStage, DealStats em `src/types/index.ts`
- [x] Rota `/app/deals` e `/app/deals/:id` em routes.tsx
- [x] Link "Deals" no Sidebar
- [x] Integração Lead↔Deal: criar deal a partir de LeadDetail, auto-sync status WON para lead

### QA Pendente
- [ ] Testes: criar deal → mover por pipeline via drag-and-drop → marcar WON → verificar closedAt e probability
- [ ] Testes: filtrar deals por stage → verificar resultados corretos
- [ ] Testes: excluir deal → verificar que interações não são perdidas
- [ ] Testes: criar deal a partir de lead → verificar relação bidirecional

---

## Arquivos Modificados

**Backend (5 files):**
- `server/prisma/schema.prisma` — Model Deal + DealStage enum
- `server/src/routes/deals.ts` — 6 endpoints
- `server/src/services/dealService.ts` — Business logic
- `server/src/services/interactionService.ts` — Suporte a Deal interactions
- `server/src/index.ts` — Registro de rotas

**Frontend (16 files):**
- `src/pages/Deals.tsx`, `src/pages/DealDetail.tsx`
- `src/components/deals/` — 5 componentes
- `src/hooks/useDeals.ts`
- `src/services/api/client.ts`
- `src/types/index.ts`
- `src/utils/routes.tsx`
- `src/components/Sidebar.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/LeadDetail.tsx`

---

## Riscos Identificados

| Risco | Probabilidade | Impacto | Status |
|-------|--------------|---------|--------|
| Deal values sem validação de range | Média | Baixo | A validar |
| Drag-and-drop pode falhar em mobile | Média | Médio | A validar |
| N+1 em listagem de deals com relations | Baixa | Médio | A validar |

---

*Documentado retroativamente por Pax (PO) — 2026-03-18*
