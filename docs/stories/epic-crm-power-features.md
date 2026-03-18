# Epic: CRM Power Features — Bulk Actions, Timeline, Team, Dedup, Scoring & Import/Export

**Epic ID:** EPIC-CRMPF
**Tipo:** Feature Enhancement
**Prioridade:** P1 — Features que transformam o CRM de funcional em profissional
**Origem:** Análise de gaps — Morgan (PM) — 2026-02-26
**Data:** 2026-02-26
**Agente:** @pm (Morgan)
**Status:** Done

---

## Epic Summary

O VYD Engage possui um CRM core sólido (leads, tasks, pipeline, automações, email, WhatsApp), mas faltam features "power user" que profissionalizam a experiência. Este epic entrega 6 features independentes que podem ser implementadas em paralelo, cada uma resolvendo um gap concreto identificado pela análise de produto.

**Métricas de sucesso:**
- Usuários conseguem gerenciar 100+ leads sem friction (bulk actions)
- Histórico completo de cada lead visível em timeline (activity timeline)
- Admins gerenciam equipe sem precisar de SQL (team management)
- Zero leads duplicados no sistema (deduplication)
- Score do lead visível e explicável em toda a UI (scoring display)
- Dados entram e saem do CRM facilmente (import/export avançado)

---

## Inventário de Reusos

| Componente | Status | Arquivo | Notas |
|---|---|---|---|
| Lead CRUD + checkboxes | Existe | `src/pages/Leads.tsx` | Já tem seleção e delete em massa |
| Lead model + score field | Existe | `server/prisma/schema.prisma` | `score Int @default(0)` no Lead |
| Interaction model + service | Existe | `server/src/services/interactionService.ts` | Timeline backend 100% pronto |
| User CRUD + roles | Existe | `server/src/routes/users.ts` | GET/PUT com role/status |
| Invitation flow | Existe | `server/src/routes/invitations.ts` | Envio email + accept completo |
| Scoring rules + service | Existe | `server/src/services/scoringService.ts` | processEvent + recalculate |
| Lead import (bulk create) | Existe | `server/src/routes/leads.ts:161-248` | Até 1000 registros, dedup email |
| Email campaign send | Existe | `src/pages/EmailCampaigns.tsx` | Envio bulk funcional |
| useSocket hook | Existe | `src/hooks/useSocket.ts` | WebSocket real-time |
| apiClient | Existe | `src/services/api/client.ts` | Todos os métodos base |
| shadcn/ui components | Existe | `src/components/ui/` | Dialog, Button, Input, Select, etc. |

---

## Stories

---

### Story 1 | Bulk Actions em Leads (Tag, Status, Assign, Export)

**Prioridade:** P1 | **Pontos:** 5 | **Sprint:** 1
**Dependências:** Nenhuma

**Descrição:** Usuários com muitos leads precisam de operações em massa além do delete que já existe. Adicionar: bulk change status, bulk add tag, bulk assign to user, bulk export CSV dos selecionados.

**AC:**
- [x]Backend: `PATCH /api/leads/bulk` aceita `{ ids: string[], action: string, payload: any }`
- [x]Actions suportadas: `change_status`, `add_tag`, `remove_tag`, `assign_user`, `delete`
- [x]Validação: máximo 500 leads por operação, tenant-scoped
- [x]Frontend: barra de ações aparece quando >= 1 lead selecionado
- [x]Barra mostra: count de selecionados + botões (Status, Tag, Atribuir, Exportar, Deletar)
- [x]Cada ação abre modal com opções (ex: selecionar status, selecionar tag, selecionar usuário)
- [x]Export CSV dos selecionados funciona client-side (sem endpoint extra)
- [x]Feedback com toast: "X leads atualizados com sucesso"
- [x]Lista atualiza após operação (reload)
- [x]Testes: selecionar 5 leads, mudar status para QUALIFIED → verificar update

**Dev Notes:**
- Reusar checkboxes e `selectedLeads` state que já existem em `Leads.tsx`
- Barra de ações: sticky no topo da tabela quando seleção ativa
- Backend: usar `prisma.lead.updateMany({ where: { id: { in: ids }, tenantId } })`
- Para tags: `prisma.lead.update()` em loop (tags são relação M:N)
- Export CSV: filtrar `leads` array local pelos IDs selecionados, gerar CSV com ExcelJS ou simples

---

### Story 2 | Lead Activity Timeline (Detail Page)

**Prioridade:** P1 | **Pontos:** 5 | **Sprint:** 1
**Dependências:** Nenhuma

**Descrição:** Criar página de detalhe do lead com timeline de todas as interações (emails, WhatsApp, calls, notas, mudanças de status, automações). Backend já existe completo — precisa apenas do frontend.

**AC:**
- [x]Nova página `LeadDetail.tsx` acessível via `/app/leads/:id`
- [x]Header: nome, email, phone, company, tags, score, status (editáveis inline)
- [x]Timeline vertical mostrando interações ordenadas por data (mais recente primeiro)
- [x]Cada item da timeline mostra: ícone por tipo, conteúdo, data/hora, autor
- [x]Tipos suportados com ícones: EMAIL (📧), WHATSAPP (💬), CALL (📞), MEETING (📅), NOTE (📝), STATUS_CHANGE (🔄), AUTOMATION (⚡)
- [x]Botão "Adicionar nota" para criar interação tipo NOTE
- [x]Sidebar direita: dados do lead (custom fields, score breakdown, datas)
- [x]Clicar num lead na lista (`Leads.tsx`) navega para `/app/leads/:id`
- [x]Paginação na timeline (load more) — usar `GET /api/interactions/leads/:leadId`
- [x]Testes: criar lead, adicionar nota, verificar timeline mostra nota

**Dev Notes:**
- API `GET /api/interactions/leads/:leadId` já retorna tudo
- Layout: split 70/30 (timeline à esquerda, sidebar com dados à direita)
- Reusar pattern visual do modal de execução do AutomationLogs (timeline vertical)
- Lead edit inline: usar PATCH `/api/leads/:id` que já existe
- Custom fields: usar `GET /api/custom-fields` + dados do lead

---

### Story 3 | Team Management Page

**Prioridade:** P1 | **Pontos:** 3 | **Sprint:** 1
**Dependências:** Nenhuma

**Descrição:** Criar página dedicada para administradores gerenciarem a equipe: ver membros, alterar roles, desativar/reativar, enviar convites, ver convites pendentes. Backend 100% pronto.

**AC:**
- [x]Nova página `TeamManagement.tsx` acessível via `/app/team`
- [x]Rota adicionada em `routes.tsx` / `App.tsx`
- [x]Link no sidebar para "Equipe" (ícone Users)
- [x]Tab 1 — Membros: tabela com nome, email, role, status, última atividade
- [x]Botão "Editar" por membro: modal para alterar role (ADMIN/USER/VIEWER) e status (ACTIVE/INACTIVE)
- [x]Tab 2 — Convites: lista de convites pendentes com email, role, data de envio, ação cancelar
- [x]Botão "Convidar membro": modal com email + role selector
- [x]Apenas ADMIN vê esta página (guard no frontend)
- [x]Toast de sucesso/erro em todas as ações
- [x]Testes: convidar membro, verificar na tab de convites, cancelar convite

**Dev Notes:**
- APIs prontas: `GET /api/users`, `PUT /api/users/:id`, `POST /api/invitations`, `GET /api/invitations`, `DELETE /api/invitations/:id`
- Role guard: verificar `user.role === 'ADMIN'` no AuthContext
- Adicionar `getUsers()`, `updateUser()`, `getInvitations()`, `createInvitation()`, `cancelInvitation()` no apiClient (se não existirem)
- Sidebar link: adicionar em `Sidebar.tsx` com ícone `Users` do lucide-react

---

### Story 4 | Lead Deduplication (Detect + Merge)

**Prioridade:** P2 | **Pontos:** 8 | **Sprint:** 2
**Dependências:** Nenhuma

**Descrição:** Detectar leads duplicados automaticamente (por email ou phone exato) e oferecer interface para merge. Previne poluição de dados que compromete métricas e automações.

**AC:**
- [x]Backend: `GET /api/leads/duplicates` retorna grupos de leads com email ou phone duplicado
- [x]Query: agrupa por email (não-null) e phone (não-null), retorna grupos com > 1 match
- [x]Backend: `POST /api/leads/merge` aceita `{ primaryId: string, duplicateIds: string[], mergeFields?: string[] }`
- [x]Merge: move interações, tasks e automation logs do duplicado para o primary
- [x]Merge: deleta leads duplicados após mover referências
- [x]Merge: preserva custom fields do primary (opcionalmente mergeáveis)
- [x]Frontend: página `LeadDuplicates.tsx` acessível via `/app/leads/duplicates`
- [x]Botão "Duplicados" na página Leads leva a esta página
- [x]Lista de grupos duplicados com: leads do grupo, campos conflitantes destacados
- [x]Botão "Merge" por grupo: permite selecionar o lead primary e confirmar
- [x]Warn count no botão: "12 possíveis duplicados"
- [x]Testes: criar 2 leads com mesmo email → aparecem como duplicados → merge → 1 lead restante com interações preservadas

**Dev Notes:**
- Query duplicados:
  ```sql
  SELECT email, COUNT(*) FROM leads WHERE tenant_id = ? AND email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1
  ```
- Merge precisa atualizar FKs: interactions.leadId, tasks.leadId, automationLogs.leadId
- Prisma transaction para atomicidade
- Não usar fuzzy match nesta versão — apenas exact match em email e phone

---

### Story 5 | Live Lead Scoring Enhancement (Breakdown + History)

**Prioridade:** P2 | **Pontos:** 3 | **Sprint:** 2
**Dependências:** Story 2 (timeline mostra score events)

**Descrição:** Score do lead já aparece como badge. Adicionar: modal com breakdown (quais regras contribuíram), mini-chart de evolução do score, e score visível no pipeline kanban.

**AC:**
- [x]Clicar no score badge no `Leads.tsx` abre modal de breakdown
- [x]Modal mostra: score total, lista de regras que contribuíram (nome, pontos, count de eventos)
- [x]Backend: `GET /api/scoring-rules/breakdown/:leadId` retorna breakdown por regra
- [x]Pipeline kanban (`Pipeline.tsx`): mostrar score badge nos cards de lead
- [x]Score badge com cor: verde (>=80), amarelo (40-79), vermelho (<40), cinza (0)
- [x]LeadDetail sidebar (Story 2): mostrar score com breakdown resumido
- [x]Testes: lead com 3 eventos scored → breakdown mostra 3 regras com pontos

**Dev Notes:**
- Breakdown: contar interações do lead agrupadas por tipo, multiplicar pelos pontos da regra ativa
- Não precisa de tabela extra — calcular on-the-fly a partir de interactions + scoreRules
- Score badge component reutilizável: `LeadScoreBadge.tsx` (já deve existir parcialmente)
- Mini-chart opcional: se houver histórico de score (não há hoje), pular para v2

---

### Story 6 | Import/Export Avançado de Leads

**Prioridade:** P2 | **Pontos:** 5 | **Sprint:** 2
**Dependências:** Story 1 (bulk actions pattern)

**Descrição:** Melhorar import/export: download template CSV, preview antes de importar, mapeamento de colunas, export com filtros aplicados (não só selecionados), export em XLSX.

**AC:**
- [x]Botão "Download Template" na página Leads: gera CSV vazio com headers corretos
- [x]Import preview: após upload, mostra tabela com primeiras 10 linhas antes de confirmar
- [x]Mapeamento de colunas: se headers não batem, permitir mapear manualmente (dropdown por coluna)
- [x]Validação visual: linhas com erro destacadas em vermelho antes de importar
- [x]Import progress: barra de progresso durante importação
- [x]Export com filtros: exportar TODOS os leads que correspondem aos filtros ativos (não só os da página)
- [x]Backend: `GET /api/leads/export?status=X&source=Y&...` retorna CSV stream com filtros
- [x]Frontend: botão "Exportar filtrados" na toolbar da lista de leads
- [x]Formato XLSX opcional (usando ExcelJS que já existe no bundle)
- [x]Testes: importar CSV com 5 leads → preview mostra → confirmar → leads aparecem na lista

**Dev Notes:**
- Template CSV: gerar dinamicamente incluindo custom fields do tenant
- Import preview: ler CSV no frontend com FileReader + papa-parse (ou similar)
- Column mapping: comparar headers do CSV com campos esperados, auto-match por similaridade
- Export backend: usar Prisma stream + CSV serialize, ou mandar todos os IDs filtrados
- ExcelJS já está no bundle (438KB) — usar para XLSX export

---

## Sequência de Execução

```
Sprint 1 (paralelo):
  Story 1 (Bulk Actions)     ─────────────►
  Story 2 (Activity Timeline) ─────────────►
  Story 3 (Team Management)   ─────────────►

Sprint 2 (paralelo, após Sprint 1):
  Story 4 (Deduplication)     ─────────────►
  Story 5 (Scoring)           ─────────────► (depende Story 2)
  Story 6 (Import/Export)     ─────────────► (depende Story 1)
```

**Sprint 1:** Stories 1, 2, 3 são 100% independentes → execução paralela com 3 agentes
**Sprint 2:** Stories 4, 5, 6 têm dependências leves → paralelo parcial

---

## Estimativas

| Story | Pontos | Estimativa | Tipo |
|-------|--------|-----------|------|
| Story 1 — Bulk Actions | 5 | Médio | Feature |
| Story 2 — Activity Timeline | 5 | Médio | Feature |
| Story 3 — Team Management | 3 | Baixo | Feature |
| Story 4 — Deduplication | 8 | Médio-Alto | Feature |
| Story 5 — Scoring Enhancement | 3 | Baixo | Enhancement |
| Story 6 — Import/Export | 5 | Médio | Feature |
| **Total** | **29** | | |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Merge de leads corrompe referências | Média | Alto | Usar Prisma transaction; testar com dados reais |
| Bulk update de 500 leads timeout | Baixa | Médio | Usar updateMany, não loop; chunkar se necessário |
| Column mapping impreciso no import | Média | Baixo | Fallback: mapeamento manual sempre disponível |
| Score breakdown slow em tenants grandes | Baixa | Baixo | Limit interactions query; cache se necessário |

---

## Dependências Externas

| Dependência | Status | Notas |
|---|---|---|
| ExcelJS (XLSX export) | Já no bundle | 438KB, já usado em outros exports |
| papa-parse (CSV parse) | A instalar | Lightweight, para import preview |
| Prisma Client | Existe | Todas as queries via Prisma |

---

## Definição de Pronto (Epic-Level)

- [x]Todas as 6 stories implementadas e deployadas
- [x]Bulk actions funcional com 5 operações (status, tag+, tag-, assign, delete)
- [x]Lead detail com timeline mostrando todos os tipos de interação
- [x]Admin consegue convidar, alterar roles e desativar membros
- [x]Duplicados detectados por email/phone com merge funcional
- [x]Score breakdown visível ao clicar no badge
- [x]Import com preview e column mapping; export com filtros + XLSX
- [x]Zero regressão visual nas páginas existentes
- [x]Frontend build sem erros
- [x]Backend build sem erros

---

*Criado por Morgan (PM) — 2026-02-26*
*Base: Análise de gaps do VYD Engage v0.1.0*

---

## Notas de Fechamento

**Fechado por:** Pax (PO) — 2026-03-18
**Commits:** fbc21fe (Sprint 1: Bulk Actions, Lead Timeline, Team Management), 13e8de3 (Sprint 2: Deduplication, Scoring, Import/Export)
**Todos os 6 stories implementados e ACs marcados.**
**QA Gate:** Pendente validação formal — delegar para @qa.
