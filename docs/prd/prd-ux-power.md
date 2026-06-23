# PRD — Épico: UX Power (Experiência de Poder do Usuário)

> **Fonte:** Deep research em projetos OSS do GitHub (jun/2026) — 101 agentes, 13/25 claims verificados.  
> **Referência primária:** [Twenty CRM](https://github.com/twentyhq/twenty) (MIT), [openstatusHQ/data-table-filters](https://github.com/openstatusHQ/data-table-filters), [sadmann7/tablecn](https://github.com/sadmann7/tablecn), [react-kanban-kit](https://github.com/braiekhazem/react-kanban-kit), [react-dnd-kit-tailwind-shadcn-ui](https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui)

---

## Contexto

O VYD Engage tem uma base funcional sólida: pipeline kanban, leads, deals, automações, relatórios, metas por vendedor e dashboard de performance. O próximo salto de valor não é adicionar mais features — é fazer o usuário **mover-se mais rápido** dentro do que já existe.

Usuários avançados (vendedores experientes, gestores) perdem tempo navegando entre páginas para consultar um lead, reaplicando o mesmo conjunto de filtros manualmente, e arrastando cards sem feedback visual claro. O épico UX Power elimina esse atrito com padrões já validados em CRMs modernos open-source.

---

## Personas

| Persona | Perfil | Dor Principal |
|---------|--------|---------------|
| **Vendedor Avançado** | 5+ anos, 40-80 leads ativos, usa CRM como principal ferramenta de trabalho | "Preciso de 3 cliques para ver um detalhe simples. Perco o fio da meada entre telas." |
| **Gestor Comercial** | Supervisiona time, monitora pipeline diariamente | "Filtro por responsável + stage é manual toda vez. Não consigo salvar minha view padrão." |
| **SDR/BDR** | Cadências outbound, follow-ups sequenciais | "Configuro follow-up manual email por email. Não tenho sequência automática com delay." |

---

## Análise de Gaps (vs. CRMs OSS de referência)

| Gap | Referência verificada | Impacto |
|-----|----------------------|---------|
| Sem atalho global (Ctrl+K) | Twenty CRM v0.32.0 — Smart ⌘K contextual | Alto — cada ação requer navegação |
| Sem side panel | Twenty CRM v0.44.0 | Médio — sair da lista para ver detalhes quebra fluxo |
| Filtros básicos, sem salvar views | `openstatusHQ/data-table-filters`, `sadmann7/tablecn` | Alto — retrabalho diário |
| Pipeline sem feedback visual de drag | `react-kanban-kit` (Atlassian pragmatic-dnd) | Médio — UX frustrante em dragging |
| Automações sem Delay step | Twenty CRM docs (Duration + Scheduled Date) | Alto — SDR sequences exigem espera temporal |

---

## Épico: UX Power

### Fase 1 — Navegação (P0 — 2 semanas)

---

**Story 1.1 — Command Palette Global (⌘K / Ctrl+K)**

Como usuário, quero pressionar Ctrl+K em qualquer tela para executar ações rapidamente sem usar o mouse.

*Requisitos funcionais:*
- Atalho global `Ctrl+K` (Windows/Linux) / `⌘K` (Mac) abre palette em qualquer rota
- Itens contextuais adaptados à rota atual:
  - Em `/app/leads`: "Novo Lead", "Exportar CSV", "Filtrar por responsável"
  - Em `/app/pipeline`: "Novo Deal", "Mover para stage", "Ver deal"
  - Em `/app/tasks`: "Nova Tarefa", "Marcar como concluída"
  - Sempre disponível: "Ir para Leads", "Ir para Pipeline", "Ir para Relatórios", "Pesquisar..."
- Search global: digitar nome de lead/deal/empresa abre resultado direto
- Keyboard navigation: setas para cima/baixo, Enter para executar, Esc para fechar
- Histórico das últimas 5 ações (persistido em localStorage por usuário)

*Frontend:* `src/components/CommandPalette.tsx` usando `cmdk` (já é dependência de shadcn/ui). Instalar como Dialog modal sobre qualquer rota. `useCommandPalette` hook registra `Ctrl+K` via `useEffect` + `keydown`.

*Nenhuma mudança no backend.*

---

**Story 1.2 — Side Panel (Quick View sem sair da lista)**

Como vendedor, quero clicar em um lead da lista e ver seus detalhes num painel lateral sem perder o contexto da lista.

*Requisitos funcionais:*
- Click em linha da `LeadTable` (não em ação específica) abre side panel à direita (largura 480px)
- Side panel exibe: nome, empresa, score, stage, telefone, email, última interação, próxima tarefa
- Botão "Ver completo" navega para `/app/leads/:id`
- Botão "Fechar" (X) ou clique fora fecha o panel
- Panel não bloqueia a lista (layout side-by-side, não modal)
- Funciona também em `/app/deals` (side panel de deal)

*Frontend:* `src/components/SidePanel.tsx` (Sheet do shadcn/ui, side="right"). Context `SidePanelContext` para controle global. `LeadTable.tsx` e `DealTable.tsx` recebem `onRowClick` para abrir panel.

*Backend:* reutiliza endpoints existentes `GET /api/v1/leads/:id` e `GET /api/v1/deals/:id`.

---

### Fase 2 — Filtros e Views (P0 — 2 semanas)

---

**Story 2.1 — Filtros Avançados com Query Builder Visual**

Como gestor, quero construir filtros complexos com múltiplas condições e salvá-los para reutilizar.

*Requisitos funcionais:*
- Substituir filtros atuais de Leads por um filter builder:
  - Adicionar condição: campo (nome, email, status, score, responsável, tag, empresa, data criação) + operador (é, não é, contém, maior que, menor que, está vazio) + valor
  - Múltiplas condições com AND implícito
  - Badge contando filtros ativos no botão "Filtros"
- **Salvar view:** botão "Salvar view" → nome → salva no backend (`SavedView` model já existe)
- **Views salvas:** dropdown com views do tenant, click aplica os filtros
- Limpar tudo com um clique
- URL-sync: filtros ativos refletem na URL (query params) para compartilhar link

*Backend:* `SavedView` model já existe (`GET/POST /api/v1/saved-views`). Apenas adicionar suporte a `filters` no campo `config` JSON da view.

*Frontend:* `src/components/FilterBuilder.tsx`. Adaptar `LeadsPage` para usar o novo componente. Referência de implementação UI: `openstatusHQ/data-table-filters` (composable blocks shadcn/ui, MIT).

---

**Story 2.2 — Views Salvas em Deals e Empresas**

Como gestor, quero ter views salvas também no pipeline e na lista de empresas.

*Requisitos funcionais:*
- Mesmo `FilterBuilder` da Story 2.1 integrado em:
  - `/app/deals` (lista de deals): filtros por stage, responsável, valor, funnelId
  - `/app/companies`: filtros por segmento, cidade, número de leads
- Views salvas são **por tenant** e **por página** (não compartilhadas entre páginas)
- Views padrão pré-criadas por template: "Meus deals abertos", "Alta prioridade", "Leads sem atividade 7d"

*Backend:* endpoint existente aceita `page` como discriminador em `SavedView.config`.

---

### Fase 3 — Pipeline Visual (P1 — 1.5 semanas)

---

**Story 3.1 — Pipeline Kanban com Feedback Visual de Drag**

Como vendedor, quero feedback visual claro ao arrastar um deal entre stages (ghost card, drop zone destacada).

*Requisitos funcionais:*
- Ao iniciar drag: card original fica semi-transparente (40% opacity) na coluna de origem
- Ghost card: representação do card segue o cursor com sombra e border azul
- Drop indicator: linha/área destacada entre cards na coluna de destino mostra onde o card vai cair
- Coluna de destino tem highlight (background ligeiramente azulado)
- Keyboard drag: Tab para selecionar card, Enter para iniciar drag, setas para mover entre colunas/posições, Enter para soltar, Esc para cancelar
- Animação suave (200ms) ao soltar o card na nova posição

*Frontend:* `src/pages/Pipeline.tsx` já usa `@dnd-kit`. Atualizar para adicionar `DragOverlay` (ghost card via React portal) e drop indicators. Referência: `react-dnd-kit-tailwind-shadcn-ui` (MIT, `multipleContainersKeyboardPreset`).

*Backend:* nenhuma mudança — `PATCH /api/v1/deals/:id` já existe.

---

### Fase 4 — SDR Sequences (P1 — 2 semanas)

---

**Story 4.1 — Delay Step no Engine de Automações**

Como SDR, quero criar automações com esperas temporais entre steps para cadências de follow-up.

*Requisitos funcionais:*
- Novo node type no editor de automações: **"Aguardar"** (Delay)
  - Modo 1 — Duração: aguardar X dias/horas/minutos após o step anterior
  - Modo 2 — Data específica: aguardar até um campo de data do lead/deal (ex: `followUpDate`)
- UI no editor: ícone de relógio, configuração inline (input de número + select de unidade)
- Backend: ao executar uma automação, steps com Delay são enfileirados com `executeAt = now + duration` em vez de executar imediatamente
- Enquanto aguarda, automação fica em status `waiting` (visível no log de automações)
- Se o lead/deal é deletado durante o wait, o step é cancelado gracefully

*Backend:*
- Campo `executeAt DateTime?` na tabela `AutomationLog` (migration)
- Job `automationEngine.ts` verifica steps pendentes com `executeAt <= now` e os processa
- Sem dependência de Redis para delays curtos (setInterval é suficiente); Redis opcional para delays > 24h

*Frontend:* `src/components/automations/DelayNode.tsx`. Atualizar `AutomationBuilder` para incluir Delay no palette de nodes.

---

## Requisitos Não-Funcionais

- **Multi-tenancy:** views salvas filtradas por `tenantId` em todas as queries
- **CSRF:** `POST /api/v1/saved-views` registrado na whitelist em `server/src/index.ts`
- **Acessibilidade:** Command Palette e Drag-and-drop com suporte a teclado (WCAG 2.1 AA)
- **Performance:** side panel carrega dados em < 300ms (reutiliza cache do TanStack Query)
- **Zero dependências novas pesadas:** `cmdk` já é transitiva de shadcn/ui; `@dnd-kit` já instalado; filtros usam shadcn/ui primitives

---

## Dependências entre Stories

```
1.1 (Command Palette) — independente
1.2 (Side Panel)      — independente
2.1 (Filter Builder)  — independente
2.2 (Views Deals)     — depende de 2.1 (reutiliza FilterBuilder)
3.1 (Pipeline Visual) — independente (já tem @dnd-kit)
4.1 (Delay Step)      — independente
```

Stories 1.1, 1.2, 2.1, 3.1, 4.1 podem ser desenvolvidas em paralelo (sprint 1).
Story 2.2 depende de 2.1 (sprint 2).

---

## Métricas de Sucesso

| Métrica | Baseline | Meta (30 dias pós-deploy) |
|---------|----------|--------------------------|
| Tempo médio para consultar um lead | ~8s (navegação) | < 2s (side panel / Ctrl+K) |
| Usuários que usam filtros avançados | ~20% | > 60% |
| Views salvas criadas por tenant | 0 | ≥ 3 por tenant ativo |
| Cadências de follow-up automatizadas | 0 (manual) | ≥ 1 por SDR ativo |

---

## Faseamento Resumido

| Fase | Stories | Prioridade | Sprint |
|------|---------|-----------|--------|
| Navegação | 1.1 (Ctrl+K), 1.2 (Side Panel) | P0 | 1 |
| Filtros | 2.1 (Filter Builder), 2.2 (Views) | P0 | 1-2 |
| Pipeline | 3.1 (Drag Visual) | P1 | 1 |
| Automação | 4.1 (Delay Step) | P1 | 2 |

---

## Verificação E2E (por fase)

**Fase 1 (Navegação):**
1. Pressionar Ctrl+K → palette abre, digitar "novo lead" → formulário de criação abre
2. Clicar em linha de lead na lista → side panel abre com dados, lista não fecha

**Fase 2 (Filtros):**
3. Adicionar filtro "Status é Qualificado" + "Responsável é João" → lista filtra; salvar como "Leads Quentes João"
4. Acessar view salva no dropdown → filtros reaplicados

**Fase 3 (Pipeline):**
5. Arrastar deal → ghost card segue cursor, coluna de destino destaca, card anima ao soltar

**Fase 4 (SDR Sequences):**
6. Criar automação: "Lead criado → Enviar email → Aguardar 3 dias → Enviar follow-up"
7. Criar lead → verificar log de automação com status `waiting` → após 3 dias (mock `executeAt`) → email follow-up enviado

---

*PRD gerado por @pm (Morgan) — jun/2026 — baseado em deep research verificado (101 agentes, 5 findings confirmados)*
