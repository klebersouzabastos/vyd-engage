# VYD Engage - UX Specialist Review

**Tipo:** Peer Review do DRAFT de Technical Debt Assessment
**Revisor:** @ux-design-expert (Uma)
**Data:** 2026-02-20
**Fase:** Brownfield Discovery - Fase 6 (UX Specialist Review)
**Documento Revisado:** `docs/prd/technical-debt-DRAFT.md` — secao Frontend/UX (FE-01 a FE-55)

---

## Review Summary

| Aspecto | Veredicto |
|---------|-----------|
| Completude dos debitos FE | APROVADO — 54 debitos cobertos |
| Severidades corretas | APROVADO com 3 ajustes |
| Priorizacao no roadmap | PARCIALMENTE APROVADO — mobile deve ser Sprint 1 |
| Coerencia com DB/Arch audits | APROVADO — cross-cutting themes corretos |
| Esforco estimado | PARCIALMENTE — 2 subestimados |

**Veredicto Geral:** APROVADO COM OBSERVACOES

---

## Validacao de Severidades

### Ajustes Recomendados

| ID | Severidade DRAFT | Severidade Revisada | Justificativa |
|----|-----------------|---------------------|---------------|
| FE-26 | CRITICO | CRITICO | Confirmado — CRM mobile e essencial para vendedores |
| FE-41 | ALTO | **CRITICO** | **UPGRADE:** Sem paginacao, a pagina de Leads (tela principal do CRM) trava com >500 leads. E a funcionalidade core do produto. |
| FE-55 | MEDIO | **ALTO** | **UPGRADE:** Features mock que aparentam funcionar sao enganosas. Usuarios vao tentar usar Meta Lead Ads, webhook config, e lead scoring — e nada funciona. Isso destroi confianca no produto. |
| FE-15 | MEDIO | **ALTO** | **UPGRADE:** Precos hardcoded na landing (R$97/197/497) divergem do backend. Se os precos mudarem no backend, a landing mostra valores errados. Para um SaaS, pricing incorreto e grave. |

### Severidades Confirmadas (amostra)

| ID | Severidade | Confirmacao |
|----|-----------|-------------|
| FE-01 | CRITICO | Correto — 9 providers e insustentavel |
| FE-20 | CRITICO | Correto — WCAG Level A violation |
| FE-46 | CRITICO | Correto — PCI violation |
| FE-02 | ALTO | Correto — god components bloqueiam manutenibilidade |
| FE-12 | ALTO | Correto — sem tokens, dark mode impossivel |
| FE-47 | ALTO | Correto — XSS → token theft |
| FE-30 | ALTO | Correto — PlanContext com dados mock |
| FE-31 | ALTO | Correto — localStorage nao sincroniza |

---

## Priorizacao — Ajustes Recomendados

### Mobile DEVE ser Sprint 1

**Argumento:** VYD Engage e um CRM para equipes de vendas. Vendedores trabalham em campo, no celular. Um CRM que nao funciona em mobile e como um carro sem rodas — o produto core nao entrega valor.

**Proposta:** Mover RESP-01 (FE-26) de Sprint 2 para Sprint 1, junto com:
- FE-26: Layout responsivo basico (sidebar colapsavel)
- FE-27: Card-view para Leads em mobile (ao inves de tabela)

Isso adiciona ~1 semana ao Sprint 1 mas e requisito para lancamento.

### Sprint 1 Revisado (UX Perspective)

| Prioridade | ID | Fix | Justificativa |
|------------|-----|-----|---------------|
| P0 | FE-46 | Mercado Pago SDK | PCI violation |
| P0 | FE-26 | Layout responsivo | CRM mobile essencial |
| P0 | FE-41 | Paginacao de Leads | Tela core trava |
| P1 | FE-05 | Error Boundaries | App crash prevention |
| P1 | FE-20 | ARIA labels | WCAG compliance |
| P1 | FE-07 | Route Guards | Acesso nao autorizado |
| P1 | FE-55 | Remover/marcar mocks | Confianca do usuario |
| P1 | FE-35 | Alinhar tipos | Dados incorretos |

---

## Esforcos Subestimados

### FE-26 (Layout Responsivo) — Estimativa Original: 1 semana
**Revisao:** 2 semanas.
**Detalhe:**
- Sidebar colapsavel com animacao: 2d
- Hamburger menu + overlay: 1d
- Ajustar TODAS as paginas para breakpoints: 3d
- Card-view para tabelas de Leads/Tasks em mobile: 2d
- Testar em multiplos devices: 1d

### FE-02 (Decomposicao de God Components) — Estimativa Original: 1 semana
**Revisao:** 2-3 semanas.
**Detalhe:**
- Leads.tsx (1275 linhas) → 6-8 sub-componentes: 3d
- Settings.tsx (1500+ linhas) → 8-10 sub-componentes: 4d
- Tasks.tsx (554 linhas) → 4-5 sub-componentes: 2d
- Testar regressoes em cada decomposicao: 2d
- Risco: logica de estado espalhada entre sub-componentes requer refactoring cuidadoso

---

## Debitos NAO Cobertos (Gap Analysis)

| Gap | Descricao | Severidade Sugerida |
|-----|-----------|---------------------|
| FE-NEW-01 | **Sem internacionalizacao (i18n)** — toda UI em portugues hardcoded. Se VYD expandir para outros paises, rewrite necessario. | MEDIO |
| FE-NEW-02 | **Sem analytics/tracking** — nenhum evento de analytics (page views, clicks, conversions). Impossivel medir uso real. | MEDIO |
| FE-NEW-03 | **Sem service worker / PWA** — CRM mobile sem offline capability. Vendedores em areas com sinal fraco perdem acesso. | MEDIO |
| FE-NEW-04 | **Sem print styles** — nenhum `@media print`. Relatorios e propostas nao imprimem corretamente. | BAIXO |
| FE-NEW-05 | **Sem favicon ou meta tags SEO** — landing page sem og:image, twitter:card, favicon personalizado. | BAIXO |

---

## Pontos Positivos a Preservar

Importante nao perder o que funciona bem durante a remediacao:

1. **Register.tsx** — Multi-step form com Zod validation e acessibilidade excelente. Usar como referencia para outros forms.
2. **PasswordStrengthIndicator** — Acessibilidade ARIA impecavel. Usar como template para componentes interativos.
3. **shadcn/ui (54 primitivos)** — Biblioteca rica ja instalada. Muitos debitos se resolvem USANDO o que ja existe (AlertDialog, Skeleton, Tabs, Popover).
4. **Toaster (sonner)** — Ja integrado. Padronizar como feedback system.
5. **EmptyState component** — Bem projetado. Expandir uso para todas as paginas.
6. **Tailwind CSS v4** — Configuracao CSS-based moderna. Foundation solida para design tokens.

---

## Recomendacao para Decisoes Pendentes

### Mobile como requisito de lancamento?
**Recomendacao UX:** **SIM, P0.** Um CRM sem mobile e um produto incompleto. Nao precisa ser nativo — responsivo e suficiente para MVP.

### Dark mode no roadmap?
**Recomendacao UX:** **Sim, Sprint 3-4.** Prerequisito: resolver FE-12 (design tokens) primeiro. Dark mode e expectativa de mercado para SaaS B2B modernos, mas nao blocker para lancamento.

### Features mock — remover ou manter?
**Recomendacao UX:** **Remover da UI OU adicionar badge "Em breve".** Feature que aparenta funcionar mas nao funciona e pior que feature ausente — destroi confianca.

### Strategy de acessibilidade — incremental ou audit completo?
**Recomendacao UX:** **Incremental com baseline.** Rodar axe-core uma vez para baseline, depois corrigir incrementalmente por pagina. Priorizar: Login → Register → Dashboard → Leads → Settings.

---

## Conclusao

O DRAFT captura com profundidade os debitos frontend. Os ajustes principais sao:

1. **FE-41 (Paginacao):** ALTO → CRITICO (tela core do CRM)
2. **FE-55 (Mocks):** MEDIO → ALTO (confianca do produto)
3. **FE-15 (Landing hardcoded):** MEDIO → ALTO (pricing inconsistente)
4. **Mobile em Sprint 1** — nao Sprint 2

5 novos gaps identificados (FE-NEW-01 a FE-NEW-05).

**Contagem revisada frontend:**
- Frontend: 54 debitos existentes + 5 novos = **59 debitos**
- Criticos: 4 → **5** (+ FE-41)
- Total geral projeto: 95 (pos DB review) → **100 debitos**

---

*— Uma, desenhando experiencias*
