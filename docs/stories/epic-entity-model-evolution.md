# Epic: Company Entity + Contact Separation + Multi-Pipeline

**Epic ID:** EPIC-ENTITY
**Tipo:** Feature — Model Evolution
**Prioridade:** P1 — Evolução estrutural do CRM para competir com Pipedrive/HubSpot
**Origem:** Análise de gaps competitivos — Morgan (PM) — 2026-03-18
**Data:** 2026-03-18
**Agente:** @pm (Morgan)
**Status:** Draft

---

## Epic Summary

O VYD Engage trata "Company" como um campo string no Lead (`Lead.company: String?`), não possui separação entre Lead (não qualificado) e Contact (qualificado), e embora o schema já suporte múltiplos Funnels por tenant, o Deal model não está vinculado a um pipeline específico. Este epic resolve esses 3 gaps estruturais que separam o VYD Engage de CRMs profissionais (Pipedrive, HubSpot, Close).

**Métricas de sucesso:**
- Company é uma entidade completa com página própria, leads e deals vinculados
- Leads convertidos (WON) podem ser promovidos a Contacts com filtros dedicados
- Usuário pode criar e gerenciar múltiplos pipelines com deals isolados por pipeline
- Zero regressão nas funcionalidades existentes (Pipeline kanban, Leads, Deals)

**Total estimado:** ~21 pontos | 3 stories | 2 sprints

---

## Inventário de Reusos

| Componente | Status | Arquivo | Notas |
|---|---|---|---|
| Lead model com `company: String?` | Existe | `server/prisma/schema.prisma:428` | Campo string — será substituído por FK |
| Lead CRUD completo | Existe | `server/src/routes/leads.ts` | GET/POST/PUT/DELETE + bulk + import/export |
| Lead service | Existe | `server/src/services/leadService.ts` | findAll, create, update, delete com tenant scope |
| Funnel model (multi-funnel ready) | Existe | `server/prisma/schema.prisma:272-291` | `@@unique([tenantId, name])`, `isDefault`, `order` |
| Funnel CRUD completo | Existe | `server/src/routes/funnels.ts` | GET/POST/PUT/DELETE + columns + move-lead |
| `useFunnels` hook | Existe | `src/hooks/useFunnels.ts` | switchFunnel, create/delete funnel — multi-pipeline no frontend |
| Pipeline.tsx com funnel selector | Existe | `src/pages/Pipeline.tsx:471-481` | `<select>` com dropdown de funnels — já funcional |
| Deal model | Existe | `server/prisma/schema.prisma:367-394` | `DealStage` enum, sem `funnelId` |
| Deal CRUD + pipeline board | Existe | `src/pages/Deals.tsx`, `src/components/deals/DealPipelineBoard.tsx` | List + Pipeline view |
| `useDeals` hook | Existe | `src/hooks/useDeals.ts` | fetchDeals, createDeal, updateDeal, deleteDeal |
| Sidebar navigation | Existe | `src/components/Sidebar.tsx` | Links para todas as pages |
| apiClient | Existe | `src/services/api/client.ts` | Todos os métodos HTTP base |
| shadcn/ui components | Existe | `src/components/ui/` | Dialog, Button, Input, Select, Tabs, etc. |
| Interaction model | Existe | `server/prisma/schema.prisma:757-786` | `leadId`, `dealId` — pode receber `companyId` |
| FunnelColumn → Lead relation | Existe | `server/prisma/schema.prisma:293-315` | `leads Lead[]` via `funnelColumnId` |
| LeadStatus enum | Existe | `server/prisma/schema.prisma:400-408` | NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST |

---

## Análise do Estado Atual

### Company hoje
- `Lead.company` é `String?` (linha 428 do schema) — apenas texto livre
- Usado em search (`leads.ts:279`), import (`leads.ts:399`), create/update schemas
- Não há modelo Company, não há tabela, não há página
- Não há agrupamento de leads por empresa

### Pipeline / Funnel hoje
- Schema suporta múltiplos Funnels por tenant (`Funnel` model com `tenantId`)
- `Pipeline.tsx` já tem funnel selector dropdown e CRUD de funnels completo
- `useFunnels` hook já suporta `switchFunnel`, `createFunnel`, `deleteFunnel`
- **Gap:** O model `Deal` não tem `funnelId` — deals não estão vinculados a um pipeline específico
- **Gap:** `DealStage` é um enum fixo (QUALIFICATION → WON/LOST) — não usa as colunas do Funnel

### Lead vs Contact hoje
- Não existe distinção entre lead não qualificado e contact qualificado
- `LeadStatus.WON` existe mas não há ação de "conversão"
- Não há flag `isContact` nem modelo Contact separado

---

## Stories

---

### Story 1 | Company Entity — Modelo, API e Página

**Prioridade:** P1 | **Pontos:** 8 | **Sprint:** 1
**Dependências:** Nenhuma

**Descrição:** Criar Company como entidade first-class no CRM. Modelo Prisma com campos essenciais, CRUD completo (API + service), página de listagem e detalhe com leads e deals vinculados, migration para extrair strings existentes em `Lead.company` para registros Company reais, e link no sidebar.

**AC:**

**Backend — Model & Migration:**
- [ ] Criar model `Company` no Prisma: `id`, `tenantId`, `name`, `domain` (nullable, unique por tenant), `industry` (nullable), `size` (enum: MICRO, SMALL, MEDIUM, LARGE, ENTERPRISE — nullable), `phone` (nullable), `address` (nullable), `website` (nullable), `notes` (nullable), `createdAt`, `updatedAt`
- [ ] Adicionar `companyId: String?` no model `Lead` como FK para `Company`
- [ ] Adicionar relação `Company → Lead[]` (one-to-many) e `Company → Deal[]` (one-to-many)
- [ ] Adicionar `companyId: String?` no model `Deal` como FK para `Company`
- [ ] Adicionar `companyId: String?` no model `Interaction` para timeline de empresa
- [ ] Criar migration Prisma com data migration: extrair valores distintos de `Lead.company` (não-null, não-vazio) → criar registros `Company` → atualizar `Lead.companyId` com o ID correspondente
- [ ] Manter campo `Lead.company` (String?) como fallback temporário (não deletar nesta story)
- [ ] Adicionar índices: `@@index([tenantId])`, `@@index([tenantId, name])`, `@@index([tenantId, domain])`
- [ ] Adicionar `companies` relation no model `Tenant`

**Backend — API:**
- [ ] Criar `server/src/services/companyService.ts`: findAll (com paginação, search, filtros), findById (com leads e deals inclusos), create, update, delete, count
- [ ] Criar `server/src/routes/companies.ts`: CRUD completo com auth + tenant middleware
- [ ] `GET /api/companies` — listagem com search, paginação, filtros (industry, size)
- [ ] `GET /api/companies/:id` — detalhe com `include: { leads, deals, interactions }`
- [ ] `POST /api/companies` — criar empresa (validação Zod)
- [ ] `PUT /api/companies/:id` — atualizar empresa
- [ ] `DELETE /api/companies/:id` — deletar empresa (só se não tem leads/deals vinculados, ou cascade config)
- [ ] `GET /api/companies/stats/count` — contagem para plan limits (futuro)
- [ ] Registrar router em `server/src/index.ts`

**Backend — Lead Integration:**
- [ ] Atualizar `createLeadSchema` em `leads.ts`: aceitar `companyId: z.string().uuid().optional()` além de `company`
- [ ] Atualizar `leadService.create`: se `companyId` fornecido, vincular; se `company` string fornecido sem `companyId`, criar Company automaticamente ou apenas salvar string
- [ ] Atualizar `leadService.findAll`: incluir `company` relation no include
- [ ] Atualizar `leadService.findById`: incluir `company` relation no include

**Frontend — Página:**
- [ ] Criar `src/pages/Companies.tsx`: listagem com tabela (nome, domain, industry, size, leads count, deals count, criado em)
- [ ] Search por nome/domain
- [ ] Paginação
- [ ] Botão "Nova Empresa" abrindo modal/form
- [ ] Criar `src/pages/CompanyDetail.tsx`: header com dados da empresa, tabs (Leads vinculados, Deals vinculados, Timeline/Interações, Info)
- [ ] Criar `src/components/CompanyForm.tsx`: form para criar/editar empresa
- [ ] Adicionar rotas `/app/companies` e `/app/companies/:id` em App.tsx
- [ ] Adicionar link "Empresas" no `Sidebar.tsx` com ícone `Building2` (lucide-react)
- [ ] Ordenar no sidebar: após "Leads" e antes de "Deals"

**Frontend — Lead Integration:**
- [ ] No `LeadForm.tsx` e `LeadModal.tsx`: campo Company como autocomplete/select buscando de `/api/companies` (além do texto livre existente)
- [ ] No `LeadDetail.tsx`: mostrar Company como link clicável para `/app/companies/:id`
- [ ] No card do Pipeline (kanban): mostrar nome da empresa se vinculada

**Testes:**
- [ ] Criar empresa via API → aparece na listagem
- [ ] Vincular lead a empresa → empresa mostra lead na tab de leads
- [ ] Migration: lead com `company: "Acme"` → Company "Acme" criada → lead vinculado
- [ ] Deletar empresa sem leads vinculados → sucesso
- [ ] Search por nome/domain funciona

**Dev Notes:**
- **Arquivos a criar:** `server/src/services/companyService.ts`, `server/src/routes/companies.ts`, `src/pages/Companies.tsx`, `src/pages/CompanyDetail.tsx`, `src/components/CompanyForm.tsx`
- **Arquivos a modificar:** `server/prisma/schema.prisma`, `server/src/index.ts`, `server/src/routes/leads.ts`, `server/src/services/leadService.ts`, `src/components/Sidebar.tsx`, `src/App.tsx` (routes), `src/pages/LeadForm.tsx`, `src/components/LeadModal.tsx`, `src/pages/LeadDetail.tsx`, `src/pages/Pipeline.tsx` (card), `src/services/api/client.ts` (apiClient), `src/hooks/useFunnels.ts` (FunnelLead type)
- **Padrão de service:** seguir `leadService.ts` — findAll com paginação, tenant-scoped
- **Padrão de route:** seguir `leads.ts` — authenticate + tenantScope + Zod validation
- **Migration data:** usar `prisma.$executeRaw` ou script seed para extrair `Lead.company` → `Company` records. Agrupar por valor normalizado (trim + lowercase) para evitar duplicatas tipo "Acme" vs "acme "
- **Autocomplete no frontend:** debounced search com `GET /api/companies?search=X&limit=10`

---

### Story 2 | Contact vs Lead Separation (isContact Flag)

**Prioridade:** P2 | **Pontos:** 5 | **Sprint:** 1
**Dependências:** Nenhuma (pode rodar em paralelo com Story 1)

**Descrição:** Implementar separação conceitual entre Lead (não qualificado) e Contact (qualificado/convertido). Dado que o model Lead já possui `LeadStatus` com WON/LOST e toda a infraestrutura de CRUD, timeline e pipeline, a abordagem mais pragmática é adicionar um campo `isContact: Boolean @default(false)` ao Lead em vez de criar um modelo separado. Quando um lead é marcado como WON, oferecer opção "Converter para Contato". Views separadas permitem filtrar.

**Justificativa da abordagem `isContact`:**
- O modelo Lead já tem 12+ relations (tags, interactions, tasks, deals, automationLogs, funnelColumn). Criar um modelo Contact duplicaria todas essas relations.
- HubSpot e Pipedrive internamente também usam a mesma tabela com flag/tipo.
- Migração zero — não precisa mover dados entre tabelas.
- Todas as features existentes (bulk actions, dedup, scoring, import/export, pipeline) continuam funcionando sem mudança.

**AC:**

**Backend:**
- [ ] Adicionar `isContact: Boolean @default(false)` no model `Lead`
- [ ] Adicionar `convertedAt: DateTime?` no model `Lead` — data da conversão
- [ ] Criar migration Prisma
- [ ] Atualizar `leadService.findAll`: aceitar filtro `isContact: boolean` no query
- [ ] Atualizar `GET /api/leads` querySchema: adicionar `isContact: z.coerce.boolean().optional()`
- [ ] Criar endpoint `POST /api/leads/:id/convert` — marca `isContact: true`, `convertedAt: now()`, status → WON (se não estiver)
- [ ] Criar endpoint `POST /api/leads/:id/revert` — marca `isContact: false`, `convertedAt: null` (desfazer conversão)
- [ ] Criar interaction tipo `CONVERSION` (ou usar `STATUS_CHANGE` com metadata) ao converter

**Frontend — Views:**
- [ ] Na página `Leads.tsx`: adicionar toggle/tabs "Leads | Contatos | Todos" no toolbar
- [ ] Tab "Leads" filtra `isContact=false` (padrão)
- [ ] Tab "Contatos" filtra `isContact=true`
- [ ] Tab "Todos" não filtra (comportamento atual)
- [ ] Contatos mostram badge visual diferenciado (ex: ícone `UserCheck` verde)

**Frontend — Conversão:**
- [ ] No `LeadDetail.tsx`: quando status = WON e `isContact = false`, mostrar botão "Converter para Contato"
- [ ] No `LeadModal.tsx`: mesmo botão de conversão
- [ ] Ao clicar "Converter": confirmation dialog → chamar `POST /api/leads/:id/convert` → atualizar UI
- [ ] Contatos convertidos mostram data de conversão no detalhe
- [ ] Na pipeline (kanban): ao dropar lead na coluna mapeada para WON, oferecer opção de converter

**Sidebar:**
- [ ] Adicionar link "Contatos" no sidebar com ícone `UserCheck` (lucide-react)
- [ ] "Contatos" aponta para `/app/leads?view=contacts` (ou rota dedicada `/app/contacts`)
- [ ] Ordenar: Leads → Contatos → Empresas → Deals

**Testes:**
- [ ] Criar lead → isContact = false por padrão
- [ ] Converter lead para contato → isContact = true, convertedAt preenchido
- [ ] Tab "Contatos" mostra apenas leads convertidos
- [ ] Tab "Leads" não mostra leads convertidos
- [ ] Reverter conversão → volta para tab "Leads"
- [ ] Import de leads: isContact = false por padrão

**Dev Notes:**
- **Arquivos a criar:** Nenhum arquivo novo major — apenas modificações
- **Arquivos a modificar:** `server/prisma/schema.prisma` (Lead model), `server/src/routes/leads.ts` (novo endpoint convert/revert, querySchema), `server/src/services/leadService.ts` (filtro isContact), `src/pages/Leads.tsx` (tabs), `src/pages/LeadDetail.tsx` (botão converter), `src/components/LeadModal.tsx` (botão converter), `src/components/Sidebar.tsx` (link Contatos), `src/services/api/client.ts` (métodos convert/revert), `src/App.tsx` (rota /app/contacts se dedicada)
- **Pattern de tabs:** usar `Tabs` component do shadcn/ui já existente em `src/components/ui/`
- **Migration:** simples — apenas `ALTER TABLE "Lead" ADD COLUMN "isContact" BOOLEAN DEFAULT false, ADD COLUMN "convertedAt" TIMESTAMP`
- **Não alterar:** Lead import/export, bulk actions, dedup, scoring — todos continuam funcionando transparently

---

### Story 3 | Multi-Pipeline para Deals

**Prioridade:** P1 | **Pontos:** 8 | **Sprint:** 2
**Dependências:** Story 1 (Company entity — para associar deals a company no contexto de pipeline)

**Descrição:** Vincular Deals a Pipelines (Funnels) específicos. Atualmente o model Deal usa `DealStage` enum fixo e não está conectado ao model Funnel. Cada pipeline deve ter seus próprios stages (FunnelColumns) e deals devem pertencer a um pipeline específico. A UI de Deals ganha um pipeline selector similar ao que Pipeline.tsx já tem para Leads.

**AC:**

**Backend — Model:**
- [ ] Adicionar `funnelId: String?` no model `Deal` como FK para `Funnel`
- [ ] Adicionar `funnelColumnId: String?` no model `Deal` como FK para `FunnelColumn` (posição no pipeline)
- [ ] Adicionar `positionInColumn: Int @default(0)` no model `Deal`
- [ ] Adicionar relação `Funnel → deals Deal[]` e `FunnelColumn → deals Deal[]`
- [ ] Criar migration com data migration: criar um Funnel "Pipeline de Vendas" (deal-type) por tenant se não existir, com colunas correspondentes ao enum `DealStage` atual, e vincular deals existentes
- [ ] Adicionar campo `type` ao model Funnel: `type: FunnelType @default(LEAD)` com enum `FunnelType { LEAD, DEAL }` — para distinguir pipelines de leads vs deals
- [ ] Atualizar `@@unique([tenantId, name])` do Funnel para `@@unique([tenantId, name, type])` se necessário
- [ ] Adicionar índices no Deal: `@@index([tenantId, funnelId])`, `@@index([funnelColumnId])`

**Backend — API:**
- [ ] Atualizar `server/src/routes/deals.ts`: aceitar `funnelId` no create/update
- [ ] Atualizar deal create: se `funnelId` fornecido, usar primeira coluna do funnel como `funnelColumnId` default
- [ ] Criar endpoint `POST /api/deals/move` — mover deal entre colunas do pipeline (similar a `POST /api/funnels/move-lead`)
- [ ] Atualizar `GET /api/deals`: filtrar por `funnelId` opcionalmente
- [ ] Atualizar `GET /api/funnels?type=DEAL` para listar apenas pipelines de deals
- [ ] Atualizar `funnelService.ensureDefaultFunnel` para criar defaults por tipo (LEAD e DEAL)

**Frontend — Deals Pipeline:**
- [ ] Atualizar `DealPipelineBoard.tsx`: usar colunas do Funnel (FunnelColumns) em vez de enum `DealStage` fixo
- [ ] Adicionar funnel selector dropdown na página `Deals.tsx` (copiar pattern de `Pipeline.tsx:441-531`)
- [ ] Criar/editar/deletar pipelines de deals (CRUD — reutilizar lógica de `Pipeline.tsx`)
- [ ] Drag-and-drop de deals entre colunas do pipeline → chamar `POST /api/deals/move`
- [ ] Ao criar novo deal: selecionar em qual pipeline (default: pipeline padrão de deals)
- [ ] Atualizar `DealForm.tsx`: campo pipeline selector

**Frontend — Funnel Hook:**
- [ ] Atualizar `useFunnels.ts` ou criar `useDealsGPipeline.ts`: aceitar parâmetro `type: 'LEAD' | 'DEAL'` para filtrar funnels por tipo
- [ ] Atualizar `apiClient`: `getFunnels(type?)`, `getDefaultFunnel(type?)`

**Migration & Backward Compatibility:**
- [ ] Deals existentes sem `funnelId`: vinculados ao pipeline default de deals durante migration
- [ ] Mapear `DealStage` enum para FunnelColumns: QUALIFICATION → coluna 1, PROPOSAL → coluna 2, etc.
- [ ] Manter campo `Deal.stage` (DealStage enum) como fallback temporário para queries/reports existentes
- [ ] Sincronizar `stage` com `funnelColumn.mappedStatus` ao mover deal (se aplicável)

**Testes:**
- [ ] Criar pipeline de deals "Enterprise Sales" com 4 colunas → aparece no selector
- [ ] Criar deal vinculado ao pipeline → aparece no board correto
- [ ] Drag-and-drop deal entre colunas → posição atualizada
- [ ] Trocar pipeline no selector → board mostra deals daquele pipeline
- [ ] Pipeline default de deals criado automaticamente por tenant
- [ ] Deals existentes (migrados) aparecem no pipeline default
- [ ] Pipeline de leads e pipeline de deals são listados separadamente

**Dev Notes:**
- **Arquivos a criar:** Possivelmente `src/hooks/useDealsPipeline.ts` (ou estender `useFunnels`)
- **Arquivos a modificar:** `server/prisma/schema.prisma` (Deal, Funnel, FunnelColumn, novo enum FunnelType), `server/src/routes/deals.ts`, `server/src/services/dealService.ts`, `server/src/routes/funnels.ts` (filtro type), `server/src/services/funnelService.ts` (ensureDefault por tipo), `src/pages/Deals.tsx` (selector), `src/components/deals/DealPipelineBoard.tsx` (columns from funnel), `src/components/deals/DealForm.tsx` (pipeline selector), `src/hooks/useFunnels.ts` (type param), `src/hooks/useDeals.ts` (funnelId filter), `src/services/api/client.ts`
- **Pattern chave:** `Pipeline.tsx` já implementa 100% do pattern visual de multi-pipeline com selector, create, edit, delete. Copiar esse pattern para Deals.
- **Cuidado com migration:** A migration deve criar FunnelColumns para deals que mapeiam para os valores do enum `DealStage`, garantindo que deals existentes não perdem posição
- **DealStage enum:** Não deletar nesta story — manter como fallback. Deprecar em story futura.

---

## Sequência de Execução

```
Sprint 1 (paralelo):
  Story 1 (Company Entity)          ─────────────────────►  8 pts
  Story 2 (Contact Separation)      ─────────────────────►  5 pts

Sprint 2 (após Sprint 1):
  Story 3 (Multi-Pipeline Deals)    ─────────────────────►  8 pts
                                     (depende Story 1 — Company→Deal link)
```

**Sprint 1:** Stories 1 e 2 são independentes → execução paralela
**Sprint 2:** Story 3 depende de Story 1 (para vincular Company a Deal no contexto de pipeline)

---

## Estimativas

| Story | Pontos | Complexidade | Tipo |
|-------|--------|-------------|------|
| Story 1 — Company Entity | 8 | Alta | Feature (model + API + UI + migration) |
| Story 2 — Contact Separation | 5 | Média | Feature (field + API + UI) |
| Story 3 — Multi-Pipeline Deals | 8 | Alta | Feature (model + API + UI + migration) |
| **Total** | **21** | | |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Data migration de `Lead.company` string → Company records cria duplicatas | Alta | Médio | Normalizar (trim + lowercase) antes de agrupar; dedup na migration |
| Deals existentes perdem stage ao migrar para FunnelColumns | Média | Alto | Manter `Deal.stage` como fallback; mapear 1:1 para columns na migration |
| Performance de queries com joins Company + Lead + Deal | Baixa | Médio | Índices compostos; lazy load relations na listagem |
| UI complexity: muitos selectors (pipeline, company, contact toggle) | Média | Baixo | Design clean com defaults inteligentes; show selectors only when multiple options exist |
| Breaking change no campo `Lead.company` (string → FK) | Alta | Alto | Manter ambos os campos temporariamente; deprecar string field em story futura |

---

## Dependências Externas

| Dependência | Status | Notas |
|---|---|---|
| Prisma Client | Existe | Todas as queries via Prisma — suporta migrations com data migration |
| shadcn/ui Tabs | Existe | Para toggle Lead/Contact views |
| shadcn/ui Combobox/Command | Verificar | Para autocomplete de Company — pode precisar instalar |
| lucide-react (Building2, UserCheck) | Existe | Ícones para sidebar |

---

## Decisões Arquiteturais

| Decisão | Opções Consideradas | Escolhida | Justificativa |
|---------|---------------------|-----------|---------------|
| Contact: modelo separado vs flag no Lead | 1) Model Contact separado 2) `isContact` boolean no Lead | **2 — isContact flag** | Lead tem 12+ relations; duplicar seria over-engineering; HubSpot faz igual |
| Company: modelo relacional vs JSON | 1) Model Prisma full 2) JSON field no Lead | **1 — Model Prisma** | Precisa de listagem, search, dedup, relações com Deals — JSON não serve |
| Multi-Pipeline: estender Funnel vs criar DealPipeline | 1) Novo modelo DealPipeline 2) Adicionar `type` enum ao Funnel existente | **2 — FunnelType enum** | Funnel + FunnelColumn já tem CRUD completo, UI pronta, reorderColumns, etc. Reusar > recriar |
| Deal stage: enum vs FunnelColumn | 1) Manter enum DealStage 2) Migrar para FunnelColumn dinâmico | **2 — FunnelColumn** | Permite stages customizáveis por pipeline; manter enum como fallback temporário |

---

## Definição de Pronto (Epic-Level)

- [ ] Company é modelo Prisma com CRUD completo (API + UI)
- [ ] Página `/app/companies` acessível pelo sidebar
- [ ] Página `/app/companies/:id` mostra leads e deals vinculados
- [ ] Leads podem ser vinculados a Company (autocomplete no form)
- [ ] Migration converte `Lead.company` strings em registros Company
- [ ] Flag `isContact` no Lead com endpoints convert/revert
- [ ] Tabs Lead/Contact/Todos na página de Leads
- [ ] Link "Contatos" no sidebar
- [ ] Deals vinculados a pipeline (Funnel) específico via `funnelId`
- [ ] Pipeline selector na página Deals (similar ao Pipeline.tsx)
- [ ] CRUD de pipelines de deals funcional
- [ ] Drag-and-drop de deals entre colunas do pipeline
- [ ] Migration vincula deals existentes ao pipeline default
- [ ] Zero regressão: Pipeline kanban de leads continua funcionando
- [ ] Zero regressão: Deals list/detail continua funcionando
- [ ] Frontend build sem erros
- [ ] Backend build sem erros

---

*Criado por Morgan (PM) — 2026-03-18*
*Base: Análise competitiva (Pipedrive, HubSpot) + codebase VYD Engage v0.1.0*
