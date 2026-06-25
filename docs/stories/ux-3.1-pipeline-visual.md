# Story: Pipeline Kanban com Feedback Visual de Drag

**Story ID:** UX-3.1
**Epic:** EPIC-UX-POWER (UX Power — Experiência de Poder do Usuário)
**Tipo:** Enhancement (UX)
**Prioridade:** P1
**Pontos:** 5
**Sprint:** 1
**Fase:** 3 — Pipeline Visual (paralelo com Fase 1 e 2)
**Dependências:** Nenhuma (`@dnd-kit` já instalado)
**Desbloqueia:** Nenhuma
**Status:** Done
**Agente:** @sm (River) — draft | @po (Pax) — validado 2026-06-23 | @dev (Dex) — implementado 2026-06-23

---

## Descrição

Como vendedor, quero feedback visual claro ao arrastar um deal entre stages do pipeline kanban: o card arrastado deve ter um "ghost" que segue o cursor, a coluna de destino deve se destacar visualmente, e a animação ao soltar deve ser suave. Hoje o drag-and-drop existe mas é visual básico (sem ghost card, sem drop indicator).

**Problema atual:** O drag-and-drop em `DealPipelineBoard.tsx` usa HTML5 native ou `@dnd-kit` sem `DragOverlay`, resultando em feedback visual mínimo. Usuários perdem a referência de onde o card vai cair.

**Referência OSS verificada:** `react-dnd-kit-tailwind-shadcn-ui` (MIT, Georgegriff) — usa `DragOverlay` + `multipleContainersKeyboardPreset`.

---

## Acceptance Criteria

### AC-1: Ghost Card (DragOverlay)
- [ ] Ao iniciar drag: o card original na coluna de origem fica com `opacity: 40%`
- [ ] Um "ghost card" (cópia visual do card) segue o cursor durante o drag
- [ ] Ghost card tem box-shadow elevada e borda azul (`border-primary`)
- [ ] Ghost card renderizado via `DragOverlay` do `@dnd-kit/core` (React portal — não fica dentro da coluna)

### AC-2: Drop Indicator
- [ ] Durante drag sobre uma coluna: coluna de destino tem background levemente azulado (`bg-primary/5` ou `bg-accent`)
- [ ] Drop indicator: linha horizontal de 2px (azul primário) entre cards mostra posição de inserção
- [ ] Quando coluna de destino está vazia: coluna inteira com borda tracejada azul

### AC-3: Animação ao Soltar
- [ ] Card anima suavemente (200ms ease-out) ao ser solto na nova posição
- [ ] `useSortable` do `@dnd-kit/sortable` com `transition: { duration: 200, easing: 'ease-out' }`

### AC-4: Keyboard Drag (Acessibilidade — WCAG 2.1 AA)
- [ ] Tab navega entre cards do pipeline
- [ ] Enter (ou Space) inicia o "drag mode" no card selecionado
- [ ] Setas ← → movem o card entre colunas no drag mode
- [ ] Setas ↑ ↓ movem o card entre posições dentro da coluna
- [ ] Enter confirma drop; Esc cancela e retorna card à posição original
- [ ] Usar `KeyboardSensor` com `multipleContainersKeyboardPreset` do `@dnd-kit`
- [ ] Anúncio de acessibilidade: `aria-live` region informa a posição atual durante keyboard drag

### AC-5: Backend (sem mudanças)
- [ ] `PATCH /api/v1/deals/:id` com `{ stage }` já existe — nenhuma mudança necessária

### AC-6: Sem regressões
- [ ] Drag-and-drop por mouse continua funcionando normalmente
- [ ] A lógica de atualização de stage (chamada ao backend após drop) permanece intacta
- [ ] Cards já existentes (com dados de deal) renderizam corretamente no DragOverlay

---

## Dev Notes

### Dependências

```bash
# @dnd-kit já está instalado — verificar as sub-packages necessárias
cat package.json | grep dnd-kit
```

Necessário: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Se algum não estiver, instalar.

A dependência `@dnd-kit/modifiers` pode ser útil para restringir o drag ao eixo vertical (dentro de uma coluna). Verificar se necessário.

### Estrutura atual do DealPipelineBoard

Antes de implementar, ler `src/components/deals/DealPipelineBoard.tsx` completo para entender:
- Se usa `@dnd-kit` (DndContext, useSortable, SortableContext) ou HTML5 native drag
- Onde fica o handler `onDragEnd`
- Como as colunas e cards estão estruturados

**Se já usa `@dnd-kit`:** adicionar `DragOverlay` e `KeyboardSensor` sem reescrever estrutura.
**Se usa HTML5 native:** refatorar para `@dnd-kit` (esforço maior — reavaliar estimativa).

### Implementação do DragOverlay

```tsx
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { multipleContainersKeyboardPreset } from '@dnd-kit/sortable'

// No DealPipelineBoard:
const [activeDeal, setActiveDeal] = useState<Deal | null>(null)

const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: multipleContainersKeyboardPreset })
)

return (
  <DndContext
    sensors={sensors}
    onDragStart={({ active }) => setActiveDeal(findDeal(active.id))}
    onDragEnd={handleDragEnd}
    onDragCancel={() => setActiveDeal(null)}
  >
    {/* colunas normais */}
    <DragOverlay>
      {activeDeal ? <DealCard deal={activeDeal} isOverlay /> : null}
    </DragOverlay>
  </DndContext>
)
```

### Drop Indicator

`@dnd-kit/sortable` fornece `SortableContext` + `useSortable` que expõe `isOver`. Usar isso para aplicar estilos na coluna:

```tsx
// Na KanbanColumn:
const { isOver, setNodeRef } = useDroppable({ id: column.id })

<div
  ref={setNodeRef}
  className={cn('kanban-column', isOver && 'bg-primary/5 border-primary border-dashed')}
>
```

### Opacity no card original durante drag

Em `DealCard` que usa `useSortable`:
```tsx
const { isDragging } = useSortable({ id: deal.id })
// ...
<div className={cn('deal-card', isDragging && 'opacity-40')}>
```

### `isOverlay` prop no DealCard

Passar `isOverlay?: boolean` para desabilitar interações no ghost card (sem botões, sem hover states extras):
```tsx
{!isOverlay && <DropdownMenu>...</DropdownMenu>}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação | Detalhe |
|---------|----------|---------|
| `src/components/deals/DealPipelineBoard.tsx` | MODIFICAR | Adicionar DragOverlay, KeyboardSensor, drop indicators |
| `src/components/deals/DealCard.tsx` | MODIFICAR | opacity-40 quando isDragging, suporte `isOverlay` prop |
| `src/components/deals/KanbanColumn.tsx` | MODIFICAR SE EXISTE | isOver styles |
| `package.json` | VERIFICAR | Sub-packages @dnd-kit presentes |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Pipeline usa HTML5 native drag (não @dnd-kit) | Média | Alto | Verificar antes — se sim, refatorar completo (adicionar 3h) |
| `multipleContainersKeyboardPreset` não disponível na versão atual | Baixa | Médio | Verificar versão @dnd-kit/sortable — atualizar se necessário |
| DragOverlay não herda estilos corretos do DealCard | Baixa | Baixo | Passar props explicitamente ao DealCard no DragOverlay |
| Performance com muitos cards no pipeline | Baixa | Baixo | @dnd-kit usa virtualization por padrão |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Leitura e análise de `DealPipelineBoard.tsx` | 30min |
| DragOverlay + ativação/desativação do card original | 1.5h |
| Drop indicators nas colunas | 1h |
| KeyboardSensor + acessibilidade | 1h |
| Animação + polish visual | 30min |
| Testes manuais (mouse + teclado) | 45min |
| **Total** | **~5.25h** |

---

## Verificação E2E

1. `/app/pipeline` → arrastar deal para outra coluna → ghost card segue cursor com borda azul, card original semi-transparente
2. Durante drag: coluna de destino fica com fundo azulado, drop indicator (linha horizontal) aparece entre cards
3. Soltar card → animação de 200ms suave
4. Tab para navegar até um card → Enter → setas → mover para coluna adjacente → Enter para confirmar drop → backend atualizado
5. Durante keyboard drag → Esc → card retorna à posição original

---

*— River, removendo obstáculos 🌊*
*— Data: 2026-06-23*
