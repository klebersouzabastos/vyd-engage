# Epic: Integration Hub — Google Calendar Sync, Zapier Webhooks & CSV/XLSX Export

**Epic ID:** EPIC-CONNECT
**Tipo:** Integration & Export Enhancement
**Prioridade:** P1 — Integracao com ecossistema externo fecha gap competitivo critico
**Origem:** Analise competitiva — Morgan (PM) — 2026-03-18
**Data:** 2026-03-18
**Agente:** @pm (Morgan)
**Status:** Draft
**Estimativa Total:** ~11 pontos

---

## Epic Summary

O VYD Engage possui webhooks outgoing funcionais, calendar views para Tasks (month/week/agenda com drag-and-drop) e export JSON de leads. Porem, concorrentes oferecem Google Calendar sync nativo, integracao Zapier out-of-the-box e export CSV/Excel. Este epic fecha esses 3 gaps com 3 stories independentes que podem ser implementadas em paralelo.

**Gap Analysis:**

| Feature | Estado Atual | Concorrentes | Gap |
|---------|-------------|-------------|-----|
| Calendar sync | Views internas apenas (month/week/agenda) | Google Calendar sync bidirecional | Tasks nao aparecem no calendario do usuario |
| Zapier integration | Webhook generico com payload custom | Zapier-ready webhooks + sample payloads | Payload nao segue padrao Zapier, faltam eventos de Deal |
| Export CSV/XLSX | `GET /api/leads/export` retorna JSON (take: 10000) | CSV + Excel + PDF com custom fields | Usuarios precisam converter JSON manualmente |

**Metricas de sucesso:**
- Tasks do VYD Engage aparecem no Google Calendar do usuario em < 5 segundos apos criacao
- Webhook Zapier funciona sem configuracao custom (payload padrao compativel)
- Export de 5000+ leads em XLSX completa em < 10 segundos
- 100% dos custom fields e tags incluidos no export

---

## Inventario de Reusos

| Componente | Status | Arquivo | Notas |
|---|---|---|---|
| Webhook CRUD completo | Existe | `server/src/routes/outgoingWebhooks.ts` | GET/POST/PUT/DELETE + test + logs |
| WebhookService com dispatch | Existe | `server/src/services/webhookService.ts` | HMAC-SHA256 signature, test endpoint |
| Webhook model + logs | Existe | `server/prisma/schema.prisma` (Webhook, WebhookLog) | events[], secret, success/failure count |
| WEBHOOK_EVENTS array | Existe | `server/src/services/webhookService.ts:18-28` | 9 eventos: lead.*, task.*, automation.*, payment.* |
| Task CRUD + calendar views | Existe | `server/src/routes/tasks.ts` + `src/pages/Tasks.tsx` | Filtros por date range, status, priority |
| Calendar components | Existe | `src/components/calendar/` | MonthView, WeekView, AgendaView, QuickAdd, Popover |
| Task model completo | Existe | `schema.prisma` (Task) | title, description, status, priority, dueDate, assignedTo, leadId, dealId |
| Lead export JSON | Existe | `server/src/routes/leads.ts:266-296` | `GET /api/leads/export` com filtros, include tags, take 10000 |
| Lead model + custom fields | Existe | `schema.prisma` (Lead) | customFields Json, tags M:N, score, assignedTo |
| Deal model | Existe | `schema.prisma` (Deal) | stage, value, probability, expectedCloseDate |
| ExcelJS (frontend) | Instalado | `package.json` (root) | `"exceljs": "^4.4.0"` — apenas no frontend |
| NotificationService | Existe | `server/src/services/notificationService.ts` | create() com tipo, titulo, link, metadata |
| Tenant settings JSON | Existe | `schema.prisma` (Tenant.settings) | JSON livre — pode armazenar config de integracao |
| apiClient | Existe | `src/services/api/client.ts` | Base HTTP client para frontend |
| shadcn/ui components | Existe | `src/components/ui/` | Dialog, Button, Select, Tabs, Switch, etc. |

---

## Stories

---

### Story 1 | Google Calendar Sync (One-Way Push)

**Prioridade:** P1 | **Pontos:** 5 | **Sprint:** 1
**Dependencias:** Nenhuma

**Descricao:** Permitir que usuarios conectem sua conta Google e sincronizem Tasks do VYD Engage como eventos no Google Calendar. Sync one-way (VYD -> Google): criar/atualizar/deletar tasks reflete automaticamente no Google Calendar. Configuravel por usuario via pagina de Settings.

**AC:**

**Backend — OAuth2 + Google Calendar API:**
- [ ] `POST /api/integrations/google/auth` — gera URL de OAuth2 consent (Google Calendar scope)
- [ ] `GET /api/integrations/google/callback` — recebe authorization code, troca por access/refresh token
- [ ] Tokens armazenados de forma segura (encrypted) na tabela `GoogleCalendarIntegration` (nova)
- [ ] `DELETE /api/integrations/google/disconnect` — revoga tokens e remove integracao
- [ ] `GET /api/integrations/google/status` — retorna se usuario esta conectado + email da conta Google

**Backend — Sync Engine:**
- [ ] Service `googleCalendarService.ts` com metodos: `createEvent`, `updateEvent`, `deleteEvent`
- [ ] Ao criar Task com dueDate → cria evento no Google Calendar (titulo = task title, data = dueDate)
- [ ] Ao atualizar Task (titulo, dueDate, status) → atualiza evento correspondente
- [ ] Ao deletar Task → deleta evento no Google Calendar
- [ ] Ao completar Task → marca evento como "completed" (description update ou color change)
- [ ] Armazenar `googleEventId` no Task (novo campo opcional) para tracking do sync
- [ ] Timezone handling: usar timezone do usuario (armazenar em User ou Tenant settings)
- [ ] Retry com backoff exponencial em caso de falha na API do Google (max 3 tentativas)
- [ ] Rate limit respeitado: Google Calendar API permite 500 requests/100 seconds/user

**Frontend — Settings UI:**
- [ ] Nova tab "Integracoes" na pagina de Settings (ou nova pagina `/app/settings/integrations`)
- [ ] Card "Google Calendar" com: status da conexao, email conectado, botao Connect/Disconnect
- [ ] Botao "Conectar Google Calendar" inicia fluxo OAuth2 (redirect)
- [ ] Apos callback com sucesso, mostra email conectado + toggle "Sync ativo"
- [ ] Toggle para ativar/desativar sync sem desconectar a conta
- [ ] Indicador visual na pagina de Tasks quando sync esta ativo (icone Google Calendar no header)

**Database:**
- [ ] Nova tabela `GoogleCalendarIntegration`: userId, tenantId, accessToken (encrypted), refreshToken (encrypted), email, calendarId, syncEnabled, connectedAt
- [ ] Novo campo opcional `googleEventId String?` no model Task
- [ ] Migration gerada e aplicavel sem downtime

**Testes:**
- [ ] Criar task com dueDate, verificar que evento e criado no Google Calendar (mock API)
- [ ] Atualizar dueDate de task, verificar que evento e atualizado
- [ ] Deletar task, verificar que evento e removido
- [ ] Desconectar conta, verificar que tokens sao revogados
- [ ] Task sem dueDate nao gera evento
- [ ] Falha na API do Google nao bloqueia criacao da task (async, fail silently com log)

**Dev Notes:**
- Usar `googleapis` npm package (Google official SDK)
- OAuth2 scopes necessarios: `https://www.googleapis.com/auth/calendar.events`
- Google Cloud Console: criar OAuth2 credentials (Client ID + Secret) — variaveis de ambiente
- Sync deve ser **assincrono** — nao bloquear CRUD de tasks. Usar pattern fire-and-forget com error logging
- Hooks nos endpoints de task (`POST /`, `PUT /:id`, `DELETE /:id`) em `server/src/routes/tasks.ts` para disparar sync
- Alternativa: usar BullMQ job queue (Redis ja configurado) para processar sync em background
- `googleEventId` no Task permite update/delete sem lookup adicional
- Considerar `Tenant.settings` para armazenar timezone default do tenant
- Frontend: redirect OAuth2 vai para `/api/integrations/google/auth`, callback retorna para `/app/settings/integrations?google=connected`

---

### Story 2 | Zapier-Compatible Webhook Format

**Prioridade:** P2 | **Pontos:** 3 | **Sprint:** 1
**Dependencias:** Nenhuma

**Descricao:** Padronizar o payload dos outgoing webhooks para formato compativel com Zapier/Make/n8n. Adicionar novos event types para Deals. Adicionar botao "Test Webhook" com sample payload por evento. Isso habilita integracao Zapier sem necessidade de connector customizado.

**AC:**

**Backend — Payload Standardization:**
- [ ] Payload padrao para todos os eventos segue formato Zapier-friendly:
  ```json
  {
    "id": "evt_uuid",
    "event": "lead.created",
    "created_at": "2026-03-18T10:00:00Z",
    "api_version": "2026-03",
    "data": {
      "id": "lead_uuid",
      "name": "John Doe",
      "email": "john@example.com",
      ...campos flat (sem nesting desnecessario)
    }
  }
  ```
- [ ] Todos os campos `DateTime` no formato ISO 8601
- [ ] Campos `Decimal` como string (evitar precision loss)
- [ ] Tags como array de strings `["tag1", "tag2"]` (nao objetos nested)
- [ ] Custom fields como objeto flat: `{ "custom_campo1": "valor1" }`

**Backend — Novos Event Types:**
- [ ] Adicionar ao `WEBHOOK_EVENTS`: `deal.created`, `deal.updated`, `deal.stage_changed`, `deal.won`, `deal.lost`
- [ ] Total de eventos apos adição: 14 (9 existentes + 5 novos de Deal)
- [ ] Cada evento tem sample payload documentado internamente

**Backend — Test Webhook Improvement:**
- [ ] `POST /api/outgoing-webhooks/:id/test` aceita `{ event?: string }` opcional
- [ ] Se `event` fornecido, envia sample payload realista daquele evento (nao apenas "test message")
- [ ] Sample payloads gerados com dados fake mas estrutura identica a producao
- [ ] Response inclui: `{ success, statusCode, responseTime, payload }` para debugging

**Backend — Webhook Dispatch Integration:**
- [ ] Criar `webhookDispatcher.ts` que intercepta eventos de negocio e dispara webhooks
- [ ] Hook em: `leadService.create()`, `leadService.update()`, `dealService.create()`, `dealService.update()`, `taskService.complete()`
- [ ] Dispatcher busca webhooks ativos do tenant com evento matching e envia async
- [ ] Cada dispatch cria `WebhookLog` com payload enviado, status, response time

**Frontend:**
- [ ] Na pagina de webhooks, dropdown "Evento de teste" aparece ao lado do botao "Testar"
- [ ] Dropdown lista todos os event types disponiveis
- [ ] Ao clicar "Testar", envia payload do evento selecionado
- [ ] Modal de resultado mostra: status code, response time, payload enviado (copiavel)
- [ ] Documentacao inline: tooltip ou collapsible section com schema do payload por evento

**Testes:**
- [ ] Payload de `lead.created` contem todos os campos esperados (flat, ISO dates, tags as strings)
- [ ] Payload de `deal.stage_changed` contem `previous_stage` e `new_stage`
- [ ] Test webhook com evento especifico envia sample payload correto
- [ ] Webhook dispatch funciona async — criacao de lead nao fica mais lenta
- [ ] Webhooks inativos nao recebem dispatch

**Dev Notes:**
- Payload atual do test (`webhookService.testWebhook`) e generico `{ event: 'test', data: { message: '...' } }` — manter como fallback para teste sem evento especifico
- `WEBHOOK_EVENTS` em `webhookService.ts:18-28` ja tem 9 eventos — estender o array
- Novo `webhookDispatcher.ts` deve ser chamado nos services (nao nas routes) para capturar todas as mutacoes
- Pattern: `webhookDispatcher.emit('lead.created', tenantId, leadData)` — busca webhooks e envia
- Signature HMAC-SHA256 ja implementada em `testWebhook()` — reusar pattern
- Headers padrao Zapier-friendly: `X-Webhook-Event`, `X-Webhook-Signature`, `X-Webhook-Delivery-Id`
- Referencia de formato: https://docs.zapier.com/platform/build/trigger/rest-hook

---

### Story 3 | CSV/XLSX Export Enhancement

**Prioridade:** P1 | **Pontos:** 3 | **Sprint:** 1
**Dependencias:** Nenhuma

**Descricao:** Atual export de leads e JSON only (`GET /api/leads/export`). Adicionar suporte a CSV e XLSX com todos os campos (incluindo custom fields e tags). Adicionar export de Deals e Tasks. Download via botao com seletor de formato. Geracao server-side com streaming para datasets grandes.

**AC:**

**Backend — Export Endpoints:**
- [ ] `GET /api/leads/export?format=json|csv|xlsx` — formato via query param (default: json para backward compat)
- [ ] `GET /api/deals/export?format=json|csv|xlsx` — novo endpoint
- [ ] `GET /api/tasks/export?format=json|csv|xlsx` — novo endpoint
- [ ] Todos os endpoints aceitam os mesmos filtros que as rotas de listagem (status, search, dateRange, etc.)
- [ ] Response headers corretos: `Content-Type: text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- [ ] `Content-Disposition: attachment; filename="leads-export-2026-03-18.xlsx"`

**Backend — Lead Export (CSV/XLSX):**
- [ ] Colunas: Nome, Email, Telefone, Empresa, Cargo, Status, Fonte, Score, Responsavel, Tags (comma-separated), Data Criacao, Data Atualizacao
- [ ] Custom fields expandidos como colunas dinamicas (1 coluna por custom field ativo do tenant)
- [ ] Tags como string concatenada: `"tag1, tag2, tag3"`
- [ ] Responsavel (assignedTo) resolvido para nome do usuario (nao UUID)
- [ ] Maximo 50.000 registros por export (safety limit, retorna erro se exceder)

**Backend — Deal Export (CSV/XLSX):**
- [ ] Colunas: Nome, Valor, Estagio, Probabilidade, Data Prevista Fechamento, Lead Associado, Responsavel, Notas, Data Criacao, Data Fechamento
- [ ] Valor formatado como numero (nao string Decimal)
- [ ] Lead associado resolvido para nome (nao UUID)

**Backend — Task Export (CSV/XLSX):**
- [ ] Colunas: Titulo, Descricao, Status, Prioridade, Responsavel, Lead Associado, Deal Associado, Data Vencimento, Data Conclusao, Data Criacao
- [ ] Responsavel, Lead e Deal resolvidos para nomes

**Backend — Server-Side Generation:**
- [ ] Instalar `exceljs` no server (`cd server && npm install exceljs`)
- [ ] CSV: streaming com `res.write()` — nao acumular em memoria
- [ ] XLSX: ExcelJS workbook com streaming (`workbook.xlsx.write(res)`)
- [ ] Header row com formatacao bold no XLSX
- [ ] Auto-width nas colunas do XLSX baseado no conteudo

**Frontend — Download UI:**
- [ ] Botao "Exportar" na pagina de Leads com dropdown: JSON, CSV, Excel (XLSX)
- [ ] Botao "Exportar" na pagina de Deals com mesmo dropdown
- [ ] Botao "Exportar" na pagina de Tasks com mesmo dropdown
- [ ] Ao clicar, inicia download direto (binary stream do backend)
- [ ] Loading state no botao durante download
- [ ] Toast de sucesso: "Export de X registros concluido"
- [ ] Se filtros ativos, export respeita filtros (export do que esta visivel)

**Testes:**
- [ ] Export CSV de 100 leads contem header + 100 rows
- [ ] Export XLSX abre corretamente no Excel/Google Sheets
- [ ] Custom fields aparecem como colunas extras no export
- [ ] Tags aparecem como string comma-separated
- [ ] Export com filtro de status so exporta leads do status filtrado
- [ ] Export de 0 registros retorna arquivo com header only (nao erro)
- [ ] Formato JSON mantém backward compatibility (response identica ao atual)

**Dev Notes:**
- `exceljs` ja esta no `package.json` do frontend (`"exceljs": "^4.4.0"`) — instalar tambem no server para geracao server-side
- Export JSON atual em `server/src/routes/leads.ts:266-296` usa `prisma.lead.findMany` com `take: 10000` — expandir para 50k com cursor-based pagination
- Para CSV, usar pattern simples: header row + `leads.forEach(lead => res.write(csvRow))` + `res.end()`
- Para XLSX, ExcelJS permite `workbook.xlsx.write(res)` direto para stream
- Custom fields: buscar `CustomField` ativos do tenant para gerar colunas dinamicas
- Deals export: reusar pattern do leads export, adaptar colunas
- Tasks export: reusar pattern, resolver `assignedTo` → `User.name` com `include`
- Frontend: download via `window.location.href = url` ou `fetch` + `URL.createObjectURL` para blob
- Considerar rate limit no export (1 export por minuto por tenant) para evitar abuse

---

## Technical Architecture

```
                    ┌─────────────────────────┐
                    │      VYD Engage CRM      │
                    └──────────┬──────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
    ┌─────▼─────┐      ┌──────▼──────┐      ┌──────▼──────┐
    │  Story 1   │      │   Story 2   │      │   Story 3   │
    │  Google    │      │   Zapier    │      │  CSV/XLSX   │
    │  Calendar  │      │   Webhooks  │      │   Export    │
    └─────┬─────┘      └──────┬──────┘      └──────┬──────┘
          │                    │                     │
    ┌─────▼─────┐      ┌──────▼──────┐      ┌──────▼──────┐
    │ Google     │      │ Webhook     │      │ ExcelJS     │
    │ Calendar   │      │ Dispatcher  │      │ (server)    │
    │ API        │      │ (async)     │      │ + CSV stream│
    │ (OAuth2)   │      │             │      │             │
    └───────────┘      └─────────────┘      └─────────────┘
```

**Novas dependencias NPM:**
- `googleapis` — Google Calendar API SDK (server)
- `exceljs` — Geracao XLSX server-side (server — ja existe no frontend)

**Novas tabelas Prisma:**
- `GoogleCalendarIntegration` — OAuth tokens + sync config (Story 1)

**Novos campos Prisma:**
- `Task.googleEventId` — tracking do evento sincronizado (Story 1)

**Novos arquivos esperados:**

| Arquivo | Story | Descricao |
|---------|-------|-----------|
| `server/src/services/googleCalendarService.ts` | 1 | OAuth2 flow + Calendar API CRUD |
| `server/src/routes/integrations.ts` | 1 | Endpoints OAuth2 + status + disconnect |
| `src/pages/SettingsIntegrations.tsx` | 1 | UI de conexao Google Calendar |
| `server/src/services/webhookDispatcher.ts` | 2 | Event-driven dispatch para webhooks |
| `server/src/utils/webhookPayloads.ts` | 2 | Sample payloads + payload formatters |
| `server/src/services/exportService.ts` | 3 | Geracao CSV/XLSX para leads, deals, tasks |
| `server/src/routes/exports.ts` | 3 | Endpoints de export com format param |

---

## Sprint Planning

| Sprint | Stories | Pontos | Notas |
|--------|---------|--------|-------|
| 1 | Story 2 (Zapier Webhooks) + Story 3 (CSV/XLSX Export) | 6 | Independentes, menor risco |
| 2 | Story 1 (Google Calendar Sync) | 5 | Maior complexidade (OAuth2 + API externa) |

**Alternativa (paralelo total):** Todas as 3 stories podem rodar no mesmo sprint se houver capacidade — sao 100% independentes.

---

## Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Google OAuth2 review demora (app nao verificado) | Media | Alto | Usar modo "testing" com usuarios limitados inicialmente |
| Rate limit Google Calendar API | Baixa | Medio | Backoff exponencial + queue (BullMQ) |
| Export de datasets muito grandes (>50k) trava servidor | Media | Alto | Streaming + limit + cursor pagination |
| Payload webhook quebra integracao existente | Media | Alto | Manter backward compat — novo formato em header version |
| ExcelJS server-side memory com planilhas grandes | Baixa | Medio | Usar streaming mode do ExcelJS (`workbook.xlsx.write`) |

---

## Definition of Done (Epic Level)

- [ ] Story 1: Tasks aparecem no Google Calendar apos sync habilitado
- [ ] Story 2: Zapier webhook com payload padrao funciona sem configuracao custom
- [ ] Story 3: Export CSV/XLSX de leads, deals e tasks com todos os campos
- [ ] Todos os endpoints com testes unitarios
- [ ] Documentacao de API atualizada para novos endpoints
- [ ] Nenhuma regressao em funcionalidades existentes
- [ ] Migration Prisma aplicavel sem downtime
