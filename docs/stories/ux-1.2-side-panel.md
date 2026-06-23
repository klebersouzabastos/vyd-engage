# Story: Side Panel — Quick View sem sair da lista

**Story ID:** UX-1.2
**Epic:** EPIC-UX-POWER (UX Power — Experiência de Poder do Usuário)
**Tipo:** Feature
**Prioridade:** P0
**Pontos:** 5
**Sprint:** 1
**Fase:** 1 — Navegação (paralelo com UX-1.1)
**Dependências:** Nenhuma
**Desbloqueia:** UX-2.2 (side panel usado em views de deals também)
**Status:** Done
**Agente:** @sm (River) — draft | @po (Pax) — validado 2026-06-23 | @dev (Dex) — implementado 2026-06-23

---

## Descrição

Como vendedor, quero clicar em uma linha da lista de leads (ou deals) e ver os detalhes principais num painel lateral à direita, sem fechar a lista nem navegar para outra página. O objetivo é reduzir o custo de consulta rápida: o vendedor mantém o contexto da lista enquanto consulta ou atualiza um item.

**Problema atual:** Para ver qualquer detalhe de um lead, o usuário precisa navegar para `/app/leads/:id` e depois usar o botão Voltar. Esse round-trip custa ~8 segundos de cliques e recarregamento de tela, quebrando o fluxo de revisão de lista.

**Referência OSS verificada:** Twenty CRM v0.44.0 — Side Panel com Sheet component.

---

## Acceptance Criteria

### AC-1: Abertura do Side Panel em Leads
- [ ] Click em qualquer célula da tabela de leads (exceto checkboxes e botões de ação) abre o side panel
- [ ] Side panel abre na direita, com largura de 480px em desktop (≥ 1024px)
- [ ] Em telas < 1024px, side panel abre como modal full-width (Sheet behavior padrão do shadcn/ui)
- [ ] A lista de leads permanece visível e interativa à esquerda (layout side-by-side)

### AC-2: Conteúdo do Side Panel de Lead
- [ ] Exibe: nome completo, empresa, score (badge colorido), stage (badge), telefone, email
- [ ] Exibe: data da última interação (se houver) com tipo (ligação, email, nota)
- [ ] Exibe: próxima tarefa pendente (título + data de vencimento) se houver
- [ ] Exibe: tags do lead (badges)
- [ ] Exibe: responsável (nome + avatar/iniciais)
- [ ] Botão "Ver completo" navega para `/app/leads/:id` (mantém panel aberto até navegação)
- [ ] Skeleton loading enquanto dados carregam (TanStack Query + `isLoading`)

### AC-3: Fechamento
- [ ] Botão X no canto superior direito fecha o panel
- [ ] Tecla Esc fecha o panel
- [ ] Clicar fora do panel (overlay) fecha
- [ ] Clicar em outra linha da lista enquanto panel está aberto substitui o conteúdo (não fecha e reabre)

### AC-4: Side Panel em Deals
- [ ] Mesma mecânica em `/app/deals` (lista de deals, se existir como tabela)
- [ ] Conteúdo do panel de deal: nome, valor (R$), stage, responsável, funnelId, probabilidade, expected close date
- [ ] Botão "Ver completo" navega para `/app/deals/:id`

### AC-5: Performance
- [ ] Dados carregam em < 300ms para entradas já em cache do TanStack Query
- [ ] Primeira abertura (cache frio) não bloqueia a UI — skeleton visível imediatamente

### AC-6: Backend
- [ ] Nenhuma mudança no backend — reutiliza `GET /api/v1/leads/:id` e `GET /api/v1/deals/:id` existentes

---

## Dev Notes

### Componente principal

**`src/components/SidePanel.tsx`** — usa `Sheet` do shadcn/ui com `side="right"`:

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface SidePanelProps {
  open: boolean
  onClose: () => void
  type: 'lead' | 'deal'
  id: string | null
}

export function SidePanel({ open, onClose, type, id }: SidePanelProps) {
  // useQuery para buscar dados do id
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:w-[480px]">
        {type === 'lead' ? <LeadPanelContent id={id} onClose={onClose} /> : <DealPanelContent id={id} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}
```

### Context para controle global

**`src/contexts/SidePanelContext.tsx`**:

```typescript
interface SidePanelState {
  open: boolean
  type: 'lead' | 'deal' | null
  id: string | null
  openPanel: (type: 'lead' | 'deal', id: string) => void
  closePanel: () => void
}
```

Montar `<SidePanelProvider>` + `<SidePanel />` no layout `/app/*` (junto com `<CommandPalette />`).

### Integração em LeadTable

Em `src/components/leads/LeadTable.tsx` (ou `src/pages/Leads.tsx`):
- Cada row recebe `onClick={() => openPanel('lead', lead.id)}`
- A célula de ações (botões editar/excluir) recebe `e.stopPropagation()` para não abrir o panel

### Queries a reutilizar

```typescript
// Já existente em useLeads.ts ou similar — verificar antes de criar nova query
const { data: lead, isLoading } = useQuery({
  queryKey: ['lead', id],
  queryFn: () => apiClient.getLead(id),
  enabled: !!id,
  staleTime: 60_000, // 1min — dados de detalhe não mudam com alta frequência
})
```

### Largura responsiva

Usar classe Tailwind diretamente no `SheetContent`:
```
className="w-full sm:w-[480px] max-w-full"
```
O Sheet do shadcn/ui já trata o overlay e o posicionamento lateral.

---

## Arquivos a Criar/Modificar

| Arquivo | Operação | Detalhe |
|---------|----------|---------|
| `src/components/SidePanel.tsx` | CRIAR | Sheet + subcomponentes Lead/Deal panel |
| `src/contexts/SidePanelContext.tsx` | CRIAR | Context global de controle |
| `src/components/SidePanelLeadContent.tsx` | CRIAR | Conteúdo específico de lead |
| `src/components/SidePanelDealContent.tsx` | CRIAR | Conteúdo específico de deal |
| `src/App.tsx` ou layout `/app` | MODIFICAR | Provider + `<SidePanel />` global |
| `src/pages/Leads.tsx` ou `LeadTable.tsx` | MODIFICAR | `onClick` nas rows |
| `src/pages/Deals.tsx` ou `DealTable.tsx` | MODIFICAR | `onClick` nas rows |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Layout quebra em telas menores | Média | Médio | Sheet mobile usa full-width automático |
| Click em linha conflita com ações existentes | Média | Médio | `e.stopPropagation()` nos botões de ação |
| Dados desatualizados no panel após edição | Baixa | Baixo | `queryClient.invalidateQueries(['lead', id])` após mutation |
| Sheet + Command Palette abertos ao mesmo tempo | Baixa | Baixo | Esc fecha o mais recente (padrão Radix Dialog stack) |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| `SidePanel.tsx` + conteúdos Lead/Deal | 2h |
| `SidePanelContext.tsx` + integração no layout | 45min |
| Integração em `Leads.tsx` (rows clicáveis) | 30min |
| Integração em `Deals.tsx` | 30min |
| Responsividade + testes manuais | 45min |
| **Total** | **~4.5h** |

---

## Verificação E2E

1. `/app/leads` → clicar em qualquer linha de lead → side panel abre à direita com dados do lead, lista permanece visível
2. Pressionar Esc → panel fecha
3. Clicar em outra linha com panel aberto → conteúdo substitui sem animação de fechar/abrir
4. Clicar em botão "Editar" na linha → panel NÃO abre (stopPropagation)
5. Clicar "Ver completo" → navegar para `/app/leads/:id`
6. Em tela < 1024px → panel abre como sheet full-width sobrepondo a lista

---

*— River, removendo obstáculos 🌊*
*— Data: 2026-06-23*
