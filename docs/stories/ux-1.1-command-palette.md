# Story: Command Palette Global (Ctrl+K / ⌘K)

**Story ID:** UX-1.1
**Epic:** EPIC-UX-POWER (UX Power — Experiência de Poder do Usuário)
**Tipo:** Feature
**Prioridade:** P0
**Pontos:** 5
**Sprint:** 1
**Fase:** 1 — Navegação (paralelo com UX-1.2)
**Dependências:** Nenhuma
**Desbloqueia:** UX-1.2 (padrão de atalho estabelecido)
**Status:** Done
**Agente:** @sm (River) — draft | @po (Pax) — validado 2026-06-23 | @dev (Dex) — implementado 2026-06-23

---

## Descrição

Como usuário do VYD Engage, quero pressionar Ctrl+K (Windows/Linux) ou ⌘K (Mac) em qualquer tela para executar ações e navegar rapidamente sem usar o mouse. O objetivo é eliminar o custo de navegação multi-clique para ações frequentes: criar entidades, navegar entre páginas e pesquisar leads/deals/empresas.

**Problema:** Cada ação comum (criar lead, navegar para pipeline, pesquisar contato) requer 2-4 cliques e troca de contexto de tela. Usuários avançados querem operar via teclado.

**Referência OSS verificada:** Twenty CRM v0.32.0 — Smart ⌘K contextual (implementação pública, MIT license).

---

## Acceptance Criteria

### AC-1: Ativação do Atalho
- [ ] Ctrl+K (Windows/Linux) abre a palette em qualquer rota `/app/*`
- [ ] ⌘K (Mac) abre a palette em qualquer rota `/app/*`
- [ ] Esc fecha a palette
- [ ] Clique fora da palette fecha
- [ ] Abrir palette enquanto já está aberta não duplica
- [ ] Atalho não dispara dentro de `<input>`, `<textarea>` ou `[contenteditable]` com foco ativo

### AC-2: Itens Contextuais por Rota
- [ ] Em `/app/leads`: exibe "Novo Lead", "Exportar CSV", "Filtrar por responsável"
- [ ] Em `/app/pipeline` ou `/app/deals`: exibe "Novo Deal", "Ver deal", "Mover para stage"
- [ ] Em `/app/tasks`: exibe "Nova Tarefa", "Marcar como concluída"
- [ ] Sempre disponível (independente de rota): "Ir para Leads", "Ir para Pipeline", "Ir para Relatórios", "Ir para Tarefas", "Ir para Configurações", "Pesquisar..."

### AC-3: Pesquisa Global
- [ ] Digitar texto na palette filtra itens por nome/label
- [ ] Digitar texto pesquisa leads por nome (busca `GET /api/v1/leads?search=` via TanStack Query, debounce 300ms)
- [ ] Resultado de lead exibe nome + empresa + stage, click navega para `/app/leads/:id`
- [ ] Pesquisa com 0 resultados exibe mensagem "Nenhum resultado para &lt;query&gt;"

### AC-4: Navegação por Teclado
- [ ] Setas ↑↓ navegam entre itens da lista
- [ ] Enter executa o item selecionado
- [ ] Item selecionado tem highlight visual (anel de foco ou background)
- [ ] Foco inicia automaticamente no input de pesquisa ao abrir

### AC-5: Histórico
- [ ] Últimas 5 ações executadas são exibidas no topo quando a pesquisa está vazia
- [ ] Histórico persiste em `localStorage` com chave `cmd_palette_history_{userId}`
- [ ] Histórico limita-se a 5 itens (FIFO — remove o mais antigo ao adicionar novo)

### AC-6: Backend
- [ ] Nenhuma mudança no backend necessária (usa endpoints existentes `GET /api/v1/leads`)

---

## Dev Notes

### Implementação

**Dependência:** `cmdk` — já é dependência transitiva de `shadcn/ui`. **Não instalar nova dependência.**

Verificar com: `cat package.json | grep cmdk` (espera-se versão ^0.2.x via radix-ui ou diretamente)

Se não estiver no `package.json` diretamente: `npm install cmdk` (< 5KB gzip, MIT).

### Arquivos a criar

**`src/components/CommandPalette.tsx`**
```tsx
import { Command } from 'cmdk'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useCommandPalette } from '@/hooks/useCommandPalette'

export function CommandPalette() {
  const { open, setOpen, items, query, setQuery, execute } = useCommandPalette()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 overflow-hidden" style={{ maxWidth: 560 }}>
        <Command>
          <Command.Input placeholder="Pesquisar ações..." value={query} onValueChange={setQuery} />
          <Command.List>
            <Command.Empty>Nenhum resultado para &quot;{query}&quot;</Command.Empty>
            {/* groups: recentes, contextuais, navegação, resultados */}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
```

**`src/hooks/useCommandPalette.ts`**
- Estado: `open`, `query`, `history` (localStorage)
- `useEffect` com listener `keydown` — abre em `Ctrl+K` / `⌘K`, fecha em `Esc`
- Guarda `Ctrl+K` quando `e.target` é input/textarea com `e.target.tagName` check
- `useLocation()` do React Router para inferir itens contextuais
- `useQuery` (TanStack) para busca de leads quando `query.length > 2`

### Integração em App

Em `src/App.tsx` (ou no layout de rotas `/app/*`), montar `<CommandPalette />` fora do `<Outlet />` para que seja global:

```tsx
// Dentro do layout protegido, fora do conteúdo de página:
<CommandPalette />
<Outlet />
```

### Itens contextuais — estrutura de dados

```typescript
interface PaletteItem {
  id: string
  label: string
  icon?: LucideIcon
  group: 'recent' | 'contextual' | 'navigation' | 'search'
  action: () => void
  keywords?: string[]
}
```

### localStorage schema

```json
{
  "cmd_palette_history_<userId>": ["item-id-1", "item-id-2", "item-id-3"]
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação | Detalhe |
|---------|----------|---------|
| `src/components/CommandPalette.tsx` | CRIAR | Componente principal com `cmdk` |
| `src/hooks/useCommandPalette.ts` | CRIAR | Hook com estado, atalhos, histórico |
| `src/App.tsx` ou layout `/app` | MODIFICAR | Montar `<CommandPalette />` globalmente |
| `package.json` | MODIFICAR SE NECESSÁRIO | Adicionar `cmdk` se não for transitivo |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `cmdk` não estar disponível como transitivo | Baixa | Baixo | `npm install cmdk` — < 5KB |
| Conflito de Ctrl+K com atalho do browser | Baixa | Médio | `e.preventDefault()` resolve |
| Atalho dispara dentro de inputs | Média | Baixo | `document.activeElement.tagName` check |
| Pesquisa global com muitos tenants lentos | Baixa | Médio | Debounce 300ms + limite `take: 5` |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| `CommandPalette.tsx` + `useCommandPalette.ts` | 2h |
| Integração global no App layout | 30min |
| Itens contextuais por rota | 1h |
| Pesquisa global de leads | 45min |
| Histórico localStorage | 30min |
| Testes manuais + keyboard navigation | 45min |
| **Total** | **~5.5h** |

---

## Verificação E2E

1. Navegar para `/app/leads` → pressionar Ctrl+K → palette abre com itens "Novo Lead", "Ir para Pipeline"
2. Digitar "João" → resultados de leads filtrados com nome/empresa
3. Selecionar "Novo Lead" com Enter → formulário de criação abre, palette fecha
4. Executar "Ir para Pipeline" → reabre palette → "Ir para Pipeline" aparece no grupo "Recentes"
5. Navegar para `/app/tasks` → abrir palette → itens contextuais de task visíveis

---

*— River, removendo obstáculos 🌊*
*— Data: 2026-06-23*
