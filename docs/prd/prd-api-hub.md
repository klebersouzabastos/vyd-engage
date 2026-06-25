# PRD — Épico: API Hub (Integrações e API Pública)

**Epic ID:** EPIC-API-HUB  
**Prioridade:** P1 (lever de adoção e ecossistema)  
**Duração estimada:** 4-6 semanas  
**Sequência no Roadmap:** 4 de 4

---

## Contexto

O VYD Engage tem uma API REST completa, mas ela é "invisível" — sem documentação interativa, sem webhooks de saída configuráveis pelo usuário, e sem integrações nativas. Isso fecha as portas para:

1. **Desenvolvedores** que querem integrar o VYD com sistemas internos (ERP, e-commerce, suporte)
2. **Times não-técnicos** que usam Zapier/Make para conectar ferramentas sem código
3. **Parceiros** que querem construir integrações e revender o VYD

A rota `outgoingWebhooks.ts` já existe como esqueleto. `apiKeys.ts` já tem CRUD de chaves. O esforço aqui é surfacear e completar o que já existe.

---

## Personas

| Persona | Perfil | Dor Principal |
|---------|--------|---------------|
| **Dev Integrador** | Dev interno que precisa enviar leads do site para o VYD | "Encontrei a API mas não tem documentação. Tenho que testar no escuro." |
| **Ops/RevOps** | Usa Zapier para automação sem código | "Não tem o VYD no Zapier. Precisaria de um dev para integrar." |
| **Admin Técnico** | Configura webhooks para notificar o ERP de deals fechados | "Quero receber um POST no meu sistema quando um deal virar WON." |

---

## Análise de Gaps

| Gap | Impacto |
|-----|---------|
| Sem documentação interativa da API | Dev não consegue integrar sem ler o código-fonte |
| Webhooks de saída sem UI de configuração | Admin não consegue configurar sem acesso ao DB |
| API keys sem escopo/permissão | Toda chave tem acesso total — risco de segurança |
| Sem app no Zapier | Time não-técnico não consegue integrar |
| Webhooks de saída sem retry | Falha silenciosa se destino estiver offline |

---

## Épico: API Hub

### Fase 1 — Documentação e Webhooks (P0 — 2-3 semanas)

---

**Story API-1.1 — Documentação Interativa da API (Swagger/Redoc)**

Como desenvolvedor, quero acessar uma documentação interativa da API para integrar o VYD sem precisar ler o código-fonte.

*Requisitos funcionais:*
- Endpoint `GET /api/docs` — serve interface Redoc com spec OpenAPI 3.0
- Spec gerada automaticamente a partir de anotações JSDoc nas rotas existentes
- Autenticação documentada (Bearer JWT + API Key via header `X-API-Key`)
- Todos os 28 grupos de rotas documentados com exemplos de request/response
- Try-it-out funcional (requer CORS na rota de docs)
- Versão: identifica API v1 (`info.version: 1.0.0`)
- Disponível apenas em `NODE_ENV !== 'production'` por padrão (env var `ENABLE_API_DOCS=true` para produção)

*Backend:* `npm install swagger-jsdoc redoc-express` (ambos MIT). Criar `server/src/utils/openapi.ts` — define spec base + coleta anotações. Montar em `server/src/index.ts`.

*Frontend:* Nenhuma mudança necessária — docs servidos pelo backend.

---

**Story API-1.2 — Webhooks de Saída Configuráveis por Evento**

Como administrador, quero configurar URLs de webhook para receber notificações de eventos do CRM (novo lead, deal atualizado, deal fechado) para integrar com sistemas externos.

*Requisitos funcionais:*
- UI em `/app/settings/webhooks` — lista de webhooks configurados com status e últimos disparos
- Criar webhook: URL de destino, lista de eventos a escutar, secret para assinatura HMAC
- Eventos disponíveis: `lead.created`, `lead.updated`, `lead.deleted`, `deal.created`, `deal.updated`, `deal.won`, `deal.lost`, `task.completed`, `automation.triggered`
- Payload padrão: `{ event: string, tenantId: string, timestamp: string, data: {...} }`
- Assinatura HMAC-SHA256 no header `X-VYD-Signature` (mesmo padrão de segurança dos webhooks de entrada)
- Retry automático: 3 tentativas com backoff exponencial (1s → 5s → 25s)
- Log dos últimos 100 disparos por webhook: status, timestamp, response code, duração
- Limite: 10 webhooks por tenant (plan-based)

*Backend:* Completa `server/src/routes/outgoingWebhooks.ts` existente. Serviço `outgoingWebhookService.ts` — disparo via BullMQ (retry). Job `webhookDispatcher.ts`. Integra nos services existentes (leadService, dealService) com `dispatchOutgoingWebhook(tenantId, event, data)`.

*Frontend:* `src/pages/WebhooksSettings.tsx` + `src/components/settings/WebhookCard.tsx`.

---

### Fase 2 — Scopes e Zapier (P1 — 2-3 semanas)

---

**Story API-2.1 — Scopes e Permissões por API Key**

Como administrador, quero criar API keys com permissões específicas (somente leitura, somente leads, etc.) para dar acesso seguro a integrações externas.

*Requisitos funcionais:*
- Na criação de API key: seletor de scopes (checkboxes agrupados por recurso)
- Scopes disponíveis: `leads:read`, `leads:write`, `deals:read`, `deals:write`, `tasks:read`, `tasks:write`, `contacts:read`, `reports:read`, `webhooks:manage`
- Middleware `apiKeyAuth.ts` — verifica scope antes de executar a rota
- API keys sem scope explícito mantêm acesso total (backward compat com keys existentes)
- UI em `/app/settings/api-keys` mostra scopes de cada key

*Backend:* Campo `scopes String[]` no model `ApiKey` (migração Prisma). Middleware de validação de scope em rotas autenticadas por API key.

*Frontend:* Atualizar `src/pages/ApiKeysSettings.tsx` — adicionar seletor de scopes na criação.

---

**Story API-2.2 — Zapier App Nativo**

Como usuário não-técnico, quero conectar o VYD Engage ao Zapier para integrar com outras ferramentas sem código.

*Requisitos funcionais:*
- Triggers Zapier: `New Lead`, `Lead Updated`, `Deal Won`, `Deal Lost`, `Task Completed`
- Actions Zapier: `Create Lead`, `Update Lead`, `Create Deal`, `Create Task`, `Add Tag to Lead`
- Autenticação via API Key (formato `X-API-Key` header) — sem OAuth para MVP
- Publish como Zapier app privada (para usuários do tenant) ou pública (após revisão Zapier)
- Documentação de como conectar o VYD no Zapier (`docs/integrations/zapier.md`)

*Backend:* Os endpoints já existem. O Zapier usa a API REST existente via API Key. Adicionar rota pública `GET /api/v1/zapier/triggers/lead-created` (polling) para compatibilidade com Zapier REST Hook ou polling mode.

*Integração:* Criar app no Zapier Developer Platform com schema JSON das triggers/actions mapeadas para a API do VYD. Configuração via [zapier.com/developer](https://zapier.com/developer) — não requer código extra no backend além do polling endpoint.

---

## Requisitos Não-Funcionais

- Webhook dispatch: falha no destino NÃO deve impactar o fluxo principal (fire-and-forget via BullMQ)
- Rate limit da API com key: 1000 req/min (configurável por plan)
- Docs: atualização automática da spec quando rotas mudam (geração a partir de código)
- Segurança: scopes checados em middleware antes de executar qualquer handler
- Log de webhooks: retenção de 30 dias, paginado

---

## Modelo de Dados

```prisma
model OutgoingWebhook {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  url       String
  events    String[] // ['lead.created', 'deal.won', ...]
  secret    String   // para HMAC-SHA256
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  logs      OutgoingWebhookLog[]

  @@index([tenantId, active])
}

model OutgoingWebhookLog {
  id         String   @id @default(uuid())
  webhookId  String
  webhook    OutgoingWebhook @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  event      String
  statusCode Int?
  duration   Int?     // ms
  success    Boolean
  error      String?
  createdAt  DateTime @default(now())

  @@index([webhookId, createdAt])
}
```

Campos a adicionar em `ApiKey`:
```prisma
scopes String[] @default([])
```

---

## Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| % tenants com webhook configurado (30 dias após launch) | > 25% |
| Integrações Zapier ativas | > 50 após 60 dias |
| Uptime de entrega de webhooks | > 99% |
| NPS da documentação da API (dev survey) | > 4.0/5 |
