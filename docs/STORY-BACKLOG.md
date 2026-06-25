# Story Backlog — VYD Engage

**Atualizado:** 2026-06-23
**Revisado por:** Pax (PO)

---

## Estatísticas

| Métrica | Valor |
|---------|-------|
| Total de itens | 68 |
| 🔴 HIGH | 0 |
| 🟡 MEDIUM | 0 |
| 🟢 LOW | 0 |
| 📋 TODO | 16 |
| 🚧 IN PROGRESS | 0 |
| ✅ DONE | 52 |

---

## 📋 PLANNED (Growth Roadmap — 4 Épicos)

> PRD mestre: [docs/prd/prd-growth-roadmap.md](prd/prd-growth-roadmap.md)

---

### [EPIC-IMPORT-PRO] Import Pro — Migração de Dados
**Status:** Planejado | **Prioridade:** P0 | **Pontos:** 21  
**Épico:** [docs/stories/epic-import-pro.md](stories/epic-import-pro.md) | **PRD:** [docs/prd/prd-import-pro.md](prd/prd-import-pro.md)

| Story | Título | Pts | Sprint | Status |
|-------|--------|-----|--------|--------|
| [IMP-1.1](stories/imp-1.1-csv-upload-mapping.md) | Upload CSV/Excel com Mapeamento de Campos | 8 | 1 | Draft |
| [IMP-1.2](stories/imp-1.2-dedup-preview.md) | Deduplicação e Preview antes de Importar | 5 | 1 | Draft |
| [IMP-2.1](stories/imp-2.1-deals-interactions-import.md) | Importação de Deals e Histórico de Interações | 5 | 2 | Draft |
| [IMP-2.2](stories/imp-2.2-import-history-rollback.md) | Histórico e Rollback de Importações | 3 | 2 | Draft |

---

### [EPIC-AI-SALES] AI Sales Assistant
**Status:** Planejado | **Prioridade:** P0 | **Pontos:** 26  
**Épico:** [docs/stories/epic-ai-sales-assistant.md](stories/epic-ai-sales-assistant.md) | **PRD:** [docs/prd/prd-ai-sales-assistant.md](prd/prd-ai-sales-assistant.md)

| Story | Título | Pts | Sprint | Status |
|-------|--------|-----|--------|--------|
| [AI-1.1](stories/ai-1.1-lead-summary.md) | Resumo Contextual do Lead (IA) | 5 | 1 | Draft |
| [AI-1.2](stories/ai-1.2-next-action-suggestion.md) | Sugestão de Próxima Ação com Justificativa | 5 | 1 | Draft |
| [AI-2.1](stories/ai-2.1-deal-closing-score.md) | Score de Propensão de Fechamento por Deal | 8 | 2 | Draft |
| [AI-2.2](stories/ai-2.2-contextual-chat.md) | Chat Contextual no Lead | 8 | 2 | Draft |

---

### [EPIC-EMAIL-CAMPAIGNS] Email Campaigns
**Status:** Planejado | **Prioridade:** P1 | **Pontos:** 28  
**Épico:** [docs/stories/epic-email-campaigns.md](stories/epic-email-campaigns.md) | **PRD:** [docs/prd/prd-email-campaigns.md](prd/prd-email-campaigns.md)

| Story | Título | Pts | Sprint | Status |
|-------|--------|-----|--------|--------|
| [EC-1.1](stories/ec-1.1-campaign-editor.md) | Criação de Campanha com Editor de Blocos | 13 | 1 | Draft |
| [EC-1.2](stories/ec-1.2-segmentation-scheduling.md) | Segmentação de Audiência e Agendamento | 5 | 1 | Draft |
| [EC-2.1](stories/ec-2.1-click-open-tracking.md) | Tracking de Abertura e Clique por Campanha | 5 | 2 | Draft |
| [EC-2.2](stories/ec-2.2-campaign-dashboard.md) | Dashboard de Resultados de Campanha | 5 | 2 | Draft |

---

### [EPIC-API-HUB] API Hub — Integrações e API Pública
**Status:** Planejado | **Prioridade:** P1 | **Pontos:** 31  
**Épico:** [docs/stories/epic-api-hub.md](stories/epic-api-hub.md) | **PRD:** [docs/prd/prd-api-hub.md](prd/prd-api-hub.md)

| Story | Título | Pts | Sprint | Status |
|-------|--------|-----|--------|--------|
| [API-1.1](stories/api-1.1-swagger-docs.md) | Documentação Interativa da API (Swagger/Redoc) | 5 | 1 | Draft |
| [API-1.2](stories/api-1.2-outgoing-webhooks.md) | Webhooks de Saída Configuráveis por Evento | 8 | 1 | Draft |
| [API-2.1](stories/api-2.1-api-key-scopes.md) | Scopes e Permissões por API Key | 5 | 2 | Draft |
| [API-2.2](stories/api-2.2-zapier-app.md) | Zapier App Nativo | 13 | 2 | Draft |

---

## Resumo Growth Roadmap

| Épico | Stories | Pontos | Sequência |
|-------|---------|--------|-----------|
| Import Pro | 4 | 21 | 1º — Desbloqueador de adoção |
| AI Sales | 4 | 26 | 2º — Diferenciador competitivo |
| Email Campaigns | 4 | 28 | 3º — Retenção e MRR |
| API Hub | 4 | 31 | 4º — Ecossistema de integrações |
| **Total** | **16** | **106** | **~7-9 sprints** |

---

## 🟢 Backlog Cleared — Previous Epics Done

---

## ✅ DONE (Epics Completos)

#### [EPIC-TD] Technical Debt Remediation
- **Completed**: 2026-03-18
- **Stories**: 27/27 done (170 pts)
- **Sprints**: 4 (Sprint 1-4)

##### Sprint 1: Production Blockers
- [EPIC-TD-1.1] Security Quick Fixes — ✅ DONE (2026-03-18)
- [EPIC-TD-1.2] Database Baseline & Integrity — ✅ DONE (2026-03-18)
- [EPIC-TD-1.3] Database Security (Encryption + RLS) — ✅ DONE (2026-03-18)
- [EPIC-TD-1.4] Payment Security (Mercado Pago SDK) — ✅ DONE (2026-03-18)
- [EPIC-TD-1.5] Frontend Type Alignment + Error Boundaries — ✅ DONE (2026-03-18)
- [EPIC-TD-1.6] Leads Pagination (Server-Side) — ✅ DONE (2026-03-18)
- [EPIC-TD-1.7] Responsive Layout (Mobile MVP) — ✅ DONE (2026-03-18)
- [EPIC-TD-1.8] Remove Mock Features — ✅ DONE (2026-03-18)

##### Sprint 2: Fundação
- [EPIC-TD-2.1] Secure Token Storage — ✅ DONE (2026-03-18)
- [EPIC-TD-2.2] Context Refactoring — ✅ DONE (2026-03-18)
- [EPIC-TD-2.3] Route Lazy Loading — ✅ DONE (2026-03-18)
- [EPIC-TD-2.4] Accessibility Baseline — ✅ DONE (2026-03-18)
- [EPIC-TD-2.5] Test Infrastructure + CI/CD — ✅ DONE (2026-03-18)
- [EPIC-TD-2.6] RLS Phase 2 — ✅ DONE (2026-03-18)

##### Sprint 3: Qualidade
- [EPIC-TD-3.1] Decompose God Components — ✅ DONE (2026-03-18)
- [EPIC-TD-3.2] Design Token Migration — ✅ DONE (2026-03-18)
- [EPIC-TD-3.3] State Management Cleanup — ✅ DONE (2026-03-18)
- [EPIC-TD-3.4] Type Safety Hardening — ✅ DONE (2026-03-18)
- [EPIC-TD-3.5] Database Enums + Schema Quality — ✅ DONE (2026-03-18)
- [EPIC-TD-3.6] Responsive Tables + A11y Enhancement — ✅ DONE (2026-03-18)
- [EPIC-TD-3.7] Code Quality Setup — ✅ DONE (2026-03-18)

##### Sprint 4: Polish
- [EPIC-TD-4.1] Bundle Optimization — ✅ DONE (2026-03-18)
- [EPIC-TD-4.2] Dark Mode — ✅ DONE (2026-03-18)
- [EPIC-TD-4.3] Loading & Empty States — ✅ DONE (2026-03-18)
- [EPIC-TD-4.4] Onboarding Tour — ✅ DONE (2026-03-18)
- [EPIC-TD-4.5] Landing Page Dynamic + Branding — ✅ DONE (2026-03-18)
- [EPIC-TD-4.6] Database Operations + Observability — ✅ DONE (2026-03-18)

---

#### [EPIC-CRMPF] CRM Power Features
- **Completed**: 2026-03-18
- **Stories**: 6/6 done (29 pts)
- **Commits**: fbc21fe (Sprint 1), 13e8de3 (Sprint 2)

#### [EPIC-RTNAL] Real-Time Notifications + Automation Logs
- **Completed**: 2026-03-18
- **Stories**: 7/7 done (28 pts)
- **Commits**: d8bf607, d0a7573, 93e0934, 4d5b3cf, 2b23d77, 4482ccb

#### [RETRO-SIDEBAR] Collapsible Sidebar
- **Completed**: 2026-03-18
- **Commit**: 087ca00

#### [RETRO-DEAL] Deal & Account Management — Full Pipeline CRM
- **Completed**: 2026-03-18
- **Commit**: fb8742c
- **QA Verdict**: PASS (Quinn, 2026-03-18)

#### [RETRO-CALENDAR] Advanced Calendar Views for Tasks
- **Completed**: 2026-03-18
- **Commit**: 517d874
- **QA Verdict**: PASS (Quinn, 2026-03-18)

#### [RETRO-BUGFIX] Critical Bug Fixes (Leads, Routes, Tags, UI)
- **Completed**: 2026-03-18
- **Commit**: 2a40d1b

#### [EPIC-INTELLIGENCE] AI Intelligence — Revenue Forecast, Funnel Analytics, AI Assistant & Email Generation
- **Completed**: 2026-03-20 (closed by Pax)
- **Stories**: 4/4 done (~23 pts)
- **Commit**: a7e12bc

#### [EPIC-ENTITY] Company Entity + Contact Separation + Multi-Pipeline
- **Completed**: 2026-03-20 (closed by Pax)
- **Stories**: 3/3 done (~21 pts)
- **Commits**: 77374e5, d37c2c8

#### [EPIC-CONNECT] Integration Hub — Google Calendar, Zapier Webhooks, CSV/XLSX Export
- **Completed**: 2026-03-20 (closed by Pax)
- **Stories**: 3/3 done (~11 pts)
- **Commits**: 77374e5, d37c2c8

#### [TD-BACKLOG] Tech Debt Backlog Cleanup — 9 Items (20 pts)
- **Completed**: 2026-03-21 (closed by Pax)
- **Items**: 9/9 done (20 pts)
- **Details**:
  - FE-10: Inline form validation (Zod schemas + useFormValidation hook) — ✅
  - FE-14: CSS-in-JS consistency (VYDEcosystemBanner cleanup, Tailwind-only) — ✅
  - FE-18: Form component standardization (formSchemas.ts + FieldError pattern) — ✅
  - FE-24: Focus management (useAutoFocus + useFocusReturn hooks) — ✅
  - FE-38: API error type unification (ApiError.code + normalizeError + helpers) — ✅
  - FE-42: Image optimization (loading=lazy + decoding=async on all imgs) — ✅
  - FE-45: Optimistic updates (useLeads + useTasks with rollback) — ✅
  - DB-09: Soft delete pattern (deletedAt on Lead/Deal/Task/Company + services) — ✅
  - TD-10: API versioning (/api/v1/ prefix + X-API-Version header) — ✅

---

*Atualizado por Pax (PO) — 2026-03-21*
