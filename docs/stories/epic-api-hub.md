# Épico: API Hub (Integrações e API Pública)

**Epic ID:** EPIC-API-HUB  
**PRD:** [docs/prd/prd-api-hub.md](../prd/prd-api-hub.md)  
**Roadmap:** [docs/prd/prd-growth-roadmap.md](../prd/prd-growth-roadmap.md)  
**Prioridade:** P1  
**Status:** Planejado  
**Criado em:** 2026-06-23  
**Sequência:** 4º épico do Growth Roadmap

---

## Contexto

Abre o VYD para o ecossistema de integrações. Documentação + webhooks + Zapier transformam o produto de CRM isolado em hub conectado.

**Base existente:** `server/src/routes/outgoingWebhooks.ts` (esqueleto), `server/src/routes/apiKeys.ts` (CRUD completo), model `ApiKey` com `keyHash` e `active`.

---

## Stories

### Fase 1 — Documentação e Webhooks (Sprint 1, P0)

| Story | Título | Pts | Status | Paralelo com |
|-------|--------|-----|--------|-------------|
| [API-1.1](api-1.1-swagger-docs.md) | Documentação Interativa da API (Swagger/Redoc) | 5 | Draft | API-1.2 |
| [API-1.2](api-1.2-outgoing-webhooks.md) | Webhooks de Saída Configuráveis por Evento | 8 | Draft | API-1.1 |

### Fase 2 — Scopes e Zapier (Sprint 2, P1)

| Story | Título | Pts | Status | Dependência |
|-------|--------|-----|--------|------------|
| [API-2.1](api-2.1-api-key-scopes.md) | Scopes e Permissões por API Key | 5 | Draft | API-1.2 (padrão de auth estabelecido) |
| [API-2.2](api-2.2-zapier-app.md) | Zapier App Nativo | 13 | Draft | API-1.1 + API-2.1 |

---

## Grafo de Dependências

```
API-1.1 ─── API-1.2 (paralelo, Sprint 1)
API-1.1 ──────────────────┐
API-2.1 (depende 1.2)─────┴─── API-2.2 (Sprint 2)
```

**Sprint 1 paralelo:** API-1.1 + API-1.2 (13 pts)  
**Sprint 2:** API-2.1 → API-2.2 (18 pts)

---

## Novos Arquivos Previstos

| Arquivo | Tipo |
|---------|------|
| `server/src/utils/openapi.ts` | Backend — spec OpenAPI 3.0 + anotações |
| `server/src/routes/outgoingWebhooks.ts` (completar) | Backend — UI config + retry |
| `server/src/services/outgoingWebhookService.ts` | Backend — disparo + retry via BullMQ |
| `server/src/jobs/webhookDispatcher.ts` | Backend — job de despacho |
| `server/src/middleware/apiKeyScope.ts` | Backend — middleware de validação de scope |
| `src/pages/WebhooksSettings.tsx` | Frontend — configuração de webhooks |
| `src/components/settings/WebhookCard.tsx` | Frontend — card de webhook + logs |
| `src/pages/ApiKeysSettings.tsx` (atualizar) | Frontend — adicionar scopes |

## Migração Prisma necessária

```prisma
model OutgoingWebhook { ... }
model OutgoingWebhookLog { ... }
// ApiKey.scopes String[] @default([])
```

---

## Total

| Fase | Stories | Pontos |
|------|---------|--------|
| Fase 1 — Docs+Webhooks | 2 | 13 |
| Fase 2 — Scopes+Zapier | 2 | 18 |
| **Total** | **4** | **31** |

---

## Próximos Passos

1. **@po (Pax)** — `*validate-story-draft` em API-1.1 e API-1.2
2. **@dev (Dex)** — Sprint 1: API-1.1 + API-1.2 em paralelo
3. **@qa (Quinn)** — QA gate por story
4. **@devops (Gage)** — push + PR após Sprint 1 done
5. **@dev (Dex)** — Sprint 2: API-2.1 → API-2.2
