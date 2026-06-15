# PRD — Aceleração via Ferramentas Open-Source

**Versão:** 1.0
**Data:** 2026-06-15
**Autor:** Claude Code (scout multi-agente + síntese)
**Status:** Draft → pronto para implementação
**Origem:** Scout OSS de 71 ferramentas verificadas em 12 domínios contra o stack do VYD Engage

---

## 1. Goals & Background Context

### Goals

1. **Eliminar implementações hand-rolled frágeis** — substituir DnD HTML5 cru, editor de fluxo próprio, cache/fetch manual e templates de e-mail em string por bibliotecas maduras, mantidas e acessíveis (a11y).
2. **Aumentar a velocidade de desenvolvimento** — scaffolding dos 28 route modules, factories de teste, geração de Zod a partir do Prisma e OpenAPI a partir do Zod.
3. **Fechar lacunas de plataforma** — observabilidade estruturada, dashboard de filas, product analytics + feature flags, e camada de IA Claude-first.
4. **Não regredir** — toda adoção é incremental, com verificação (build + testes), licença permissiva e compatível com React 18 / Express 4 / Prisma 5 / Node 20 ESM.
5. **Reduzir risco operacional** — redaction de segredos em logs, isolamento por tenant em analytics, jobs observáveis.

### Background Context

O VYD Engage é um CRM SaaS multi-tenant em produção (Railway + Vercel). O core funcional está implementado, mas várias subsistemas críticos foram construídos à mão e hoje são gargalos de manutenção, UX e qualidade. Um scout multi-agente verificou ferramentas open-source candidatas, filtrando rigorosamente por **licença permissiva**, **manutenção ativa (2026)** e **compatibilidade com o stack atual**. Este PRD organiza a adoção em **3 ondas** ordenadas por risco/dependência.

### Lacunas-alvo (confirmadas no código)

| # | Lacuna | Evidência |
|---|--------|-----------|
| G1 | Kanban com DnD HTML5 cru (sem touch/a11y) | `src/pages/Pipeline.tsx:144` |
| G2 | Editor de fluxo de automação próprio | `src/components/automations/BuilderCanvas.tsx`, `src/utils/automationFlowConverter.ts` |
| G3 | Sem cache/estado de dados no front (apiClient manual) | `src/services/api/client.ts`, `src/hooks/use*.ts` |
| G4 | Zod escrito à mão espelhando models Prisma | `server/src/routes/*.ts` |
| G5 | IA via wrapper OpenAI cru + regex de parsing | `server/src/services/aiDraftService.ts`, `nextActionService.ts` |
| G6 | WhatsApp via fetch cru com Graph API v18 hardcoded | `server/src/services/whatsappMessagingService.ts` |
| G7 | Templates de e-mail em string concatenada | `server/src/services/emailTemplates.ts` |
| G8 | Filas BullMQ sem dashboard | `server/src/jobs/automationEngine.ts`, `billing.ts`, `emailCampaign.ts` |
| G9 | 28 routers repetindo o mesmo boilerplate; sem OpenAPI/SDK | `server/src/routes/*.ts` |
| G10 | Sem product analytics nem feature flags | — |
| G11 | Logger caseiro + morgan; sem logging estruturado | `server/src/utils/logger.ts` |
| G12 | Baixa cobertura de testes dos ~35 services e fluxos React | `server/src/__tests__/` |

### Changelog

| Data | Versão | Mudança |
|------|--------|---------|
| 2026-06-15 | 1.0 | PRD inicial a partir do scout OSS multi-agente |

---

## 2. Requirements

### Functional Requirements

| ID | Requisito | Onda | Gap |
|----|-----------|------|-----|
| FR-01 | Logging estruturado (JSON em prod, pretty em dev) substituindo logger caseiro e morgan, preservando a API `info/warn/error/debug` dos services | 1 | G11 |
| FR-02 | Redaction obrigatória de `Authorization`, JWT, refresh tokens e tokens Mercado Pago em todos os logs | 1 | G11 |
| FR-03 | Dashboard de filas BullMQ acessível só por role `admin`, atrás de auth + tenant middleware | 1 | G8 |
| FR-04 | Infra de testes unitários dos services com mock do Prisma (`mockDeep`) | 1 | G12 |
| FR-05 | Infra de testes HTTP dos routers (supertest) cobrindo CSRF whitelist e dual-prefix `/api`+`/api/v1` | 1 | G12 |
| FR-06 | Factories tipadas (fishery) + dados fake locale pt_BR (faker) para testes e seed | 1 | G12 |
| FR-07 | Mock de rede (MSW) para testes de componentes React | 1 | G12 |
| FR-08 | Gerador de scaffold (Plop) para novos route+service+test, com injeção automática do registro CSRF | 1 | G9 |
| FR-09 | ERD Mermaid versionado gerado do schema Prisma | 1 | — |
| FR-10 | Pipeline Kanban com DnD acessível (teclado + touch) e atualização otimista | 2 | G1 |
| FR-11 | Camada de data-fetching com cache, invalidação e mutations otimistas, migrando os hooks `use*` incrementalmente | 2 | G3 |
| FR-12 | Tabelas de Leads/Deals/Companies com sort/filter/seleção via lib headless | 2 | G3 |
| FR-13 | Editor visual de automações com minimap/controls/auto-layout, preservando o `automationFlowConverter` | 2 | G2 |
| FR-14 | Filtros/sort/paginação refletidos na URL (compatível com Saved Views) | 2 | G3 |
| FR-15 | Camada de IA com structured output (Zod) eliminando o parsing por regex, Claude-first com fallback | 3 | G5 |
| FR-16 | Templates de e-mail como componentes tipados (.tsx) renderizados para HTML | 3 | G7 |
| FR-17 | Cliente WhatsApp via SDK oficial da Cloud API (sem versão Graph hardcoded) | 3 | G6 |
| FR-18 | Product analytics + feature flags com isolamento por tenant | 3 | G10 |
| FR-19 | Spec OpenAPI gerada a partir dos Zod das rotas (API pública + API keys) + tipos no front | 3 | G9 |
| FR-20 | Zod gerado a partir do schema Prisma, com regras de negócio (`refine`) por cima | 3 | G4 |

### Non-Functional Requirements

| ID | Requisito |
|----|-----------|
| NFR-01 | **Licença**: toda dependência embarcada deve ser MIT/Apache-2.0/BSD/ISC. AGPL/GPL/SSPL/fair-code só como ferramenta self-hosted separada, nunca npm dep. |
| NFR-02 | **Compatibilidade**: React 18.3, Express 4, Prisma 5.7, Node 20 ESM, TypeScript 5, Vite 6. Versões que exijam Node 22 / React 19 / Next são bloqueadas ou pinadas. |
| NFR-03 | **Incremental**: nenhuma onda é big-bang. Cada item é adotável e reversível isoladamente; o build e os testes devem passar a cada commit atômico. |
| NFR-04 | **Pins explícitos**: ver matriz §3. Versões fora do pin são proibidas (quebras conhecidas de Node floor / peer deps). |
| NFR-05 | **Sem regressão funcional**: pré-commit roda `cd server && npx vitest run && npm run build` e `npm run build` na raiz. |
| NFR-06 | **Segurança**: nenhum segredo em log; dashboards com PII atrás de role admin; analytics isolado por tenant. |

---

## 3. Matriz de Ferramentas Verificadas (pins obrigatórios)

| Ferramenta | Pacote npm | Pin | Licença | Motivo do pin |
|---|---|---|---|---|
| pino / pino-http | `pino` `pino-http` `pino-pretty` | latest | MIT | — |
| bull-board | `@bull-board/express` `@bull-board/api` `@bull-board/ui` | `6.14.2` | MIT | Express 4 limpo (v7/8 trazem Express 5 bundled) |
| vitest-mock-extended (back) | `vitest-mock-extended` | `1.3.2` | MIT | v4 exige vitest ≥4 (backend é 1.x) |
| supertest | `supertest` `@types/supertest` | latest | MIT | — |
| faker / fishery | `@faker-js/faker` `fishery` | latest | MIT | faker exige Node ≥20.19 |
| msw | `msw` | latest | MIT | — |
| plop | `plop` | latest | MIT | ESM nativo |
| prisma-erd-generator | `prisma-erd-generator` | latest | MIT | usar output Mermaid (evita Puppeteer) |
| dnd-kit | `@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/modifiers` | `6.3.1`/`10.0.0`/`9.0.0` | MIT | não usar v2 (`@dnd-kit/react` pre-1.0) |
| react-query | `@tanstack/react-query` `@tanstack/react-query-devtools` | `^5` | MIT | — |
| react-table | `@tanstack/react-table` | `^8.21.3` | MIT | v9 é beta |
| react-flow | `@xyflow/react` | `^12` | MIT | — |
| dagre | `@dagrejs/dagre` | `3.0.0` | MIT | `dagre` sem escopo está morto |
| react-virtual / nuqs | `@tanstack/react-virtual` `nuqs` | `^3` / `^2.8` | MIT | — |
| Vercel AI SDK | `ai` `@ai-sdk/anthropic` `@ai-sdk/openai` | `^6` | Apache-2.0 | v7 beta exige Node 22 |
| anthropic sdk (alt) | `@anthropic-ai/sdk` | latest | MIT | escolher ESTE OU AI SDK |
| react-email | `@react-email/components` `@react-email/render` | latest | MIT | mesma empresa do Resend |
| whatsapp-api-js | `whatsapp-api-js` | `^6` | MIT | bus-factor 1 (mantenedor único) |
| posthog | `@posthog/react` `posthog-node` | latest | MIT | posthog-node exige Node 20.20+ |
| zod-to-openapi | `@asteasolutions/zod-to-openapi` | `7.3.4` | MIT | 8.x exige zod 4 |
| openapi-typescript | `openapi-typescript` `openapi-fetch` | latest | MIT | — |
| zod-prisma-types | `zod-prisma-types` | latest | MIT | suporta Prisma 5 (≠ prisma-zod-generator) |

**Bloqueados (não adotar):** Claude Agent SDK (licença comercial), OriginUI (AGPL), Evolution API (Apache modificada + risco ban), prisma-zod-generator (sem Prisma 5), Mastra (Node 22), LlamaIndex.TS (arquivado), Hygen (morto), n8n/Tremor npm (fair-code / parado).

---

## 4. Épicos & Stories

### EPIC-OSS-1 — Onda 1: DX + Qualidade (baixo atrito)

> Itens aditivos e de baixo risco. Sem refactor de UX. Destrava regressão e produtividade.

#### Story 1.1 | Logging estruturado com pino + redaction
**Pontos:** 3 | **Dep:** nenhuma | **FR:** FR-01, FR-02
**AC:**
- [ ] `pino` + `pino-http` instalados; `pino-pretty` só em dev.
- [ ] `server/src/utils/logger.ts` passa a expor uma instância pino mantendo `info/warn/error/debug` (zero mudança nos services).
- [ ] `pino-http` substitui `morgan` em `server/src/index.ts`; `morgan` removido das deps.
- [ ] Redaction configurada para `req.headers.authorization`, cookies de refresh, e tokens Mercado Pago.
- [ ] Em prod emite JSON; em dev usa pino-pretty.
- [ ] `npm run build` (server) passa; logs aparecem no Railway.

#### Story 1.2 | Dashboard de filas (@bull-board)
**Pontos:** 2 | **Dep:** nenhuma | **FR:** FR-03
**AC:**
- [ ] `@bull-board/express@6.14.2` + api + ui instalados.
- [ ] `BullMQAdapter` por fila (automation, automationDLQ, billing, emailCampaign).
- [ ] Router montado em `/admin/queues` atrás de `authMiddleware` + `tenantMiddleware` + role `admin`.
- [ ] Só ativo quando `ENABLE_AUTOMATION_ENGINE`/`ENABLE_BILLING_JOBS` + Redis presentes (degrada sem crash).

#### Story 1.3 | Infra de testes backend (mock Prisma + supertest + factories)
**Pontos:** 5 | **Dep:** nenhuma | **FR:** FR-04, FR-05, FR-06
**AC:**
- [ ] `vitest-mock-extended@1.3.2` mocka `prisma` de `config/database.ts` (`mockDeep`).
- [ ] `supertest` testa pelo menos: login, capture público, um router autenticado (CSRF + tenant).
- [ ] `index.ts` ajustado para não chamar `listen()` ao ser importado em teste (guard).
- [ ] `@faker-js/faker` (pt_BR) + `fishery` com factories de Lead/Deal/Task/Tenant/User.
- [ ] `npx vitest run` verde no backend.

#### Story 1.4 | Infra de testes frontend (MSW)
**Pontos:** 3 | **Dep:** nenhuma | **FR:** FR-07
**AC:**
- [ ] `msw` instalado; `setupServer` no setup do Vitest.
- [ ] Handlers no formato de resposta do backend (`{status,data}`/`{status,error}`).
- [ ] Pelo menos 1 teste de página (ex: Leads) usando handlers.

#### Story 1.5 | Scaffolding com Plop
**Pontos:** 3 | **Dep:** nenhuma | **FR:** FR-08
**AC:**
- [ ] `plop` (devDep) + `plopfile.mjs`.
- [ ] Gerador `crud-resource` emite `routes/<x>.ts` + `services/<x>Service.ts` + `__tests__/<x>.test.ts` seguindo o padrão de middleware.
- [ ] Append action registra `v1Router.use('/<x>', csrfProtection)` no `index.ts`.

#### Story 1.6 | ERD automático
**Pontos:** 1 | **Dep:** nenhuma | **FR:** FR-09
**AC:**
- [ ] `prisma-erd-generator` no `schema.prisma` com output Mermaid.
- [ ] `docs/database/ERD.md` gerado e commitado; roda no `prisma generate`.

---

### EPIC-OSS-2 — Onda 2: UX + Arquitetura de Dados do Front (transformadora)

> Ordem rígida: react-query antes de react-table/nuqs/virtual; react-flow antes de dagre.

#### Story 2.1 | TanStack Query como espinha dorsal de dados
**Pontos:** 8 | **Dep:** nenhuma | **FR:** FR-11
**AC:**
- [ ] `@tanstack/react-query` v5 + `QueryClientProvider` no root; devtools só em dev.
- [ ] `apiClient` vira `queryFn`; transporte/auth/refresh-token intactos.
- [ ] Migrados incrementalmente: `useLeads`, `useDeals`, `useDealsPipeline`, `useCompanies`, `useTasks`, `useDashboard`.
- [ ] Mutations com invalidação; build verde.

#### Story 2.2 | Pipeline Kanban com @dnd-kit
**Pontos:** 5 | **Dep:** 2.1 (mutation otimista) | **FR:** FR-10
**AC:**
- [ ] `@dnd-kit` (pins) substitui handlers HTML5 em `Pipeline.tsx`.
- [ ] `DndContext` + colunas `useDroppable` + cards `useSortable`; reorder de colunas suportado.
- [ ] `onDragEnd` chama `moveLead`/`reorderColumns` com update otimista (react-query).
- [ ] DnD por teclado (Space/setas/Esc) funciona; touch funciona.

#### Story 2.3 | Tabelas com @tanstack/react-table
**Pontos:** 5 | **Dep:** 2.1 | **FR:** FR-12
**AC:**
- [ ] `@tanstack/react-table@^8` (pin) renderizado via `components/ui/table.tsx`.
- [ ] Leads/Deals/Companies com sort/filter/seleção via table state (remove `useState` espalhado).
- [ ] Datasets grandes usam `manualPagination`/`manualSorting` (filtro no servidor).

#### Story 2.4 | Automation Builder com React Flow
**Pontos:** 8 | **Dep:** nenhuma | **FR:** FR-13
**AC:**
- [ ] `@xyflow/react` substitui `BuilderCanvas`/`NodePalette`.
- [ ] `nodeTypes` = trigger/action/condition (componentes existentes reaproveitados).
- [ ] `automationFlowConverter` (flowToAutomation/automationToFlow) preservado; só posições passam a vir do RF.
- [ ] `@dagrejs/dagre` para botão "auto-organizar".
- [ ] minimap + controls + DnD do palette via `screenToFlowPosition`.

#### Story 2.5 | URL state + virtualização
**Pontos:** 3 | **Dep:** 2.1, 2.3 | **FR:** FR-14
**AC:**
- [ ] `nuqs` (adapter react-router) reflete filtros/sort/page na URL; casa com Saved Views.
- [ ] `@tanstack/react-virtual` aplicado apenas onde houver volume comprovado.

---

### EPIC-OSS-3 — Onda 3: Plataforma

#### Story 3.1 | Camada de IA Claude-first (Vercel AI SDK)
**Pontos:** 5 | **Dep:** nenhuma | **FR:** FR-15
**AC:**
- [ ] `ai@^6` + `@ai-sdk/anthropic` (+ `@ai-sdk/openai` p/ fallback) instalados (pin v6).
- [ ] `aiDraftService`/`nextActionService` usam `generateObject({schema})` — regex `jsonMatch` removido.
- [ ] zod do projeto bumpado p/ `^3.25` (peer do AI SDK); Claude como provider default.

#### Story 3.2 | Templates de e-mail com react-email
**Pontos:** 5 | **Dep:** nenhuma | **FR:** FR-16
**AC:**
- [ ] `@react-email/components` + `render` instalados.
- [ ] 4 `TemplateType` (initial_outreach, follow_up, proposal, thank_you) viram componentes `.tsx`.
- [ ] `render(<Template/>)` alimenta Resend/Nodemailer; preview server disponível em dev.

#### Story 3.3 | WhatsApp via SDK oficial
**Pontos:** 5 | **Dep:** nenhuma | **FR:** FR-17
**AC:**
- [ ] `whatsapp-api-js@^6` substitui `callMetaAPI` e o switch manual de payload.
- [ ] Webhook handler da lib (com verificação de assinatura) substitui o parsing manual.
- [ ] Credenciais por tenant descriptografadas; versão Graph configurável (não hardcoded).

#### Story 3.4 | Analytics + Feature Flags (PostHog)
**Pontos:** 5 | **Dep:** nenhuma | **FR:** FR-18
**AC:**
- [ ] `@posthog/react` (front) + `posthog-node` (back); Railway em Node 20.20+.
- [ ] `groups`/`distinct_id` setados por tenant no `tenantMiddleware`; `identify` a partir do AuthContext.
- [ ] PostHog Cloud (sem self-host); flags usadas em pelo menos 1 feature.

#### Story 3.5 | OpenAPI + tipos de cliente
**Pontos:** 5 | **Dep:** nenhuma | **FR:** FR-19
**AC:**
- [ ] `@asteasolutions/zod-to-openapi@7.3.4` registra endpoints da API pública + API keys → `/api/v1/openapi.json`.
- [ ] `openapi-typescript` gera tipos consumidos pelo front.

#### Story 3.6 | Zod gerado do Prisma
**Pontos:** 3 | **Dep:** nenhuma | **FR:** FR-20
**AC:**
- [ ] `zod-prisma-types` gera schemas base; zod bumpado p/ `^3.25`.
- [ ] Piloto em 1-2 rotas; regras de negócio (`refine`) mantidas por cima.

---

## 5. Sequenciamento & Dependências

```
Onda 1 (paralela, independente):  1.1  1.2  1.3  1.4  1.5  1.6
Onda 2 (ordem rígida):            2.1 → 2.2
                                  2.1 → 2.3 → 2.5
                                  2.4 → (dagre dentro de 2.4)
Onda 3 (paralela, independente):  3.1  3.2  3.3  3.4  3.5  3.6
                                  (3.1 e 3.6 compartilham bump de zod ^3.25)
```

**Regra de ouro:** `react-query (2.1)` é pré-requisito de 2.2/2.3/2.5. `react-flow (2.4)` antes de `dagre`.

---

## 6. Riscos & Mitigações

| Risco | Mitigação |
|---|---|
| Quebra de versão (Node floor / peer deps) | Pins da matriz §3; CI valida build + testes |
| Vazamento de segredo em log (pino-http loga req) | Redaction obrigatória (FR-02), bloqueante na 1.1 |
| Cross-contaminação de analytics entre tenants | `groups` por tenant no tenantMiddleware (FR-18) |
| Refactor de react-query big-bang | Migração hook-a-hook, build verde a cada passo |
| `whatsapp-api-js` bus-factor 1 | Manter `callMetaAPI` como fallback até validar em prod |
| Bump de zod afetar schemas existentes | Bump único `^3.25` testado antes de 3.1/3.6 |
| DnD nativo em testes E2E | Migrar Pipeline p/ dnd-kit antes do Playwright |

---

## 7. Estratégia de Rollout & Verificação

- **Branch:** `feat/oss-acceleration` (uma branch por onda, ou stories atômicas).
- **Commits atômicos:** 1 story = 1+ commits focados, conventional commits.
- **Verificação por commit:** `cd server && npx vitest run && npm run build` + `npm run build` (raiz).
- **Feature flags:** itens de plataforma (PostHog, AI SDK) atrás de env já existentes onde possível.
- **Reversibilidade:** cada adoção isolada; nenhuma remove código funcional sem substituto verde.

## 8. Out of Scope

- Substituir auth (JWT+2FA já sólido) — apenas autorização fina fica para um scout RBAC futuro (CASL/Casbin), não verificado neste scout.
- Migrar de Express/Prisma/Postgres.
- Adotar plataformas self-hosted (n8n, trigger.dev, Chatwoot) como dependência.
- Substituir recharts/exceljs/pdfkit (adequados).

## 9. Lacuna conhecida

A categoria **RBAC/autorização** não foi verificada (timeout no scout). Antes de tratar autorização granular, re-rodar o scout só desse domínio.
