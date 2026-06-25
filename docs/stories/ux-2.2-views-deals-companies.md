# Story: Views Salvas em Deals e Empresas

**Story ID:** UX-2.2
**Epic:** EPIC-UX-POWER (UX Power — Experiência de Poder do Usuário)
**Tipo:** Feature
**Prioridade:** P0
**Pontos:** 3
**Sprint:** 2
**Fase:** 2 — Filtros e Views
**Dependências:** UX-2.1 (FilterBuilder implementado e disponível)
**Desbloqueia:** Nenhuma
**Status:** Done
**Agente:** @sm (River) — draft | @po (Pax) — validado 2026-06-23 | @dev (Dex) — já implementado em Deals.tsx (pré-existente), verificado 2026-06-23

---

## Descrição

Como gestor comercial, quero ter o mesmo sistema de filtros avançados e views salvas da lista de leads também na lista de deals e na lista de empresas. Cada página mantém suas próprias views salvas, com campos específicos ao contexto.

Esta story é um **extension sprint** da UX-2.1 — reutiliza o `FilterBuilder` e o `useSavedViews` já criados, apenas adaptando os campos disponíveis e integrando nos novos contextos.

---

## Acceptance Criteria

### AC-1: FilterBuilder em Deals
- [ ] `FilterBuilder` integrado em `/app/deals` (lista/tabela de deals)
- [ ] Campos disponíveis para deals: stage, responsável (assignedTo), valor mínimo (value >=), valor máximo (value <=), funnelId, expected close date, probabilidade
- [ ] Mesma mecânica de "Adicionar condição" / "Limpar tudo" / badge contador
- [ ] URL sync ativo (`?filters=<base64>`) na rota `/app/deals`

### AC-2: Views Salvas em Deals
- [ ] Botão "Salvar view" salva via `POST /api/v1/saved-views` com `page: 'deals'`
- [ ] Dropdown "Views" lista apenas views de `page: 'deals'` para o tenant
- [ ] Views pré-criadas por template ao criar o tenant (ou primeiro acesso):
  - "Meus deals abertos" — filtro: `assignedTo = currentUser, stage != WON, stage != LOST`
  - "Alta prioridade" — filtro: `probability >= 70`

### AC-3: FilterBuilder em Empresas
- [ ] `FilterBuilder` integrado em `/app/companies` (se a página existir como lista/tabela)
- [ ] Campos disponíveis para empresas: segmento (industry), cidade, número de leads associados
- [ ] Mesma mecânica de condições + views salvas com `page: 'companies'`

### AC-4: Views pré-criadas (seed ou first-use)
- [ ] View "Leads sem atividade 7d" em `/app/leads` (criada via seed ou on-boarding):
  - Filtro: `lastInteractionAt < now - 7 days` (campo no backend de leads)
- [ ] Views de deals pré-criadas aplicam automaticamente no primeiro acesso de usuário novo (opcional — se complexo, omitir e documentar como melhoria futura)

### AC-5: Isolamento por página
- [ ] Views são por `page` discriminador — views de leads NÃO aparecem em deals
- [ ] Views são por `tenantId` — não visíveis em outros tenants

### AC-6: Backend (verificação)
- [ ] `GET /api/v1/saved-views?page=deals` retorna apenas views com `page = 'deals'`
- [ ] `GET /api/v1/saved-views?page=companies` retorna apenas views com `page = 'companies'`
- [ ] Se o campo `page` foi adicionado na UX-2.1, esta story não requer nova migration

---

## Dev Notes

### Pré-requisito verificado

Esta story assume que `FilterBuilder`, `useSavedViews` e o campo `page` no schema `SavedView` foram implementados na UX-2.1. Verificar antes de iniciar:

```bash
# Verificar se FilterBuilder existe
ls src/components/FilterBuilder.tsx

# Verificar se migration de 'page' foi aplicada
grep -n "page" server/prisma/schema.prisma
```

### Campos de deals para o FilterBuilder

```typescript
// Passar como `fields` prop para <FilterBuilder />
const DEAL_FILTER_FIELDS: FilterFieldConfig[] = [
  { key: 'stage',       label: 'Stage',       type: 'enum',   options: DealStage },
  { key: 'assignedTo',  label: 'Responsável', type: 'user' },
  { key: 'value',       label: 'Valor',       type: 'number' },
  { key: 'funnelId',    label: 'Funil',       type: 'enum',   optionsFrom: 'funnels' },
  { key: 'probability', label: 'Probabilidade', type: 'number' },
  { key: 'expectedCloseDate', label: 'Previsão de fechamento', type: 'date' },
]
```

### Campos de empresas para o FilterBuilder

```typescript
const COMPANY_FILTER_FIELDS: FilterFieldConfig[] = [
  { key: 'industry', label: 'Segmento', type: 'text' },
  { key: 'city',     label: 'Cidade',   type: 'text' },
]
```

### Verificar se Companies tem lista/tabela

Antes de implementar, verificar se `src/pages/Companies.tsx` existe e tem uma tabela de listagem. Se a página for só detalhe (sem lista), a integração do FilterBuilder em Companies fica como melhoria futura.

---

## Arquivos a Criar/Modificar

| Arquivo | Operação | Detalhe |
|---------|----------|---------|
| `src/pages/Deals.tsx` | MODIFICAR | Adicionar `<FilterBuilder fields={DEAL_FIELDS} />` |
| `src/pages/Companies.tsx` | VERIFICAR/MODIFICAR | Adicionar FilterBuilder se página de lista existir |
| `src/hooks/useDeals.ts` | MODIFICAR | Aceitar `filters: FilterCondition[]` como parâmetro de query |
| `server/prisma/schema.prisma` | NÃO ALTERAR | Campo `page` deve existir da UX-2.1 |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| UX-2.1 não implementada antes desta | Alta | Alto | Dependência explícita — bloquear sprint se 2.1 não done |
| Página Companies não tem lista/tabela | Média | Baixo | Pular Companies, focar em Deals |
| Backend de deals não suporta filtros combinados | Média | Médio | Verificar `GET /api/v1/deals` e adaptar antes de integrar |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Integração FilterBuilder em Deals | 1.5h |
| Integração FilterBuilder em Companies (se aplicável) | 1h |
| Views pré-criadas para deals | 30min |
| Testes manuais | 45min |
| **Total** | **~3.75h** |

---

## Verificação E2E

1. `/app/deals` → "Filtros" → adicionar "Stage é Proposta" → lista filtra
2. Salvar como "Propostas Abertas" → view aparece no dropdown com `page: deals`
3. `/app/leads` → dropdown Views → "Propostas Abertas" NÃO aparece (isolamento por página)
4. Verificar se "Meus deals abertos" aparece como view pré-criada
5. Se Companies tem lista → "Filtros" → adicionar "Segmento contém Tech" → lista filtra

---

*— River, removendo obstáculos 🌊*
*— Data: 2026-06-23*
