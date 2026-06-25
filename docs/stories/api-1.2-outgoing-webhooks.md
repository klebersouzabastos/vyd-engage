# Story: Webhooks de Saída Configuráveis por Evento

**Story ID:** API-1.2  
**Epic:** EPIC-API-HUB  
**Tipo:** Feature  
**Prioridade:** P0  
**Pontos:** 8  
**Sprint:** 1  
**Fase:** 1 — Documentação e Webhooks (paralelo com API-1.1)  
**Dependências:** Nenhuma  
**Desbloqueia:** API-2.1 (padrão de auth estabelecido)  
**Status:** Draft

---

## Descrição

Como desenvolvedor integrando o VYD Engage com outros sistemas, quero configurar webhooks de saída para eventos específicos do CRM (lead criado, deal ganho, task concluída, etc.) para que meu sistema externo seja notificado automaticamente sem precisar fazer polling.

---

## Acceptance Criteria

### AC-1: CRUD de Webhooks na Interface
- [ ] `/app/settings/webhooks` com listagem de webhooks configurados
- [ ] Formulário: URL destino (validada como HTTPS), eventos (multi-select), secret (gerado automaticamente), status (ativo/inativo)
- [ ] Editar e desativar webhook existente
- [ ] Botão "Testar" — envia payload de exemplo para a URL e exibe resposta

### AC-2: Eventos Suportados (Fase 1)
- [ ] `lead.created`, `lead.updated`, `lead.deleted`
- [ ] `deal.created`, `deal.updated`, `deal.stage_changed`, `deal.won`, `deal.lost`
- [ ] `task.created`, `task.completed`
- [ ] `interaction.created`

### AC-3: Disparo de Webhook
- [ ] Disparo via job BullMQ `webhookDispatcher` — não bloqueia a request original
- [ ] Payload: `{ event: string, tenantId: string, timestamp: string, data: object }`
- [ ] Header de assinatura: `X-VYD-Signature: sha256={HMAC-SHA256(secret, JSON.stringify(payload))}`
- [ ] HTTP POST para a URL configurada com timeout de 10s
- [ ] Se resposta 2xx → `OutgoingWebhookLog.status = SUCCESS`
- [ ] Se não-2xx ou timeout → `status = FAILED`, schedule retry

### AC-4: Retry com Backoff Exponencial
- [ ] Retries: 3 tentativas com delay 1min, 5min, 30min (backoff via BullMQ `attempts` + `backoff`)
- [ ] Após 3 falhas → `status = PERMANENTLY_FAILED`, webhook não desativado (só logado)
- [ ] Log de tentativas visível na interface (tabela de logs por webhook)

### AC-5: Modelos Prisma

```prisma
model OutgoingWebhook {
  id        String   @id @default(cuid())
  tenantId  String
  url       String
  events    String[] // ['lead.created', 'deal.won']
  secret    String   // HMAC secret
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  logs      OutgoingWebhookLog[]
  tenant    Tenant   @relation(...)

  @@index([tenantId])
}

model OutgoingWebhookLog {
  id         String   @id @default(cuid())
  webhookId  String
  event      String
  payload    Json
  statusCode Int?
  status     String   // SUCCESS | FAILED | PENDING
  attempts   Int      @default(0)
  createdAt  DateTime @default(now())

  webhook    OutgoingWebhook @relation(...)
}
```

---

## Dev Notes

### Integração com eventos existentes

```typescript
// Nos routes/services onde eventos ocorrem, adicionar disparo:
import { webhookDispatcher } from '../jobs/webhookDispatcher.js'

// Após criar lead:
webhookDispatcher.dispatch(req.user.tenantId, 'lead.created', { lead }).catch(() => {})

// Após deal mudar de stage:
webhookDispatcher.dispatch(req.user.tenantId, 'deal.stage_changed', { deal, fromStage, toStage }).catch(() => {})
```

### webhookDispatcher job

```typescript
// server/src/jobs/webhookDispatcher.ts
export class WebhookDispatcher {
  async dispatch(tenantId: string, event: string, data: object) {
    const webhooks = await prisma.outgoingWebhook.findMany({
      where: { tenantId, active: true, events: { has: event } }
    })
    for (const wh of webhooks) {
      await this.queue.add('send-webhook', { webhookId: wh.id, event, data }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 }
      })
    }
  }
}
```

### Assinatura HMAC

```typescript
import crypto from 'crypto'

function signPayload(secret: string, payload: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
}
```

### Geração de secret

```typescript
const secret = crypto.randomBytes(32).toString('hex') // 64 chars hex
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/prisma/schema.prisma` | MODIFICAR — OutgoingWebhook, OutgoingWebhookLog |
| `server/src/routes/outgoingWebhooks.ts` | MODIFICAR — completar CRUD + teste |
| `server/src/jobs/webhookDispatcher.ts` | CRIAR |
| `server/src/services/outgoingWebhookService.ts` | CRIAR |
| `server/src/routes/leads.ts` | MODIFICAR — dispatch lead.created/updated |
| `server/src/routes/deals.ts` | MODIFICAR — dispatch deal events |
| `src/pages/WebhooksSettings.tsx` | CRIAR |
| `src/components/settings/WebhookCard.tsx` | CRIAR |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Migração Prisma + CRUD routes | 2h |
| webhookDispatcher + retry BullMQ | 2h |
| Integração nos routes existentes | 1h |
| Frontend: WebhooksSettings + WebhookCard + logs | 2h |
| Testes + botão "Testar" | 1h |
| **Total** | **~8h** |

---

## Verificação E2E

1. Criar webhook para `lead.created` apontando para webhook.site
2. Criar lead no CRM → payload chega no webhook.site com assinatura correta
3. Criar webhook com URL inválida → 3 retries → log mostra `PERMANENTLY_FAILED`
4. Desativar webhook → novos eventos não são enviados para ele
5. Botão "Testar" envia payload de exemplo e mostra status HTTP da resposta

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
