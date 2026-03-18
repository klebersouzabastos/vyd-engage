# Story Retroativa: Deal & Account Management — Full Pipeline CRM

**Story ID:** RETRO-DEAL
**Tipo:** Feature (Retroativa)
**Prioridade:** P1
**Origem:** Commit fb8742c — 2026-03-18
**Status:** Done
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

### QA Validado
- [x] Testes: criar deal → mover por pipeline via drag-and-drop → marcar WON → verificar closedAt e probability
- [x] Testes: filtrar deals por stage → verificar resultados corretos
- [x] Testes: excluir deal → verificar que interações não são perdidas
- [x] Testes: criar deal a partir de lead → verificar relação bidirecional

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

## QA Closing Notes

**Reviewer:** Quinn (QA) — 2026-03-18
**Verdict:** PASS

All CONCERNS from initial QA review (qa-retro-deal.md, 3.3/5) have been addressed:

1. **Cross-tenant isolation** — `update()` and `delete()` in dealService.ts now verify tenantId via `findFirst()` before mutating. FIXED.
2. **getStats() DB aggregation** — Rewritten to use `count()`, `groupBy()`, `aggregate()` at DB level. No full table loads. FIXED.
3. **formatCurrency shared utility** — `src/utils/format.ts` exports shared `formatCurrency()` using `Intl.NumberFormat("pt-BR")`. FIXED.
4. **D&D error toast** — `DealPipelineBoard.tsx` handleDrop wraps onStageChange in try/catch with `toast.error()`. FIXED.
5. **Leads search debounce** — `DealForm.tsx` uses 300ms debounce via `useRef` timer on lead search input. FIXED.

All acceptance criteria met. Story closed.

---

*Documentado retroativamente por Pax (PO) — 2026-03-18*
*QA validado por Quinn (QA) — 2026-03-18*
