# Story Backlog — VYD Engage

**Atualizado:** 2026-03-18
**Revisado por:** Pax (PO)

---

## Estatísticas

| Métrica | Valor |
|---------|-------|
| Total de itens | 42 |
| 🔴 HIGH | 8 |
| 🟡 MEDIUM | 19 |
| 🟢 LOW | 15 |
| 📋 TODO | 38 |
| 🚧 IN PROGRESS | 0 |
| ✅ DONE | 4 |

---

## 🔴 HIGH Priority

#### [EPIC-TD-1.1] Security Quick Fixes (CORS, Rate Limit, Webhook Auth)
- **Source**: EPIC-TD Sprint 1
- **Priority**: 🔴 HIGH
- **Effort**: 3 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 1
- **Description**: Restringir CORS origins via env var, reordenar rate limiting middleware antes de routes, proteger webhook routes com auth
- **Débitos**: SEC-01, SEC-02, TD-18

---

#### [EPIC-TD-1.2] Database Baseline & Integrity
- **Source**: EPIC-TD Sprint 1
- **Priority**: 🔴 HIGH
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 1
- **Description**: Baseline migration, 5 FKs faltantes, índices em Subscription.planId e Invitation.invitedBy, Float→Decimal
- **Débitos**: DB-19, DB-01-05, DB-16-17, DB-15

---

#### [EPIC-TD-1.3] Database Security (Encryption + RLS)
- **Source**: EPIC-TD Sprint 1
- **Priority**: 🔴 HIGH
- **Effort**: 13 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 1
- **Description**: Hash tokens sensíveis, encrypt config JSON, RLS para Lead/User/Task/Payment/Interaction
- **Débitos**: SEC-04, SEC-05

---

#### [EPIC-TD-1.4] Payment Security (Mercado Pago SDK)
- **Source**: EPIC-TD Sprint 1
- **Priority**: 🔴 HIGH
- **Effort**: 8 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 1
- **Description**: Substituir CreditCardForm por Mercado Pago CardForm com tokenização em iframe seguro
- **Débitos**: SEC-03

---

#### [EPIC-TD-1.5] Frontend Type Alignment + Error Boundaries
- **Source**: EPIC-TD Sprint 1
- **Priority**: 🔴 HIGH
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 1
- **Description**: Alinhar tipos com enums Prisma, ErrorBoundary global + por rota, RequireAuth guard
- **Débitos**: FE-35, FE-05, FE-07

---

#### [EPIC-TD-1.6] Leads Pagination (Server-Side)
- **Source**: EPIC-TD Sprint 1
- **Priority**: 🔴 HIGH
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 1
- **Description**: Paginação server-side para Leads com query params, componente frontend, loading state
- **Débitos**: PERF-01

---

#### [EPIC-TD-1.7] Responsive Layout (Mobile MVP)
- **Source**: EPIC-TD Sprint 1
- **Priority**: 🔴 HIGH
- **Effort**: 13 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 1
- **Description**: Sidebar colapsável mobile, card-view leads, dashboard responsivo, login/register mobile
- **Débitos**: RESP-01, FE-26, FE-27

---

#### [EPIC-TD-1.8] Remove Mock Features
- **Source**: EPIC-TD Sprint 1
- **Priority**: 🔴 HIGH
- **Effort**: 3 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 1
- **Description**: Remover/marcar "Em breve": Meta Lead Ads, Google Lead Form, webhook localStorage, scoring local, payment mock
- **Débitos**: FE-55

---

## 🟡 MEDIUM Priority

#### [EPIC-TD-2.1] Secure Token Storage
- **Source**: EPIC-TD Sprint 2
- **Priority**: 🟡 MEDIUM
- **Effort**: 8 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 2
- **Description**: Migrar JWT para httpOnly cookies, CSRF protection
- **Débitos**: FE-47, FE-48

---

#### [EPIC-TD-2.2] Context Refactoring
- **Source**: EPIC-TD Sprint 2
- **Priority**: 🟡 MEDIUM
- **Effort**: 8 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 2
- **Description**: Refatorar 9 providers, compor relacionados, unificar logout
- **Débitos**: ARCH-01, FE-01, FE-03, FE-06

---

#### [EPIC-TD-2.3] Route Lazy Loading
- **Source**: EPIC-TD Sprint 2
- **Priority**: 🟡 MEDIUM
- **Effort**: 3 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 2
- **Description**: React.lazy() para todas as rotas com Suspense fallback
- **Débitos**: FE-04

---

#### [EPIC-TD-2.4] Accessibility Baseline
- **Source**: EPIC-TD Sprint 2
- **Priority**: 🟡 MEDIUM
- **Effort**: 8 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 2
- **Description**: ARIA labels, skip navigation, keyboard nav, error messages acessíveis
- **Débitos**: A11Y-01, FE-20, FE-22, FE-23, FE-25

---

#### [EPIC-TD-2.5] Test Infrastructure + CI/CD
- **Source**: EPIC-TD Sprint 2
- **Priority**: 🟡 MEDIUM
- **Effort**: 8 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 2
- **Description**: Vitest backend 30% coverage, Playwright E2E básico, GitHub Actions CI
- **Débitos**: TD-05, TD-06, TD-13

---

#### [EPIC-TD-2.6] RLS Phase 2
- **Source**: EPIC-TD Sprint 2
- **Priority**: 🟡 MEDIUM
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 2
- **Description**: RLS para tabelas secundárias (Automation, WhatsApp, Email, ApiKey, Webhook)
- **Débitos**: SEC-05b

---

#### [EPIC-TD-3.1] Decompose God Components
- **Source**: EPIC-TD Sprint 3
- **Priority**: 🟡 MEDIUM
- **Effort**: 13 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 3
- **Description**: Leads.tsx → LeadTable + LeadFilters + LeadDetails + LeadScoring
- **Débitos**: FE-02

---

#### [EPIC-TD-3.2] Design Token Migration
- **Source**: EPIC-TD Sprint 3
- **Priority**: 🟡 MEDIUM
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 3
- **Description**: Migrar 100+ cores hardcoded para design tokens
- **Débitos**: FE-12, FE-16

---

#### [EPIC-TD-3.3] State Management Cleanup
- **Source**: EPIC-TD Sprint 3
- **Priority**: 🟡 MEDIUM
- **Effort**: 8 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 3
- **Description**: localStorage → API, React Query para server state, WebSocket para notificações
- **Débitos**: FE-30, FE-31, FE-32

---

#### [EPIC-TD-3.4] Type Safety Hardening
- **Source**: EPIC-TD Sprint 3
- **Priority**: 🟡 MEDIUM
- **Effort**: 8 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 3
- **Description**: Eliminar `any`, Zod schemas para API responses, tipos sincronizados com backend
- **Débitos**: FE-36, FE-37, FE-39

---

#### [EPIC-TD-3.5] Database Enums + Schema Quality
- **Source**: EPIC-TD Sprint 3
- **Priority**: 🟡 MEDIUM
- **Effort**: 3 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 3
- **Description**: Converter strings em enums Prisma (PaymentStatus, InteractionType, etc)
- **Débitos**: DB-08, DB-11, DB-12, DB-13

---

#### [EPIC-TD-3.6] Responsive Tables + A11y Enhancement
- **Source**: EPIC-TD Sprint 3
- **Priority**: 🟡 MEDIUM
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 3
- **Description**: Card-view Tasks mobile, feedback além de cor (ícones + texto)
- **Débitos**: FE-27, FE-21

---

#### [EPIC-TD-3.7] Code Quality Setup
- **Source**: EPIC-TD Sprint 3
- **Priority**: 🟡 MEDIUM
- **Effort**: 3 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 3
- **Description**: ESLint + Prettier + jsx-a11y no CI
- **Débitos**: TD-14

---

#### [RETRO-DEAL] Story Retroativa — Deal & Account Management
- **Source**: Commit fb8742c (2026-03-18)
- **Priority**: 🟡 MEDIUM
- **Effort**: Já implementado
- **Status**: 📋 TODO (documentação/validação pendente)
- **Sprint**: N/A
- **Description**: Full pipeline CRM com deals implementado sem story formal. Necessita: documentação de ACs, validação QA, testes
- **Success Criteria**:
  - [x] Implementação commitada
  - [ ] Story formal criada com ACs retroativos
  - [ ] QA gate executado

---

#### [RETRO-CALENDAR] Story Retroativa — Calendar Views para Tasks
- **Source**: Commit 517d874 (2026-03-18)
- **Priority**: 🟡 MEDIUM
- **Effort**: Já implementado
- **Status**: 📋 TODO (documentação/validação pendente)
- **Sprint**: N/A
- **Description**: Views month/week/agenda com drag-and-drop para Tasks. Implementado sem story formal. Necessita: documentação de ACs, validação QA, testes
- **Success Criteria**:
  - [x] Implementação commitada
  - [ ] Story formal criada com ACs retroativos
  - [ ] QA gate executado

---

## 🟢 LOW Priority

#### [EPIC-TD-4.1] Bundle Optimization
- **Source**: EPIC-TD Sprint 4
- **Priority**: 🟢 LOW
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 4
- **Description**: Vendor chunk splitting, debounce GlobalSearch, tree shaking
- **Débitos**: FE-40, FE-43

---

#### [EPIC-TD-4.2] Dark Mode
- **Source**: EPIC-TD Sprint 4
- **Priority**: 🟢 LOW
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 4
- **Description**: Dark mode toggle com design tokens, prefers-color-scheme
- **Débitos**: FE-13

---

#### [EPIC-TD-4.3] Loading & Empty States
- **Source**: EPIC-TD Sprint 4
- **Priority**: 🟢 LOW
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 4
- **Description**: Skeleton loading, empty states contextuais com CTA
- **Débitos**: FE-44, FE-53

---

#### [EPIC-TD-4.4] Onboarding Tour
- **Source**: EPIC-TD Sprint 4
- **Priority**: 🟢 LOW
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 4
- **Description**: Tour guiado: dashboard → leads → primeira tarefa
- **Débitos**: FE-54

---

#### [EPIC-TD-4.5] Landing Page Dynamic + Branding
- **Source**: EPIC-TD Sprint 4
- **Priority**: 🟢 LOW
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 4
- **Description**: Preços da API, cleanup FlowCRM refs, copyright dinâmico
- **Débitos**: FE-11, FE-15, FE-19

---

#### [EPIC-TD-4.6] Database Operations + Observability
- **Source**: EPIC-TD Sprint 4
- **Priority**: 🟢 LOW
- **Effort**: 5 pts
- **Status**: 📋 TODO
- **Sprint**: TD Sprint 4
- **Description**: Seed funcional, normalização Json, Sentry frontend + Web Vitals
- **Débitos**: DB-20, DB-10, QA-GAP-01

---

#### [TD-BACKLOG-01] FE-10 — Inline form validation
- **Source**: EPIC-TD Backlog contínuo
- **Priority**: 🟢 LOW
- **Effort**: 2 pts
- **Status**: 📋 TODO

#### [TD-BACKLOG-02] FE-14 — CSS-in-JS consistency
- **Source**: EPIC-TD Backlog contínuo
- **Priority**: 🟢 LOW
- **Effort**: 2 pts
- **Status**: 📋 TODO

#### [TD-BACKLOG-03] FE-18 — Form component standardization
- **Source**: EPIC-TD Backlog contínuo
- **Priority**: 🟢 LOW
- **Effort**: 2 pts
- **Status**: 📋 TODO

#### [TD-BACKLOG-04] FE-24 — Focus management
- **Source**: EPIC-TD Backlog contínuo
- **Priority**: 🟢 LOW
- **Effort**: 2 pts
- **Status**: 📋 TODO

#### [TD-BACKLOG-05] FE-38 — API error type unification
- **Source**: EPIC-TD Backlog contínuo
- **Priority**: 🟢 LOW
- **Effort**: 2 pts
- **Status**: 📋 TODO

#### [TD-BACKLOG-06] FE-42 — Image optimization
- **Source**: EPIC-TD Backlog contínuo
- **Priority**: 🟢 LOW
- **Effort**: 1 pt
- **Status**: 📋 TODO

#### [TD-BACKLOG-07] FE-45 — Optimistic updates
- **Source**: EPIC-TD Backlog contínuo
- **Priority**: 🟢 LOW
- **Effort**: 3 pts
- **Status**: 📋 TODO

#### [TD-BACKLOG-08] DB-09 — Soft delete pattern
- **Source**: EPIC-TD Backlog contínuo
- **Priority**: 🟢 LOW
- **Effort**: 3 pts
- **Status**: 📋 TODO

#### [TD-BACKLOG-09] TD-10 — API versioning
- **Source**: EPIC-TD Backlog contínuo
- **Priority**: 🟢 LOW
- **Effort**: 3 pts
- **Status**: 📋 TODO

---

## ✅ DONE (Epics Completos)

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

#### [RETRO-BUGFIX] Critical Bug Fixes (Leads, Routes, Tags, UI)
- **Completed**: 2026-03-18
- **Commit**: 2a40d1b

---

*Gerado por Pax (PO) — 2026-03-18*
