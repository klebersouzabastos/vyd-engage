# Story: Zapier App Nativo

**Story ID:** API-2.2  
**Epic:** EPIC-API-HUB  
**Tipo:** Feature  
**Prioridade:** P1  
**Pontos:** 13  
**Sprint:** 2  
**Fase:** 2 — Scopes e Zapier  
**Dependências:** API-1.1 (spec OpenAPI) + API-2.1 (scopes de API key)  
**Status:** Draft

---

## Descrição

Como usuário não-técnico do VYD Engage, quero conectar o CRM ao Zapier para automatizar fluxos com mais de 6000 apps (Slack, Google Sheets, Pipedrive, etc.) sem escrever código, usando um app nativo publicado na Zapier App Directory.

---

## Acceptance Criteria

### AC-1: Autenticação no Zapier
- [ ] Zapier App usa autenticação via API Key (campo de texto no Zapier)
- [ ] Test endpoint: `GET /api/v1/me` — retorna `{ tenantId, email, planName }` para validar a key
- [ ] Zapier exibe nome do usuário/tenant após autenticação bem-sucedida

### AC-2: Triggers (Zapier puxa → nosso sistema notifica)
- [ ] `New Lead` — polling `GET /api/v1/leads?sort=createdAt&order=desc` a cada 5min
- [ ] `New Deal Won` — polling `GET /api/v1/deals?stage=WON&sort=updatedAt&order=desc`
- [ ] `Deal Stage Changed` — polling `GET /api/v1/deals?sort=stageChangedAt&order=desc`
- [ ] `Task Completed` — polling `GET /api/v1/tasks?status=DONE&sort=completedAt&order=desc`

### AC-3: Actions (Zapier escreve → nosso sistema recebe)
- [ ] `Create Lead` — `POST /api/v1/leads` com campos mapeáveis: name, email, phone, company, source, notes
- [ ] `Update Lead` — `PATCH /api/v1/leads/:id` — id vem de um trigger anterior
- [ ] `Create Interaction` — `POST /api/v1/interactions` com leadId, type, content
- [ ] `Create Task` — `POST /api/v1/tasks` com title, leadId, dueDate, assignedTo

### AC-4: Zapier CLI e Publicação
- [ ] App desenvolvida com Zapier CLI (`@zapier/zapier-platform-core`)
- [ ] Publicada como "Private App" (convite por link) — não requer review da Zapier
- [ ] README com passo a passo de instalação via link de convite
- [ ] Testes de integração com `zapier test` passando

### AC-5: Suporte a Polling com Paginação
- [ ] Todos os endpoints de trigger suportam `?since=ISO_DATE` para retornar só registros mais novos
- [ ] Zapier chama com `since=` timestamp da última execução (deduplica pelo id)
- [ ] Resposta deve incluir campo `id` único e `createdAt` para deduplicação do Zapier

---

## Dev Notes

### Endpoint `/me` (novo)

```typescript
// server/src/routes/auth.ts ou novo routes/me.ts
router.get('/me', apiKeyAuth, tenantMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true, name: true, tenantId: true, tenant: { select: { name: true, plan: true } } }
  })
  res.json({ email: user!.email, name: user!.name, tenantId: user!.tenantId, plan: user!.tenant?.plan })
})
```

### Suporte a `?since=` nos endpoints de trigger

```typescript
// server/src/routes/leads.ts
if (req.query.since) {
  where.createdAt = { gte: new Date(req.query.since as string) }
}
// Ordenar por createdAt desc para o trigger de polling do Zapier
const orderBy = [{ createdAt: 'desc' as const }]
```

### Estrutura do Zapier App

```
zapier-app/
  index.ts              # Entrada: triggers, actions, authentication
  authentication.ts     # API Key auth + test request
  triggers/
    newLead.ts
    newDealWon.ts
    dealStageChanged.ts
    taskCompleted.ts
  creates/
    createLead.ts
    updateLead.ts
    createInteraction.ts
    createTask.ts
  package.json          # @zapier/zapier-platform-core
```

### Autenticação no Zapier App

```typescript
// zapier-app/authentication.ts
module.exports = {
  type: 'custom',
  fields: [
    { key: 'api_key', label: 'API Key', required: true, type: 'string' }
  ],
  test: {
    url: '{{process.env.API_BASE_URL}}/api/v1/me',
    headers: { Authorization: 'Bearer {{bundle.authData.api_key}}' }
  },
  connectionLabel: '{{bundle.inputData.name}} ({{bundle.inputData.email}})'
}
```

### Trigger de new lead (polling)

```typescript
// zapier-app/triggers/newLead.ts
const perform = (z, bundle) => {
  return z.request({
    url: `${process.env.API_BASE_URL}/api/v1/leads`,
    headers: { Authorization: `Bearer ${bundle.authData.api_key}` },
    params: {
      sort: 'createdAt', order: 'desc',
      since: bundle.meta.cursor, // timestamp da última execução
      limit: 100
    }
  }).then(r => r.json.data)
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `zapier-app/` (nova pasta) | CRIAR — app Zapier completo |
| `server/src/routes/leads.ts` | MODIFICAR — query param `?since=` |
| `server/src/routes/deals.ts` | MODIFICAR — query param `?since=` + `?stage=` |
| `server/src/routes/tasks.ts` | MODIFICAR — query param `?since=` + `?status=` |
| `server/src/routes/auth.ts` | MODIFICAR — GET /me endpoint |

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Review da Zapier (listing público) | Alta | Médio | Começar como "Private App" (link de convite); listing público é opcional |
| Deduplicação de eventos no Zapier | Média | Médio | Campo `id` obrigatório em todos os responses de trigger |
| Rate limit da API com muitos Zaps ativos | Média | Médio | `apiLimiter` cobre; monitorar via Sentry |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: /me + query params ?since | 2h |
| zapier-app: auth + 4 triggers | 4h |
| zapier-app: 4 actions | 4h |
| `zapier test` + debugging | 2h |
| README de instalação | 1h |
| **Total** | **~13h** |

---

## Verificação E2E

1. `zapier push` sem erros → app publicada como private
2. Conectar ao Zapier com API key → "Connected to [tenant name]" ✅
3. Trigger "New Lead" → criar lead no CRM → Zapier detecta em até 5min
4. Action "Create Lead" → criar Zap que lê Google Sheets e cria lead → funciona
5. Trigger "Deal Won" → mover deal para WON → Zapier detecta e executa ação downstream

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
