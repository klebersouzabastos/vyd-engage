# Jobs e Processamento Assíncrono

Este documento descreve o sistema de jobs assíncronos implementado usando BullMQ.

## Configuração

### Variáveis de Ambiente

Adicione as seguintes variáveis ao seu `.env`:

```env
# Redis (para BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Habilitar jobs de cobrança
ENABLE_BILLING_JOBS=true
```

### Docker Compose

O Redis já está configurado no `docker-compose.yml`. Para iniciar:

```bash
docker-compose up -d redis
```

## Jobs Implementados

### 1. Billing Jobs (Cobrança Recorrente)

**Localização:** `server/src/jobs/billing.ts`

**Funcionalidade:**
- Processa cobranças recorrentes automaticamente
- Agenda próximas cobranças baseado no ciclo de faturamento
- Processa assinaturas vencidas

**Como funciona:**
1. Quando uma assinatura é criada ou atualizada, um job é agendado para a data de renovação
2. No dia da renovação, o job cria uma preferência de pagamento no Mercado Pago
3. Após o pagamento ser aprovado (via webhook), a assinatura é renovada
4. Um novo job é agendado para o próximo ciclo

**Inicialização:**

Os jobs são inicializados automaticamente quando `ENABLE_BILLING_JOBS=true` está definido.

Para inicializar manualmente:

```typescript
import { initializeBillingJobs } from './jobs/billing.js';

await initializeBillingJobs();
```

**Monitoramento:**

Os jobs registram eventos no logger:
- `completed`: Job concluído com sucesso
- `failed`: Job falhou (com retry automático)

## Adicionando Novos Jobs

Para adicionar um novo job:

1. Crie uma nova fila:

```typescript
import { Queue } from 'bullmq';

export const myQueue = new Queue('my-queue', {
  connection: redisConnection,
});
```

2. Crie um worker:

```typescript
import { Worker } from 'bullmq';

export const myWorker = new Worker(
  'my-queue',
  async (job) => {
    // Processar job
  },
  { connection: redisConnection }
);
```

3. Adicione jobs à fila:

```typescript
await myQueue.add('process-task', { data: 'value' });
```

## Monitoramento com Bull Board (Opcional)

Para visualizar os jobs em uma interface web, instale Bull Board:

```bash
npm install @bull-board/api @bull-board/express
```

E adicione ao `server/src/index.ts`:

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(billingQueue),
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

Acesse: `http://localhost:3001/admin/queues`






