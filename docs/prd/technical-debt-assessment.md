# VYD Engage - Technical Debt Assessment (FINAL)

**Tipo:** Brownfield Technical Debt Assessment — Versao Final
**Projeto:** VYD Engage (CRM SaaS Multi-tenant)
**Data:** 2026-02-20
**Fase:** Brownfield Discovery - Fase 8 (Assessment Final)
**Agente:** @architect (Aria)
**QA Gate:** APPROVED (Fase 7)
**Revisoes Incorporadas:** @data-engineer (Fase 5) + @ux-design-expert (Fase 6)

---

## Executive Summary

O VYD Engage e um CRM SaaS multi-tenant construido com React 18 + TypeScript + Vite (frontend), Node.js + Express + Prisma (backend), e PostgreSQL 16 (database). Possui fundamentos arquiteturais solidos mas apresenta **101 debitos tecnicos** que impedem o lancamento em producao.

### Contagem Final

| Severidade | Qtd | % |
|------------|-----|---|
| CRITICO | 9 | 9% |
| ALTO | 43 | 43% |
| MEDIO | 38 | 37% |
| BAIXO | 11 | 11% |
| **Total** | **101** | 100% |

### Distribuicao por Camada

| Camada | Debitos | Criticos |
|--------|---------|----------|
| Arquitetura/Backend | 18 | 2 |
| Database | 23 | 2 |
| Frontend/UX | 59 | 5 |
| QA (cross-cutting) | 1 | 0 |
| **Total** | **101** | **9** |

### Veredicto

**NOT PRODUCTION-READY** — 9 debitos criticos + 43 altos bloqueiam lancamento.

| Dimensao | Status | Debitos Criticos |
|----------|--------|------------------|
| Seguranca | CRITICO | CORS aberto, tokens XSS-vulneraveis, dados cartao em state, DB secrets plaintext |
| Database | EM RISCO | 5 FKs faltantes, sem RLS, migracao ad-hoc |
| Performance | FRACO | Bundle 3.3MB, sem paginacao, polling 1s |
| Acessibilidade | NAO CONFORME | WCAG 2.1 Level A violado |
| Responsividade | QUEBRADO | Inutilizavel em mobile |
| Type Safety | FRACO | Mismatch frontend/backend, `any` generalizado |
| Testes | MINIMO | 2 backend, 0 frontend |

---

## 9 Debitos Criticos (Production Blockers)

### SEC-01 | CORS Aberto | Backend
**ID Original:** TD-02
**Arquivo:** `server/src/index.ts`
**Problema:** `cors({ origin: true })` permite qualquer origin.
**Fix:** Configurar origins permitidos via env var.
**Esforco:** 2 horas.

### SEC-02 | Rate Limiting Ineficaz | Backend
**ID Original:** TD-01
**Arquivo:** Middleware ordering em `server/src/index.ts`
**Problema:** `apiLimiter` posicionado apos rotas — requests ja processados.
**Fix:** Reordenar middleware: limiter antes de routes.
**Esforco:** 2 horas.

### SEC-03 | Dados de Cartao em Component State | Frontend
**ID Original:** FE-46
**Arquivo:** `src/components/payment/CreditCardForm.tsx`
**Problema:** Numero, CVV, validade em `useState`. Sem SDK. PCI DSS violation.
**Fix:** Mercado Pago JS SDK com tokenizacao.
**Esforco:** 3 dias.

### SEC-04 | Dados Sensiveis Sem Criptografia | Database
**ID Original:** DB-06
**Arquivo:** `server/prisma/schema.prisma` (10 campos)
**Problema:** Tokens, secrets, configs com credenciais em plaintext.
**Fix:** Hash tokens, encrypt configs.
**Esforco:** 1-2 semanas.

### SEC-05 | Sem Row Level Security | Database
**ID Original:** DB-07 (promovido de ALTO por @data-engineer)
**Problema:** Isolamento de tenants depende 100% de middleware. Um bug = cross-tenant breach.
**Fix:** RLS policies no PostgreSQL para tabelas criticas.
**Esforco:** 2-3 semanas (faseado).

### ARCH-01 | Context Hell — 9 Providers | Frontend
**ID Original:** FE-01
**Arquivo:** `src/App.tsx`
**Problema:** 9 Context Providers aninhados. Re-renders cascata.
**Fix:** Composicao de providers, lazy loading, avaliar Zustand.
**Esforco:** 1 semana.

### A11Y-01 | Sem ARIA Labels | Frontend
**ID Original:** FE-20
**Arquivos:** GlobalSearch, Tasks, Settings, Leads
**Problema:** Componentes interativos sem ARIA. WCAG 2.1 Level A violado.
**Fix:** Auditoria com axe-core + correcoes sistematicas.
**Esforco:** 3 dias.

### RESP-01 | Layout Fixo Sem Mobile | Frontend
**ID Original:** FE-26
**Arquivo:** `src/components/AppLayout.tsx`
**Problema:** Sidebar w-64 fixa. Zero responsividade. CRM inutilizavel em mobile.
**Fix:** Sidebar colapsavel, hamburger menu, mobile-first.
**Esforco:** 2 semanas.

### PERF-01 | Sem Paginacao de Leads | Frontend
**ID Original:** FE-41 (promovido de ALTO por @ux-design-expert)
**Arquivo:** `src/pages/Leads.tsx`
**Problema:** Busca TODOS os leads sem paginacao. Tela core do CRM trava com >500 leads.
**Fix:** Server-side pagination.
**Esforco:** 2 dias (frontend) + 1 dia (backend API).

---

## 11 Temas Cross-Cutting

### 1. Seguranca em Profundidade Ausente
**Debitos:** TD-01, TD-02, TD-03, TD-18, DB-06, DB-07, FE-46, FE-47, FE-48, FE-49
**Total:** 10 debitos | **Camadas:** Todas
**Pattern:** Nenhuma camada de defesa e robusta. Sem defesa-em-profundidade.
**Remediation:** Defense-in-depth — CORS + rate limit + httpOnly cookies + RLS + encryption + CSRF.

### 2. Mismatch de Tipos Frontend/Backend
**Debitos:** FE-35, FE-36, FE-37, FE-39, TD-08
**Total:** 5 debitos | **Camadas:** Frontend + Backend
**Pattern:** Lead.id e `number` no frontend mas `String` no backend. Lead.status tem 4 valores vs 7.
**Remediation:** Tipos compartilhados via gerador Prisma ou contrato OpenAPI.

### 3. Integridade Referencial Incompleta
**Debitos:** DB-01 a DB-05, TD-04
**Total:** 6 debitos | **Camada:** Database
**Pattern:** 5 campos sem FK constraint. Dados orfaos possiveis.
**Remediation:** Uma migration adicionando FKs com onDelete: SetNull.

### 4. Cobertura de Testes Minima
**Debitos:** TD-05, TD-06
**Total:** 2 debitos | **Camadas:** Backend + Frontend
**Pattern:** 2 testes backend, 0 frontend. Nenhum CI/CD.
**Remediation:** Vitest backend 60% coverage, Cypress E2E, GitHub Actions.

### 5. State Management Caotico
**Debitos:** FE-01, FE-30, FE-31, FE-32, FE-33
**Total:** 5 debitos | **Camada:** Frontend
**Pattern:** 9 contexts, localStorage como DB, polling 1s, 40+ useState.
**Remediation:** React Query (server state), Zustand (client state), WebSocket (real-time).

### 6. Dados Mock vs Reais
**Debitos:** FE-30, FE-31, FE-55
**Total:** 3 debitos | **Camada:** Frontend
**Pattern:** Features aparentam funcionar mas usam dados falsos. Confianca comprometida.
**Remediation:** Remover mocks ou marcar "Em breve". Conectar ao backend.

### 7. Performance e Bundle
**Debitos:** FE-40, FE-04, FE-41, FE-32, FE-42, FE-43, FE-34, DB-10, DB-16
**Total:** 9 debitos | **Camadas:** Frontend + Database
**Pattern:** Bundle 3.3MB, sem code-splitting, sem paginacao, sem cache.
**Remediation:** React.lazy, server pagination, React Query, debounce, indices.

### 8. Acessibilidade Sistematica
**Debitos:** FE-20, FE-21, FE-22, FE-23, FE-24, FE-25
**Total:** 6 debitos | **Camada:** Frontend
**Pattern:** WCAG 2.1 Level A violado sistematicamente.
**Remediation:** axe-core baseline, jsx-a11y ESLint, correcoes incrementais.

### 9. Responsividade
**Debitos:** FE-26, FE-27, FE-28, FE-29
**Total:** 4 debitos | **Camada:** Frontend
**Pattern:** Desktop-only. Breakpoints definidos mas nao usados.
**Remediation:** Mobile-first redesign, card-view para tabelas em mobile.

### 10. Design System Inconsistente
**Debitos:** FE-11, FE-12, FE-13, FE-14, FE-15, FE-16, FE-18, FE-19
**Total:** 8 debitos | **Camada:** Frontend
**Pattern:** Tokens definidos mas nao usados, cores hardcoded, naming legado.
**Remediation:** Migrar para tokens, cleanup FlowCRM, padronizar feedback.

### 11. Migrations e Schema Governance
**Debitos:** DB-08, DB-09, DB-10, DB-11, DB-12, DB-13, DB-14, DB-15, DB-19, DB-20
**Total:** 10 debitos | **Camada:** Database
**Pattern:** 1 migration manual, strings vs enums, Float para money, Json excessivo.
**Remediation:** Baseline migration, enums, Decimal, avaliacao caso-a-caso de Json.

---

## Roadmap de Remediacao (Revisado)

### Sprint 1: Production Blockers (Semanas 1-5)

**Foco:** Seguranca + Database foundation + Mobile + Paginacao

| # | ID | Fix | Esforco | Dep |
|---|-----|-----|---------|-----|
| 1 | SEC-01 | Restringir CORS | 2h | - |
| 2 | SEC-02 | Reordenar rate limiting | 2h | - |
| 3 | DB-19 | Baseline migration | 4h | - |
| 4 | DB-01-05 | Adicionar 5 FKs | 4h | DB-19 |
| 5 | DB-16-17 | Adicionar indices | 2h | DB-19 |
| 6 | DB-15 | Float → Decimal | 4h | DB-19 |
| 7 | SEC-04 | Hash/encrypt secrets | 1-2w | DB-19 |
| 8 | SEC-05 | RLS basico (Lead,User,Task,Payment) | 1w | DB-19 |
| 9 | SEC-03 | Mercado Pago SDK | 3d | - |
| 10 | FE-35 | Alinhar tipos frontend/backend | 1d | - |
| 11 | FE-05 | Error Boundaries | 4h | - |
| 12 | FE-07 | Route Guards | 4h | - |
| 13 | PERF-01 | Paginacao de Leads | 3d | Backend API |
| 14 | RESP-01 | Layout responsivo basico | 2w | - |
| 15 | FE-55 | Remover/marcar features mock | 2d | Product decision |

**Sprint 1 Output:** App seguro, mobile-functional, Leads paginado, DB com FKs e indices.

### Sprint 2: Fundacao (Semanas 6-10)

| # | ID | Fix | Esforco | Dep |
|---|-----|-----|---------|-----|
| 1 | FE-47 | Tokens → httpOnly cookies | 3d | Backend |
| 2 | ARCH-01 | Refatorar Context providers | 1w | - |
| 3 | FE-04 | Lazy loading de rotas | 1d | - |
| 4 | A11Y-01 | ARIA labels sistematicos | 3d | - |
| 5 | FE-23 | Skip navigation | 2h | - |
| 6 | FE-22 | Keyboard navigation | 2d | - |
| 7 | TD-05-06 | Setup test infrastructure | 3d | - |
| 8 | TD-13 | CI/CD (GitHub Actions) | 2d | - |
| 9 | SEC-05b | RLS restante (tabelas secundarias) | 1w | SEC-05 |
| 10 | FE-03 | Unificar logout em AuthContext | 2h | - |
| 11 | FE-06 | Substituir window.location.href | 2h | - |

**Sprint 2 Output:** Auth seguro, contexts limpos, testes basicos, CI/CD, acessibilidade basica.

### Sprint 3: Qualidade (Semanas 11-16)

| # | ID | Fix | Esforco | Dep |
|---|-----|-----|---------|-----|
| 1 | FE-02 | Decompor god components | 2-3w | - |
| 2 | FE-12 | Migrar cores para design tokens | 3d | - |
| 3 | FE-30-31 | Migrar localStorage para API | 1w | Backend |
| 4 | FE-36-37 | Eliminar `any`, adicionar Zod | 1w | FE-35 |
| 5 | FE-16 | Padronizar feedback (Toast + AlertDialog) | 2d | - |
| 6 | FE-32 | WebSocket/SSE para real-time | 3d | Backend |
| 7 | DB-08,11-13 | Converter strings em enums | 1d | DB-19 |
| 8 | FE-27 | Tabelas responsivas (card-view mobile) | 3d | RESP-01 |
| 9 | FE-21 | Feedback alem de cor (icones + texto) | 2d | - |
| 10 | TD-14 | Setup ESLint + Prettier | 1d | - |

**Sprint 3 Output:** Componentes limpos, design tokens, types seguros, real-time.

### Sprint 4: Polish (Semanas 17-22)

| # | ID | Fix | Esforco | Dep |
|---|-----|-----|---------|-----|
| 1 | FE-40 | Bundle optimization | 2d | FE-04 |
| 2 | FE-13 | Dark mode | 3d | FE-12 |
| 3 | FE-44 | Skeleton loading | 2d | - |
| 4 | FE-43 | Debounce GlobalSearch | 2h | - |
| 5 | FE-54 | Onboarding tour | 3d | Layout estavel |
| 6 | FE-11 | Cleanup FlowCRM refs | 2h | - |
| 7 | FE-15 | Landing page dinamica | 2d | Backend/CMS |
| 8 | FE-50-51 | AlertDialog + fix "Lembrar" | 1d | - |
| 9 | DB-10 | Avaliar normalizacao Json | 3d | Caso a caso |
| 10 | DB-20 | Seed data funcional | 1d | - |
| 11 | QA-GAP-01 | Sentry frontend + Web Vitals | 1d | - |

**Sprint 4 Output:** UX polida, dark mode, performance otimizada, onboarding.

---

## Estimativa de Esforco Total

| Sprint | Foco | Duracao | Debitos |
|--------|------|---------|---------|
| Sprint 1 | Production Blockers | 5 semanas | ~20 |
| Sprint 2 | Fundacao | 5 semanas | ~15 |
| Sprint 3 | Qualidade | 6 semanas | ~18 |
| Sprint 4 | Polish | 6 semanas | ~17 |
| **Total** | | **22 semanas** | **~70 de 101** |

**Backlog continuo:** 31 debitos baixa/media severidade tratados incrementalmente.

---

## 7 Decisoes Arquiteturais Pendentes

| # | Decisao | Opcoes | Recomendacao |
|---|---------|--------|-------------|
| 1 | Autenticacao | httpOnly cookies vs localStorage + mitigacao | **httpOnly cookies** — elimina classe inteira de XSS |
| 2 | State management | Context refatorado vs Zustand vs Jotai | **React Query (server) + Zustand (client)** |
| 3 | Mobile como P0? | P0 (Sprint 1) vs P1 (Sprint 2) | **P0** — CRM sem mobile nao entrega valor |
| 4 | Dark mode | Sim (Sprint 4) vs backlog | **Sprint 4** — expectativa de mercado |
| 5 | Features mock | Remover vs "Em breve" | **Remover** — feature falsa destroi confianca |
| 6 | Tenant isolation | RLS PostgreSQL vs app-only | **RLS** — defesa-em-profundidade |
| 7 | Shared types | tRPC vs OpenAPI vs manual | **OpenAPI ou Prisma generator** — type safety end-to-end |

---

## Pontos Positivos a Preservar

1. **Multi-tenancy via middleware** — padrao solido, precisa de RLS como backup
2. **Register.tsx** — referencia para forms acessiveis com Zod validation
3. **shadcn/ui (54 primitivos)** — muitos debitos se resolvem USANDO o que ja existe
4. **Indices compostos DB** — bem projetados para access patterns do CRM
5. **Tailwind CSS v4** — foundation moderna para design tokens
6. **API client com token refresh** — boa base, precisa de Zod validation
7. **Prisma ORM** — type-safe queries, migracao gerenciada

---

## Fontes e Rastreabilidade

| Fase | Agente | Documento | Debitos |
|------|--------|-----------|---------|
| 1 | @architect | `docs/architecture/system-architecture.md` | TD-01 a TD-18 (18) |
| 2 | @data-engineer | `docs/database/SCHEMA.md` + `DB-AUDIT.md` | DB-01 a DB-20 (20) |
| 3 | @ux-design-expert | `docs/frontend/frontend-spec.md` | FE-01 a FE-55 (54) |
| 4 | @architect | `docs/prd/technical-debt-DRAFT.md` | Consolidacao (91) |
| 5 | @data-engineer | `docs/reviews/db-specialist-review.md` | +4 gaps, 3 ajustes (23 DB) |
| 6 | @ux-design-expert | `docs/reviews/ux-specialist-review.md` | +5 gaps, 3 ajustes (59 FE) |
| 7 | @qa | `docs/reviews/qa-review.md` | +1 gap, APPROVED (101) |
| 8 | @architect | **Este documento** | Final assessment |

---

## Change Log

| Data | Versao | Descricao | Autor |
|------|--------|-----------|-------|
| 2026-02-20 | 0.1-DRAFT | Consolidacao inicial (91 debitos) | @architect |
| 2026-02-20 | 0.2-REVIEWED | Incorporados ajustes DB + UX (+9 novos, 6 reclassificacoes) | @architect |
| 2026-02-20 | 1.0-FINAL | QA APPROVED. Assessment finalizado (101 debitos) | @architect |

---

*— Aria, arquitetando o futuro*
