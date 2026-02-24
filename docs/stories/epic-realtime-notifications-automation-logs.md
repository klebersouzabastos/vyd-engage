# Epic: Real-Time Notifications + Automation Logs

**Epic ID:** EPIC-RTNAL
**Tipo:** Feature Enhancement
**Prioridade:** P1 (User Retention & Trust)
**Origem:** Product Audit — Morgan (PM) — 24 Fev 2026
**Data:** 2026-02-24
**Agente:** @pm (Morgan)
**Status:** Draft

---

## Epic Summary

Ativar o sistema de notificacoes em tempo real (infraestrutura 80% pronta mas 0% utilizada) e aprimorar os Automation Logs (dados gravados mas mal estruturados). O objetivo e transformar o VYD Engage de um CRM passivo ("usuario precisa ir verificar") para um CRM proativo ("sistema avisa o usuario").

### Por que agora?

1. **Notificacoes:** Socket.IO esta rodando, frontend conecta, NotificationCenter UI existe, modelo no banco existe com 7 tipos... mas `notificationService.create()` NUNCA e chamado por nenhuma logica de negocio. Tudo conectado, nada emitindo.
2. **Automation Logs:** Logs sao criados pelo engine, mas campos criticos (leadId, stepType, executionId) estao enterrados em JSON. Frontend faz N+1 queries como workaround. Impossivel filtrar, agrupar ou debugar execucoes.

### Metricas de Sucesso

- Tempo medio de reacao do vendedor a novo lead: reduzir de "quando ele lembrar de olhar" para < 2 minutos
- % de usuarios que identificam automacoes com erro em < 1h: de ~0% para > 80%
- Reducao de queries N+1 na pagina de logs: de N+1 para 1-2 queries

---

## Inventario do que ja existe (REUSAR)

### Notificacoes

| Componente | Status | Arquivo | Notas |
|---|---|---|---|
| Socket.IO server | Rodando | `server/src/services/socketService.ts` | Auth JWT, rooms por user/tenant |
| `emitToUser()` / `emitToTenant()` | Funcional | `server/src/services/socketService.ts` | Pronto para uso |
| `notificationService.create()` | Funcional | `server/src/services/notificationService.ts` | Cria no DB + emite via WS |
| Notification model (Prisma) | Completo | `server/prisma/schema.prisma` | 7 tipos, status, link, metadata |
| Notification API routes | Completo | `server/src/routes/notifications.ts` | GET, mark read, delete |
| `useSocket()` hook | Funcional | `src/hooks/useSocket.ts` | Singleton, ref counting |
| NotificationContext | Funcional | `src/contexts/NotificationContext.tsx` | Escuta `notification:new`, polling fallback |
| NotificationCenter UI | Funcional | `src/components/NotificationCenter.tsx` | Bell icon, popover, grouped |
| NotificationItem UI | Funcional | `src/components/NotificationItem.tsx` | Type icons, read/unread |
| TaskNotificationChecker | Client-side only | `src/components/TaskNotificationChecker.tsx` | Ephemeral, nao persiste |

### Automation Logs

| Componente | Status | Arquivo | Notas |
|---|---|---|---|
| AutomationLog model | Existe (incompleto) | `server/prisma/schema.prisma` | Falta leadId, stepType, executionId como colunas |
| `addLog()` | Funcional | `server/src/services/automationService.ts` | Grava logs, dados extras em JSON |
| automationEngine | Funcional | `server/src/jobs/automationEngine.ts` | Executa steps, cria logs |
| `GET /automations/:id/logs` | Basico | `server/src/routes/automations.ts` | Apenas limit, sem filtros |
| AutomationLogs.tsx | Funcional (workarounds) | `src/pages/AutomationLogs.tsx` | N+1 queries, extrai dados do JSON |
| `getAutomationLogs()` | Basico | `src/services/api/client.ts` | Apenas id + limit |

---

## Stories

### Story 1 | Ativar Notification Triggers na Logica de Negocio
**Prioridade:** P1 | **Pontos:** 5 | **Sprint:** 1
**Descricao:** Adicionar chamadas a `notificationService.create()` nos pontos criticos do negocio. A infraestrutura inteira ja existe — falta apenas wiring.

**Triggers a implementar:**

| Evento | Tipo | Quem recebe | Onde adicionar |
|---|---|---|---|
| Lead criado via formulario publico | `LEAD_ASSIGNED` | Owner do tenant | `server/src/routes/index.ts` (public capture) |
| Lead criado via API | `LEAD_ASSIGNED` | Usuario que criou | `server/src/services/leadService.ts` create() |
| Task criada e atribuida | `TASK_DUE` | assignedTo user | `server/src/services/taskService.ts` create() |
| Task ficou overdue | `TASK_OVERDUE` | assignedTo user | Novo: cron job ou check no taskService |
| Automacao falhou | `AUTOMATION_ERROR` | Owner do tenant | `server/src/jobs/automationEngine.ts` step fail |
| Pagamento falhou | `PAYMENT_FAILED` | Owner do tenant | `server/src/services/paymentService.ts` |
| Assinatura expirando | `SUBSCRIPTION_EXPIRING` | Owner do tenant | Novo: billing job check |

**AC:**
- [ ] Lead criado via formulario publico gera notificacao real-time para o owner do tenant
- [ ] Lead criado via API/UI gera notificacao para o usuario que criou
- [ ] Task atribuida gera notificacao para o assignee
- [ ] Automacao com erro gera notificacao AUTOMATION_ERROR com link para logs
- [ ] Cada notificacao aparece no NotificationCenter sem refresh
- [ ] Cada notificacao e persistida no banco (nao ephemeral)
- [ ] Testes: criar lead via API → verificar notificacao criada no DB

**Dev Notes:**
- Usar `notificationService.create()` que ja faz DB + WebSocket emit
- Formato: `{ userId, tenantId, type, title, message, link, metadata }`
- `link` deve apontar para a entidade relevante (ex: `/app/leads/${leadId}`)
- Tasks overdue: considerar check a cada 15min via setInterval no server ou BullMQ scheduled job

---

### Story 2 | Alinhar Tipos de Notificacao Frontend ↔ Backend
**Prioridade:** P1 | **Pontos:** 2 | **Sprint:** 1
**Descricao:** Corrigir mismatch de tipos entre backend (UPPER_SNAKE) e frontend (lowercase). Garantir que todos os 7 tipos do backend sao renderizados corretamente no frontend.

**Mismatch atual:**
```
Backend:  TASK_DUE, TASK_OVERDUE, LEAD_ASSIGNED, AUTOMATION_ERROR, PAYMENT_FAILED, SUBSCRIPTION_EXPIRING, SYSTEM
Frontend: task_due, task_overdue, new_lead, interaction, automation_failed (incompleto)
```

**AC:**
- [ ] NotificationContext converte tipos do backend corretamente
- [ ] NotificationItem renderiza icone e cor para todos os 7 tipos
- [ ] Tipos `PAYMENT_FAILED` e `SUBSCRIPTION_EXPIRING` tem icone e label
- [ ] Tipo `SYSTEM` tem icone generico
- [ ] Nenhum tipo chega como "unknown" ou sem icone
- [ ] Testes: mock de cada tipo → verificar render correto

**Arquivos a modificar:**
- `src/contexts/NotificationContext.tsx` — mapping de tipos
- `src/components/NotificationItem.tsx` — icones e cores por tipo
- `src/types/` — atualizar interface Notification se necessario

---

### Story 3 | Migrar TaskNotificationChecker para Backend
**Prioridade:** P2 | **Pontos:** 3 | **Sprint:** 1
**Descricao:** Substituir o `TaskNotificationChecker` client-side (ephemeral, perde no refresh) por notificacoes geradas no backend. Criar um job que verifica tarefas overdue/due-today e gera notificacoes persistentes.

**AC:**
- [ ] Job backend roda a cada 15 minutos verificando tarefas overdue
- [ ] Tarefas que vencem hoje geram notificacao `TASK_DUE` ao amanhecer (1x/dia)
- [ ] Tarefas overdue geram notificacao `TASK_OVERDUE` (1x por tarefa, nao repete)
- [ ] Deduplicacao: nao criar notificacao se ja existe uma UNREAD para mesma task
- [ ] TaskNotificationChecker removido ou simplificado (sem criar notificacoes)
- [ ] Notificacao inclui link direto para a tarefa: `/app/tasks` ou `/app/tasks/${taskId}`
- [ ] Testes: criar task com dueDate no passado → verificar notificacao criada

**Dev Notes:**
- Usar BullMQ repeatable job (padrao ja usado em billing.ts)
- Query: `WHERE status != 'COMPLETED' AND dueDate < NOW()` para overdue
- Metadata da notificacao: `{ taskId, taskTitle, dueDate }`

---

### Story 4 | Aprimorar Schema do AutomationLog
**Prioridade:** P1 | **Pontos:** 5 | **Sprint:** 1
**Descricao:** Adicionar colunas dedicadas ao AutomationLog para dados que atualmente estao enterrados no campo JSON `data`. Isso permite queries eficientes, filtragem no banco, e eliminacao do N+1 no frontend.

**Alteracoes no schema:**
```prisma
model AutomationLog {
  // Campos existentes mantidos
  id           String              @id @default(uuid())
  automationId String
  automation   Automation          @relation(fields: [automationId], references: [id], onDelete: Cascade)
  status       AutomationLogStatus
  message      String?
  data         Json?
  error        String?
  createdAt    DateTime            @default(now())

  // NOVOS campos
  leadId       String?
  lead         Lead?               @relation(fields: [leadId], references: [id], onDelete: SetNull)
  stepOrder    Int?
  stepType     String?             // send_email, send_whatsapp, delay, update_lead, etc.
  executionId  String?             // Agrupa steps da mesma execucao

  @@index([automationId])
  @@index([createdAt])
  @@index([leadId])              // NOVO
  @@index([executionId])         // NOVO
  @@index([status])              // NOVO
}
```

**AC:**
- [ ] Migration criada e aplicada com sucesso
- [ ] Novos campos: `leadId` (FK nullable), `stepOrder`, `stepType`, `executionId`
- [ ] Indices adicionados em leadId, executionId, status
- [ ] Relacao `lead Lead?` com onDelete: SetNull
- [ ] `automationEngine.ts` atualizado para popular campos diretamente (nao so no JSON)
- [ ] Logs existentes no banco nao sao afetados (campos novos sao nullable)
- [ ] `npm run prisma:migrate` e `npm run build` passam sem erro
- [ ] Testes: executar automacao → verificar que leadId e stepType estao preenchidos

**Dev Notes:**
- Migration deve ser safe (ADD COLUMN, nullable, sem data loss)
- automationEngine.ts linhas ~298-303: atualizar `addLog()` para incluir novos campos
- automationService.ts `addLog()`: adicionar parametros opcionais leadId, stepOrder, stepType, executionId
- Manter campo `data` JSON para metadados extras (nao remover)

---

### Story 5 | API de Logs com Filtros, Paginacao e Endpoint Tenant-Wide
**Prioridade:** P1 | **Pontos:** 5 | **Sprint:** 2
**Descricao:** Evoluir a API de automation logs para suportar filtragem real no banco, paginacao, e consulta por tenant (elimina N+1 do frontend).

**Endpoints:**

| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/api/automation-logs` | **NOVO** — Todos os logs do tenant (com filtros) |
| GET | `/api/automations/:id/logs` | **MELHORAR** — Logs de 1 automacao (com filtros) |
| GET | `/api/automation-logs/execution/:executionId` | **NOVO** — Steps de 1 execucao agrupados |
| GET | `/api/automation-logs/stats` | **NOVO** — Metricas agregadas do tenant |

**Filtros suportados (query params):**
- `status` — SUCCESS, ERROR, SKIPPED
- `leadId` — Filtrar por lead
- `stepType` — Filtrar por tipo de step
- `automationId` — Filtrar por automacao (no endpoint tenant-wide)
- `from` / `to` — Date range
- `page` / `limit` — Paginacao (default limit=50, max=200)
- `sort` — createdAt ASC/DESC (default DESC)

**AC:**
- [ ] `GET /api/automation-logs` retorna logs paginados do tenant com filtros
- [ ] `GET /api/automations/:id/logs` aceita filtros (status, leadId, stepType, dateRange)
- [ ] `GET /api/automation-logs/execution/:executionId` retorna todos os steps agrupados
- [ ] `GET /api/automation-logs/stats` retorna: total, por status, por automacao, taxa de sucesso
- [ ] Response inclui `{ data: [...], pagination: { page, limit, total, totalPages } }`
- [ ] Queries usam indices (leadId, executionId, status) — nao full table scan
- [ ] Testes: filtrar por status=ERROR → verificar apenas errors retornados

**Dev Notes:**
- Criar `server/src/routes/automationLogs.ts` para os novos endpoints
- Registrar no `server/src/index.ts`
- Reutilizar middleware existente (auth, tenant, apiLimiter)
- Stats query: usar `groupBy` do Prisma para agregar por status/automationId

---

### Story 6 | Frontend: Refatorar AutomationLogs.tsx
**Prioridade:** P1 | **Pontos:** 5 | **Sprint:** 2
**Descricao:** Refatorar a pagina de Automation Logs para usar a nova API (Story 5), eliminando o padrao N+1 e os workarounds de extracao de JSON.

**Mudancas:**

| Antes (atual) | Depois |
|---|---|
| Carrega 20 automacoes, faz 20 requests de logs | 1 request: `GET /api/automation-logs` |
| Extrai stepType do `data` JSON | Usa campo `stepType` direto |
| Extrai leadId do `data` JSON | Usa campo `leadId` direto + `lead.name` |
| Sem paginacao real | Paginacao server-side |
| Filtros client-side | Filtros via query params |

**AC:**
- [ ] Pagina carrega com 1-2 requests (logs + stats), nao N+1
- [ ] Filtro por automacao funciona via API (nao client-side)
- [ ] Filtro por status funciona via API
- [ ] Filtro por lead funciona via API
- [ ] Filtro por date range funciona
- [ ] Paginacao funciona (botoes prev/next, total de paginas)
- [ ] Clicar em executionId abre todos os steps daquela execucao
- [ ] Metricas (total, success rate, chart) usam endpoint de stats
- [ ] Performance: tempo de carregamento < 2s
- [ ] Sem regressao visual (layout, cores, icones mantidos)

**Dev Notes:**
- Atualizar `apiClient` com novos metodos: `getAutomationLogsAll(filters)`, `getLogsByExecution(executionId)`, `getAutomationLogStats()`
- Manter tab Metricas com chart de 14 dias (usar dados do stats endpoint)
- Adicionar "Execution View": clicar num log mostra todos os steps daquela run

---

### Story 7 | Notificacao Real-Time para Falha de Automacao + Streaming de Logs
**Prioridade:** P2 | **Pontos:** 3 | **Sprint:** 2
**Descricao:** Quando uma automacao falha, alem de gravar no log, emitir notificacao real-time para o owner do tenant. Tambem adicionar streaming de logs novos via WebSocket na pagina de logs.

**AC:**
- [ ] Automacao com step que falha emite `notification:new` com tipo `AUTOMATION_ERROR`
- [ ] Notificacao inclui: nome da automacao, nome do lead, tipo do step que falhou, mensagem de erro
- [ ] Link na notificacao aponta para `/app/automation-logs` com filtro pre-aplicado
- [ ] Na pagina AutomationLogs: novos logs aparecem em real-time sem refresh
- [ ] WebSocket event `automation:log:new` emitido quando log e criado
- [ ] Frontend escuta evento e prependa log na lista (se filtros compatem)
- [ ] Toast "Nova execucao registrada" ao receber log em real-time
- [ ] Testes: disparar automacao com step invalido → verificar notificacao + log streaming

**Dev Notes:**
- No `automationEngine.ts`, apos `addLog()` com status ERROR, chamar `notificationService.create()` E `emitToTenant(tenantId, 'automation:log:new', logData)`
- Frontend: `useSocket()` no AutomationLogs.tsx escutando `automation:log:new`
- Deduplicar: nao adicionar log se ja existe na lista (check por id)

---

## Sequencia de Execucao

```
Sprint 1 (Stories 1-4):
  Story 2 (Alinhar tipos)      ← sem dependencia, pode comecar primeiro
  Story 4 (Schema migration)   ← sem dependencia, pode comecar primeiro
  Story 1 (Notification wiring) ← depende de Story 2 para tipos corretos
  Story 3 (Task checker migration) ← depende de Story 1 para infra

Sprint 2 (Stories 5-7):
  Story 5 (API de logs)        ← depende de Story 4 (schema)
  Story 6 (Frontend logs)      ← depende de Story 5 (API)
  Story 7 (RT logs + notif)    ← depende de Story 5 + Story 1
```

```
     Story 2 ──────────→ Story 1 ──→ Story 3
                              │
     Story 4 ──→ Story 5 ──→ Story 6
                    │
                    └──────→ Story 7
```

---

## Estimativas

| Story | Pontos | Estimativa | Tipo |
|---|---|---|---|
| 1. Notification Triggers | 5 | 1-2 dias | Backend |
| 2. Type Alignment | 2 | 0.5 dia | Full-stack |
| 3. Task Checker Migration | 3 | 1 dia | Full-stack |
| 4. Schema Migration | 5 | 1-2 dias | Backend + DB |
| 5. API Logs Avancada | 5 | 1-2 dias | Backend |
| 6. Frontend Logs Refactor | 5 | 1-2 dias | Frontend |
| 7. RT Streaming + Notif | 3 | 1 dia | Full-stack |
| **Total** | **28** | **~7-10 dias** | |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| Migration quebra dados existentes | Baixa | Alta | Campos novos nullable, migration reversivel |
| WebSocket desconecta em producao | Media | Media | Polling fallback ja existe (5min) |
| Volume de notificacoes excessivo | Media | Media | Deduplicacao + throttle por tipo/entidade |
| BullMQ nao habilitado em prod | Alta | Alta | Verificar `ENABLE_AUTOMATION_ENGINE` no Render |
| CORS bloqueia WebSocket em prod | Baixa | Alta | Ja configurado para `engage.vydhub.com` |

---

## Dependencias Externas

- Redis rodando (para BullMQ jobs — task checker, automation engine)
- `ENABLE_AUTOMATION_ENGINE=true` no Render (verificar)
- WebSocket suportado pelo plano do Render (verificar)

---

## Definicao de Pronto (Epic-Level)

- [ ] Vendedor recebe notificacao real-time quando lead entra pelo formulario publico
- [ ] Vendedor recebe notificacao quando tarefa esta vencendo
- [ ] Gestor consegue ver todos os logs de automacao filtrados por lead, status, tipo
- [ ] Gestor consegue ver todos os steps de uma execucao agrupados
- [ ] Logs aparecem em real-time na pagina sem refresh
- [ ] Zero notificacoes perdidas (todas persistidas no banco)
- [ ] Frontend carrega logs em < 2s (sem N+1)

---

*Criado por Morgan (PM) em 24 Fev 2026*
*Base: Product audit completo — frontend (26 paginas) + backend (21 rotas, 27 modelos)*
