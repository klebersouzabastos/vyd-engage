# VYD Engage - Technical Debt Assessment (DRAFT)

**Tipo:** Brownfield Technical Debt Assessment
**Projeto:** VYD Engage (CRM SaaS Multi-tenant)
**Data:** 2026-02-20
**Fase:** Brownfield Discovery - Fase 4 (Consolidacao DRAFT)
**Agente:** @architect (Aria)
**Status:** DRAFT — Pendente revisoes de especialistas (Fases 5-7)

---

## Executive Summary

O VYD Engage e um CRM SaaS com fundamentos arquiteturais solidos (multi-tenancy, JWT auth, Prisma ORM, React 18 + Vite), mas apresenta **91 debitos tecnicos** identificados em 3 auditorias independentes. **7 criticos** e **43 altos** bloqueiam producao.

**Veredicto: NOT PRODUCTION-READY**

| Dimensao | Status |
|----------|--------|
| Seguranca | CRITICO — CORS aberto, tokens em localStorage, dados de cartao em state |
| Integridade de Dados | EM RISCO — 5 FKs faltantes, sem RLS, segredos em plaintext |
| Performance | FRACO — Bundle 3.3MB, sem paginacao, polling agressivo |
| Acessibilidade | NAO CONFORME — WCAG 2.1 Level A violado |
| Responsividade | QUEBRADO — Inutilizavel em mobile |
| Type Safety | FRACO — Mismatch frontend/backend, `any` generalizado |
| Testes | MINIMO — 2 testes backend, 0 frontend |

---

## Fontes de Dados

| Fase | Agente | Documento | Debitos |
|------|--------|-----------|---------|
| 1 | @architect | `docs/architecture/system-architecture.md` | 18 (TD-01 a TD-18) |
| 2 | @data-engineer | `docs/database/SCHEMA.md` + `DB-AUDIT.md` | 20 (DB-01 a DB-20) |
| 3 | @ux-design-expert | `docs/frontend/frontend-spec.md` | 54 (FE-01 a FE-55) |
| **Total** | | | **91 debitos** (1 positivo DB-18) |

---

## Inventario Consolidado

### Distribuicao por Severidade

| Severidade | Arquitetura | Database | Frontend | Total |
|------------|-------------|----------|----------|-------|
| CRITICO | 2 | 1 | 4 | **7** |
| ALTO | 8 | 10 | 25 | **43** |
| MEDIO | 7 | 6 | 21 | **34** |
| BAIXO | 1 | 2 | 4 | **7** |
| **Total** | **18** | **19** | **54** | **91** |

### Distribuicao por Area Tecnica

| Area | Critico | Alto | Medio | Baixo | Total |
|------|---------|------|-------|-------|-------|
| Seguranca | 4 | 4 | 2 | 0 | **10** |
| Arquitetura Frontend | 1 | 4 | 3 | 1 | **9** |
| Database Design | 1 | 6 | 4 | 2 | **13** |
| Performance | 0 | 5 | 5 | 1 | **11** |
| Type Safety | 0 | 3 | 2 | 0 | **5** |
| Acessibilidade | 1 | 3 | 2 | 0 | **6** |
| Responsividade | 1 | 2 | 1 | 0 | **4** |
| State Management | 0 | 3 | 2 | 0 | **5** |
| Design System | 0 | 3 | 3 | 2 | **8** |
| Code Quality/Testing | 0 | 4 | 3 | 1 | **8** |
| UX Patterns | 0 | 3 | 3 | 0 | **6** |
| DevOps/Infra | 0 | 2 | 2 | 0 | **4** |
| API Design | 0 | 1 | 1 | 0 | **2** |

---

## Debitos Criticos (7) — Production Blockers

### SEC-01 | CORS Aberto (TD-02)
**Origem:** Backend `server/src/index.ts`
**Problema:** `cors({ origin: true })` permite ANY origin em qualquer ambiente.
**Risco:** Cross-site request forgery, data theft via malicious sites.
**Fix:** `cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'] })`.

### SEC-02 | Rate Limiting Ineficaz (TD-01)
**Origem:** Backend middleware ordering
**Problema:** `apiLimiter` posicionado APOS rotas de negocio — requests ja processados quando limiter age.
**Risco:** DDoS, brute force em endpoints de negocio.
**Fix:** Reordenar middleware: rate limiting ANTES de routes.

### SEC-03 | Dados de Cartao em Component State (FE-46)
**Origem:** `src/components/payment/CreditCardForm.tsx`
**Problema:** Numero do cartao, CVV, validade em `useState`. Sem SDK de pagamento. Mensagem enganosa "nao armazenamos".
**Risco:** Violacao PCI DSS. Dados de cartao em plaintext no frontend.
**Fix:** Migrar para Mercado Pago JS SDK (CardForm) com tokenizacao em iframe seguro.

### SEC-04 | Dados Sensiveis Sem Criptografia no DB (DB-06)
**Origem:** `server/prisma/schema.prisma` — 10 campos afetados
**Problema:** `passwordResetToken`, `twoFactorSecret`, `ApiKey.key`, `Webhook.secret`, configs JSON com credenciais — tudo em plaintext.
**Risco:** Comprometimento do banco = exposicao total de segredos.
**Fix:** Hash tokens (bcrypt/argon2), encrypt configs (pgcrypto ou app-level encryption).

### ARCH-01 | Context Hell — 9 Providers (FE-01)
**Origem:** `src/App.tsx`
**Problema:** 9 React Context providers aninhados. Re-renders em cascata, debugging impossivel.
**Risco:** Performance degradada, manutenibilidade comprometida.
**Fix:** Composicao de providers, lazy loading, avaliar Zustand/Jotai para estado global.

### A11Y-01 | Sem ARIA Labels (FE-20)
**Origem:** GlobalSearch, Tasks, Settings, Leads
**Problema:** Inputs, selects, dropdowns, popovers sem ARIA labels/roles/expanded states.
**Risco:** Violacao WCAG 2.1 Level A. Aplicacao inacessivel para screen readers.
**Fix:** Auditoria sistematica com axe-core. Adicionar labels, roles, e atributos ARIA.

### RESP-01 | Layout Fixo Sem Mobile (FE-26)
**Origem:** `src/components/AppLayout.tsx`
**Problema:** Sidebar `w-64` fixa + `ml-64` no conteudo. Zero breakpoints. Zero responsividade.
**Risco:** CRM INUTILIZAVEL em mobile. Vendedores em campo nao podem usar.
**Fix:** Sidebar colapsavel, hamburger menu, breakpoints mobile-first.

---

## Temas Cross-Cutting (11 Patterns Identificados)

Os 91 debitos se agrupam em 11 temas transversais que afetam multiplas camadas:

### 1. Seguranca em Profundidade Ausente
**Debitos:** TD-01, TD-02, TD-03, DB-06, DB-07, FE-46, FE-47, FE-48, FE-49, TD-18
**Camadas:** Backend + Database + Frontend
**Pattern:** Nenhuma camada de defesa individual e robusta. Se uma falha, nao ha segunda barreira.
**Fix Strategy:** Defense-in-depth — CORS restritivo + rate limiting correto + tokens em httpOnly cookies + RLS no PostgreSQL + encryption de segredos + CSRF headers.

### 2. Mismatch de Tipos Frontend/Backend
**Debitos:** FE-35, FE-36, FE-37, FE-39, TD-08
**Pattern:** Tipos definidos manualmente no frontend divergem dos enums Prisma. `Lead.id` e `number` no frontend mas `String` no backend. `Lead.status` tem 4 valores no frontend vs 7 no backend.
**Fix Strategy:** Gerar tipos compartilhados do Prisma schema, ou definir contrato via OpenAPI/tRPC. Adicionar Zod validation nos responses.

### 3. Integridade Referencial Incompleta
**Debitos:** DB-01 a DB-05, TD-04
**Pattern:** 5 campos referenciam User/Automation sem FK constraint. Dados orfaos possiveis.
**Fix Strategy:** Uma migration adicionando FKs com `onDelete: SetNull`.

### 4. Cobertura de Testes Minima
**Debitos:** TD-05, TD-06
**Pattern:** 2 testes backend (auth + leads), 0 testes frontend. Nenhum CI/CD.
**Fix Strategy:** Vitest backend com coverage target 60%, Playwright/Cypress E2E para fluxos criticos, GitHub Actions CI.

### 5. State Management Caotico
**Debitos:** FE-01, FE-30, FE-31, FE-32, FE-33
**Pattern:** 9 contexts aninhados, localStorage como "banco de dados", polling agressivo (1s WhatsApp), 40+ useState em Settings.
**Fix Strategy:** React Query para server state, Zustand para client state, WebSocket para real-time.

### 6. Dados Mock vs Dados Reais
**Debitos:** FE-30, FE-31, FE-55
**Pattern:** PlanContext simula dados, integracoes Meta/Google sao fake, lead scoring nao persiste, webhook config em localStorage.
**Fix Strategy:** Auditoria de features reais vs mock. Features mock devem ser removidas ou marcadas "Coming Soon".

### 7. Performance e Bundle
**Debitos:** FE-40, FE-04, FE-41, FE-32, FE-42, FE-43, FE-34, DB-10, DB-16
**Pattern:** Bundle 3.3MB monolitico, sem code-splitting, sem paginacao, polling agressivo, sem cache.
**Fix Strategy:** Code-splitting via React.lazy, paginacao server-side, React Query cache, debounce, indices DB.

### 8. Acessibilidade Sistematica
**Debitos:** FE-20, FE-21, FE-22, FE-23, FE-24, FE-25
**Pattern:** Nenhum aspecto de WCAG 2.1 Level A atendido consistentemente.
**Fix Strategy:** ESLint plugin jsx-a11y, axe-core audits, keyboard testing manual.

### 9. Responsividade
**Debitos:** FE-26, FE-27, FE-28, FE-29
**Pattern:** Layout desktop-only. Breakpoints definidos mas nao usados. Tabelas nao responsivas.
**Fix Strategy:** Mobile-first redesign do layout, card-view para tabelas em mobile.

### 10. Design System Inconsistente
**Debitos:** FE-11, FE-12, FE-13, FE-14, FE-15, FE-16, FE-18, FE-19
**Pattern:** Tokens definidos mas nao usados, cores hardcoded, naming legado "FlowCRM", dark mode incompleto.
**Fix Strategy:** Migrar cores para tokens CSS, implementar dark mode, cleanup FlowCRM refs.

### 11. Migrations e Schema Governance
**Debitos:** DB-08, DB-09, DB-10, DB-11, DB-12, DB-13, DB-14, DB-15, DB-19, DB-20
**Pattern:** 1 migration manual, strings ao inves de enums, Float para money, Json excessivo.
**Fix Strategy:** Baseline migration, converter strings em enums, Decimal para valores monetarios.

---

## Roadmap de Remediacao Proposto

### Sprint 1: Production Blockers (Semanas 1-3)

| ID | Fix | Esforco | Dependencia |
|----|-----|---------|-------------|
| SEC-01 | Restringir CORS origins | 2h | Nenhuma |
| SEC-02 | Reordenar rate limiting middleware | 2h | Nenhuma |
| SEC-03 | Migrar para Mercado Pago SDK | 3d | Documentacao MP |
| SEC-04 | Hash/encrypt dados sensiveis | 1w | Baseline migration |
| DB-19 | Criar baseline migration | 4h | Nenhuma |
| DB-01-05 | Adicionar FKs faltantes | 4h | DB-19 |
| DB-16-17 | Adicionar indices faltantes | 2h | DB-19 |
| FE-35 | Alinhar tipos frontend/backend | 1d | Nenhuma |
| FE-05 | Adicionar Error Boundaries | 4h | Nenhuma |
| FE-07 | Route Guards (RequireAuth) | 4h | Nenhuma |

### Sprint 2: Fundacao (Semanas 4-7)

| ID | Fix | Esforco | Dependencia |
|----|-----|---------|-------------|
| FE-47 | Migrar tokens para httpOnly cookies | 3d | Backend change |
| ARCH-01 | Refatorar Context providers | 1w | Nenhuma |
| RESP-01 | Layout responsivo + sidebar mobile | 1w | Nenhuma |
| FE-04 | Lazy loading de rotas | 1d | Nenhuma |
| FE-41 | Paginacao server-side (Leads) | 2d | Backend pagination API |
| TD-05-06 | Setup test infrastructure | 3d | Nenhuma |
| A11Y-01 | ARIA labels sistematicos | 3d | Nenhuma |
| DB-07 | Avaliar/implementar RLS | 1w | Expertise PostgreSQL |

### Sprint 3: Qualidade (Semanas 8-12)

| ID | Fix | Esforco | Dependencia |
|----|-----|---------|-------------|
| FE-02 | Decompor Leads.tsx + Settings.tsx | 1w | Nenhuma |
| FE-12 | Migrar cores hardcoded para tokens | 3d | Nenhuma |
| FE-30-31 | Migrar localStorage para API | 1w | Backend endpoints |
| FE-36-37 | Eliminar `any`, adicionar Zod | 1w | FE-35 |
| FE-16 | Padronizar feedback (Toast + AlertDialog) | 2d | Nenhuma |
| FE-32 | WebSocket/SSE para notificacoes | 3d | Backend WebSocket |
| DB-08,11-13 | Converter strings em enums | 1d | DB-19 |
| FE-27 | Tabelas responsivas | 3d | RESP-01 |
| TD-13 | Setup CI/CD (GitHub Actions) | 2d | Nenhuma |

### Sprint 4: Polish (Semanas 13-18)

| ID | Fix | Esforco | Dependencia |
|----|-----|---------|-------------|
| FE-40 | Bundle optimization (code splitting) | 2d | FE-04 |
| FE-13 | Dark mode | 3d | FE-12 |
| FE-55 | Remover/marcar features mock | 2d | Product decision |
| FE-54 | Onboarding tour | 3d | Layout estavel |
| FE-11 | Cleanup FlowCRM references | 2h | Nenhuma |
| DB-15 | Migrar Float para Decimal | 4h | DB-19 |
| FE-44 | Skeleton loading | 2d | Nenhuma |
| FE-43 | Debounce no GlobalSearch | 2h | Nenhuma |

---

## Estimativa de Esforco Total

| Sprint | Foco | Duracao | Debitos Resolvidos |
|--------|------|---------|--------------------|
| Sprint 1 | Production Blockers | 3 semanas | 15 (7 criticos + 8 altos) |
| Sprint 2 | Fundacao | 4 semanas | 12 (altos + medios) |
| Sprint 3 | Qualidade | 5 semanas | 18 (altos + medios) |
| Sprint 4 | Polish | 6 semanas | 15 (medios + baixos) |
| **Total** | | **18 semanas** | **60 de 91** |

**Nota:** 31 debitos de severidade media/baixa ficam como backlog continuo (cosmetic, naming, minor optimizations).

---

## Decisoes Arquiteturais Pendentes

Estas decisoes precisam de input do stakeholder antes da implementacao:

| # | Decisao | Opcoes | Impacto |
|---|---------|--------|---------|
| 1 | Strategy de autenticacao | httpOnly cookies vs localStorage + XSS mitigation | Afeta SEC-03, FE-47, FE-48 |
| 2 | State management library | Manter Context vs Zustand vs Jotai vs React Query | Afeta ARCH-01, FE-30-34 |
| 3 | Mobile como requisito de lancamento? | P0 (blocker) vs P1 (post-launch) | Afeta RESP-01, FE-27-28 |
| 4 | Dark mode no roadmap? | Sim (Sprint 4) vs Nao (backlog) | Afeta FE-12, FE-13 |
| 5 | Features mock: remover ou manter? | Remover vs "Coming Soon" badge | Afeta FE-55 |
| 6 | Tenant isolation strategy | RLS PostgreSQL vs application-only | Afeta DB-07 |
| 7 | Shared types strategy | tRPC vs OpenAPI vs manual sync | Afeta FE-35, FE-39 |

---

## Notas para Revisores

### Para @data-engineer (Fase 5)
- Validar priorizacao de DB-01 a DB-20
- Confirmar se baseline migration (DB-19) e pre-requisito correto
- Avaliar esforco real de RLS (DB-07) — complexidade pode estar subestimada
- Decidir sobre Interaction: append-only intencional ou updatedAt esquecido? (DB-09)

### Para @ux-design-expert (Fase 6)
- Validar priorizacao de FE-01 a FE-55
- Confirmar se mobile (FE-26) deve ser Sprint 2 ou Sprint 1
- Avaliar se dark mode (FE-13) afeta Sprint 1 (tokens)
- Input sobre strategy de acessibilidade: incremental ou audit completo?

### Para @qa (Fase 7)
- Verificar completude: todos os debitos cobertos?
- Validar severidades: algum debito super/sub-estimado?
- Confirmar que dependencias entre sprints estao corretas
- Gap analysis: algo que nenhuma auditoria cobriu?

---

## Change Log

| Data | Versao | Descricao | Autor |
|------|--------|-----------|-------|
| 2026-02-20 | 0.1-DRAFT | Consolidacao inicial dos 3 relatorios de auditoria | @architect (Aria) |

---

*— Aria, arquitetando o futuro*
