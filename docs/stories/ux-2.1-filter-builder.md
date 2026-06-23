# Story: Filtros Avançados com Query Builder Visual

**Story ID:** UX-2.1
**Epic:** EPIC-UX-POWER (UX Power — Experiência de Poder do Usuário)
**Tipo:** Feature
**Prioridade:** P0
**Pontos:** 8
**Sprint:** 1
**Fase:** 2 — Filtros e Views (paralelo com UX-1.1 e UX-1.2)
**Dependências:** Nenhuma
**Desbloqueia:** UX-2.2 (reutiliza FilterBuilder em Deals/Empresas)
**Status:** InReview
**Agente:** @sm (River) — draft | @po (Pax) — validado 2026-06-23 | @dev (Dex) — já implementado (pré-existente), verificado 2026-06-23

---

## Descrição

Como gestor comercial, quero construir filtros com múltiplas condições na lista de leads e salvar essas combinações como "views" reutilizáveis. Hoje os filtros são individuais e não persistem — cada acesso à página exige reconfiguração manual.

**Problema atual:** Filtrar por "responsável + status + score mínimo" requer 3 dropdowns separados que não se combinam visualmente e são perdidos ao navegar. Não há como salvar a combinação.

**Referência OSS verificada:** `openstatusHQ/data-table-filters` (composable blocks shadcn/ui, MIT); `sadmann7/tablecn` (MIT).

---

## Acceptance Criteria

### AC-1: Interface do Filter Builder
- [ ] Botão "Filtros" na barra da lista de leads, com badge contando filtros ativos (ex: "Filtros (2)")
- [ ] Clicar em "Filtros" abre um popover/dropdown com a interface do builder
- [ ] Interface exibe lista de condições ativas + botão "Adicionar condição"
- [ ] Botão "Limpar tudo" remove todas as condições de uma vez

### AC-2: Adicionar Condição
- [ ] Ao clicar "Adicionar condição", exibe linha com 3 selects em cascata:
  - Select 1 — **Campo**: nome, email, status, score, responsável (assignedTo), tag, empresa, data de criação
  - Select 2 — **Operador** (adapta ao campo):
    - Texto (nome, email): é, não é, contém, não contém, começa com, está vazio, não está vazio
    - Número (score): é igual a, é maior que, é menor que, está vazio
    - Enum (status, responsável): é, não é, está vazio
    - Data (createdAt): é depois de, é antes de, está entre (dois date pickers)
    - Tag: inclui, não inclui
  - Select 3 / Input — **Valor** (adapta ao operador selecionado)
- [ ] Cada condição tem botão X para remover individualmente
- [ ] Múltiplas condições têm AND implícito (sem toggle AND/OR nesta versão)

### AC-3: Aplicação dos Filtros
- [ ] Filtros ativos refletem imediatamente na lista (sem botão "Aplicar" — reativo)
- [ ] Filtros ativos são refletidos em query params da URL: `?filters=<base64/json>`
- [ ] URL com filtros pode ser copiada e compartilhada — ao carregar, filtros são restaurados
- [ ] A lista de leads usa os filtros no `useLeads` hook como parâmetros da query

### AC-4: Salvar View
- [ ] Botão "Salvar view" aparece quando há ≥ 1 filtro ativo
- [ ] Clicar abre um input inline para nome da view (ex: "Leads Quentes João")
- [ ] Confirmar salva a view via `POST /api/v1/saved-views` com `{ name, page: 'leads', config: { filters } }`
- [ ] Toast de sucesso após salvar

### AC-5: Carregar View Salva
- [ ] Botão "Views" (ou dropdown ao lado de "Filtros") lista as views salvas do tenant para a página `leads`
- [ ] Clicar em uma view aplica seus filtros imediatamente
- [ ] Opção "Remover" em cada view salva (com confirmação) via `DELETE /api/v1/saved-views/:id`

### AC-6: Backend — SavedView (já existe)
- [ ] `GET /api/v1/saved-views?page=leads` retorna views do tenant para a página leads
- [ ] `POST /api/v1/saved-views` aceita `{ name, page, config: { filters } }` — verificar se campo `page` está no schema; se não, adicionar à migration
- [ ] Multi-tenant: todas as queries filtram por `tenantId`
- [ ] Rota `POST /api/v1/saved-views` está na whitelist do CSRF em `server/src/index.ts`

---

## Dev Notes

### Arquitetura do FilterBuilder

**`src/components/FilterBuilder.tsx`** — componente puro, recebe `filters` e `onChange`:

```typescript
export interface FilterCondition {
  id: string          // uuid local para key
  field: LeadFilterField
  operator: FilterOperator
  value: string | string[] | number | null
}

type LeadFilterField = 'name' | 'email' | 'status' | 'score' | 'assignedTo' | 'tags' | 'company' | 'createdAt'

interface FilterBuilderProps {
  filters: FilterCondition[]
  onChange: (filters: FilterCondition[]) => void
  fields: FilterFieldConfig[]
}
```

### URL Sync

Em `src/pages/Leads.tsx`, usar `useSearchParams` (React Router v6):

```typescript
const [searchParams, setSearchParams] = useSearchParams()
const filtersFromUrl = useMemo(() => {
  const raw = searchParams.get('filters')
  return raw ? JSON.parse(atob(raw)) : []
}, [searchParams])

const updateFilters = (filters: FilterCondition[]) => {
  if (filters.length === 0) {
    setSearchParams({})
  } else {
    setSearchParams({ filters: btoa(JSON.stringify(filters)) })
  }
}
```

### SavedView — verificação do schema atual

Antes de implementar, verificar em `server/prisma/schema.prisma`:
```
model SavedView {
  id       String @id @default(cuid())
  tenantId String
  name     String
  config   Json   // { filters: FilterCondition[] }
  // verificar se campo 'page' existe
}
```

Se `page String?` não existir, criar migration:
```
ALTER TABLE "SavedView" ADD COLUMN "page" TEXT;
```

### Query no useLeads

Mapear `FilterCondition[]` → parâmetros aceitos por `GET /api/v1/leads`. O backend pode receber `filters` como JSON string no query param ou suportar params individuais. Verificar o endpoint atual e adaptar conforme necessário.

### Rota CSRF

Em `server/src/index.ts`, verificar se `saved-views` já está na whitelist:
```typescript
v1Router.use('/saved-views', csrfProtection)
```
Se não, adicionar.

---

## Arquivos a Criar/Modificar

| Arquivo | Operação | Detalhe |
|---------|----------|---------|
| `src/components/FilterBuilder.tsx` | CRIAR | Componente query builder visual |
| `src/hooks/useFilterBuilder.ts` | CRIAR | Estado + URL sync + persistência |
| `src/hooks/useSavedViews.ts` | CRIAR | CRUD de views salvas |
| `src/pages/Leads.tsx` | MODIFICAR | Substituir filtros atuais por FilterBuilder |
| `server/prisma/schema.prisma` | MODIFICAR SE NECESSÁRIO | Adicionar campo `page` em SavedView |
| `server/src/routes/saved-views.ts` | VERIFICAR/MODIFICAR | Garantir suporte a `page` discriminador |
| `server/src/index.ts` | VERIFICAR/MODIFICAR | CSRF whitelist para saved-views |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Backend de leads não suporta filtros combinados via query params | Média | Alto | Verificar `GET /api/v1/leads` antes de implementar — adaptar se necessário |
| SavedView schema sem campo `page` | Média | Médio | Migration simples `ALTER TABLE` sem dados perdidos |
| URL base64 muito longa com muitos filtros | Baixa | Baixo | Limitar a 10 condições por view |
| Filtros de tag (array) mais complexos | Média | Baixo | Implementar `tags inclui` como `?tags=tag1,tag2` |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| `FilterBuilder.tsx` (UI + seleção campo/operador/valor) | 3h |
| URL sync com React Router `useSearchParams` | 1h |
| `useSavedViews.ts` + integração SavedView API | 1.5h |
| Verificação/ajuste backend (SavedView schema + CSRF) | 45min |
| Integração em `Leads.tsx` + remoção de filtros antigos | 1h |
| Testes manuais + edge cases (data, tags) | 1h |
| **Total** | **~8.5h** |

---

## Verificação E2E

1. `/app/leads` → clicar "Filtros" → adicionar "Status é Qualificado" → lista filtra em tempo real
2. Adicionar segunda condição "Responsável é João" → badge mostra "Filtros (2)" → lista tem filtro combinado
3. Copiar URL → abrir em nova aba → filtros restaurados
4. Clicar "Salvar view" → nomear "Leads Quentes João" → toast sucesso → view aparece no dropdown de Views
5. Clicar "Limpar tudo" → filtros removidos, badge some, URL limpa
6. Abrir dropdown Views → selecionar "Leads Quentes João" → filtros reaplicados

---

*— River, removendo obstáculos 🌊*
*— Data: 2026-06-23*
