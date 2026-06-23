# Story: Delay Step no Engine de Automações

**Story ID:** UX-4.1
**Epic:** EPIC-UX-POWER (UX Power — Experiência de Poder do Usuário)
**Tipo:** Feature
**Prioridade:** P1
**Pontos:** 8
**Sprint:** 2
**Fase:** 4 — SDR Sequences
**Dependências:** Nenhuma (independente das Fases 1-3)
**Desbloqueia:** Nenhuma
**Status:** Done
**Agente:** @sm (River) — draft | @po (Pax) — validado 2026-06-23 | @dev (Dex) — implementado 2026-06-23

---

## Descrição

Como SDR/BDR, quero criar automações com esperas temporais entre steps para montar cadências de follow-up automáticas. Hoje o engine de automações executa todos os steps imediatamente em sequência — impossível criar "Enviar email → Aguardar 3 dias → Enviar follow-up".

**Problema atual:** O `automationEngine.ts` executa steps síncronos/assíncronos mas sem delay temporal. Para cadências de prospecção, é necessário um step "Aguardar X dias/horas" que enfileira o próximo step para execução futura.

**Referência OSS verificada:** Twenty CRM — Delay action com Duration + Scheduled Date (verificado em docs públicos).

---

## Acceptance Criteria

### AC-1: Node "Aguardar" no Editor Visual
- [ ] Novo tipo de node no editor de automações: **"Aguardar"** (Delay)
- [ ] Ícone de relógio (Lucide `Clock`) no palette de nodes
- [ ] Ao adicionar o node, exibe configuração inline:
  - **Modo Duração:** input numérico + select de unidade (minutos / horas / dias / semanas)
  - **Modo Data do campo:** select de campo de data do lead/deal (ex: `followUpDate`, `expectedCloseDate`)
- [ ] Toggle entre os dois modos no card do node
- [ ] Preview no card: "Aguardar 3 dias" ou "Aguardar até followUpDate"

### AC-2: Backend — Campo `executeAt` em AutomationLog
- [ ] Migração Prisma: `executeAt DateTime?` adicionado ao model `AutomationLog`
- [ ] Quando um step do tipo `delay` é processado, o próximo step é criado com `executeAt = now + duration`
- [ ] Steps com `executeAt` no futuro ficam em status `waiting` (não `pending`)
- [ ] Status `waiting` adicionado ao enum `AutomationLogStatus` (ou campo status) se necessário

### AC-3: Engine — Processamento de Steps Pendentes
- [ ] `automationEngine.ts` (ou `taskNotificationChecker.ts` se mais simples) verifica a cada 5 minutos steps com `executeAt <= now AND status = 'waiting'`
- [ ] Steps prontos são processados normalmente (executam a ação definida)
- [ ] O intervalo de verificação é configurável via variável de ambiente `AUTOMATION_CHECK_INTERVAL_MS` (default: `5 * 60 * 1000`)
- [ ] Se Redis + BullMQ está habilitado (`ENABLE_AUTOMATION_ENGINE=true`), usar BullMQ `delayed job` em vez de setInterval para delays > 1h (mais preciso)

### AC-4: Cancelamento Gracioso
- [ ] Se o lead/deal associado à automação é excluído durante o wait, o step `waiting` é cancelado com status `cancelled`
- [ ] Hook em `DELETE /api/v1/leads/:id` e `DELETE /api/v1/deals/:id` cancela logs com status `waiting` do registro

### AC-5: Visibilidade no Log de Automações
- [ ] Em `/app/automations` (log de execuções), steps com status `waiting` exibem:
  - Badge "Aguardando" (amarelo/âmbar)
  - Texto: "Executa em: `<data/hora formatada>`"
- [ ] Steps `waiting` aparecem em lista de execuções pendentes separada ou na lista geral com filtro

### AC-6: Sem dependência obrigatória de Redis para delays curtos
- [ ] `setInterval` de 5min é suficiente para delays de minutos/horas em dev e prod básico
- [ ] BullMQ é opcional (usado apenas se `ENABLE_AUTOMATION_ENGINE=true` no env)
- [ ] Documentar limitação: precisão de delay é ±5min para deploys sem Redis

---

## Dev Notes

### Migration Prisma

```prisma
model AutomationLog {
  id            String   @id @default(cuid())
  automationId  String
  tenantId      String
  // ... campos existentes ...
  status        AutomationLogStatus  // verificar se 'waiting' já existe
  executeAt     DateTime?             // NOVO CAMPO
  createdAt     DateTime @default(now())
}

enum AutomationLogStatus {
  pending
  running
  success
  error
  waiting    // NOVO se não existir
  cancelled  // NOVO se não existir
}
```

**Comando de migration:**
```bash
cd server
npx prisma migrate dev --name add_executeAt_to_automation_log
```

### Estrutura do step Delay no JSON de automação

No campo `config` JSON do model `Automation`, steps têm estrutura:
```json
{
  "steps": [
    { "id": "1", "type": "send_email", "config": { "templateId": "..." } },
    { "id": "2", "type": "delay",      "config": { "mode": "duration", "amount": 3, "unit": "days" } },
    { "id": "3", "type": "send_email", "config": { "templateId": "..." } }
  ]
}
```

Para modo campo de data:
```json
{ "type": "delay", "config": { "mode": "field", "field": "followUpDate" } }
```

### Engine — processamento do step delay

Em `automationEngine.ts`, no switch de tipos de steps:
```typescript
case 'delay': {
  const { mode, amount, unit, field } = step.config
  let executeAt: Date

  if (mode === 'duration') {
    const ms = { minutes: 60_000, hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 }
    executeAt = new Date(Date.now() + amount * ms[unit])
  } else if (mode === 'field') {
    const fieldValue = context.lead?.[field] ?? context.deal?.[field]
    executeAt = fieldValue ? new Date(fieldValue) : new Date(Date.now() + 86_400_000) // fallback: 1 day
  }

  // Criar o próximo step com executeAt
  await prisma.automationLog.create({
    data: { ..., status: 'waiting', executeAt }
  })
  return // não executar o próximo step agora
}
```

### Verificação de steps pendentes (polling)

Adicionar ao `taskNotificationChecker.ts` (já roda sem Redis) ou criar novo job:

```typescript
async function processWaitingSteps() {
  const ready = await prisma.automationLog.findMany({
    where: { status: 'waiting', executeAt: { lte: new Date() } },
    take: 50,
  })
  for (const log of ready) {
    await executeAutomationStep(log)
  }
}

setInterval(processWaitingSteps, process.env.AUTOMATION_CHECK_INTERVAL_MS
  ? parseInt(process.env.AUTOMATION_CHECK_INTERVAL_MS)
  : 5 * 60 * 1000)
```

### Frontend — DelayNode

**`src/components/automations/DelayNode.tsx`**:
```tsx
// Props: config: { mode, amount, unit, field }, onChange
// Preview: "Aguardar 3 dias" | "Aguardar até followUpDate"
```

**Atualização no AutomationBuilder (palette de nodes):**
Adicionar "Aguardar" na lista de tipos disponíveis com ícone `Clock` do Lucide.

### Cancelamento ao deletar lead/deal

Em `server/src/routes/leads.ts`, no `DELETE /:id`:
```typescript
await prisma.automationLog.updateMany({
  where: { leadId: id, status: 'waiting', tenantId },
  data: { status: 'cancelled' }
})
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação | Detalhe |
|---------|----------|---------|
| `server/prisma/schema.prisma` | MODIFICAR | `executeAt DateTime?` + status `waiting`/`cancelled` |
| `server/prisma/migrations/` | CRIAR | Migration `add_executeAt_to_automation_log` |
| `server/src/jobs/automationEngine.ts` | MODIFICAR | Case `delay` + processWaitingSteps() |
| `server/src/jobs/taskNotificationChecker.ts` | MODIFICAR | Adicionar polling de steps `waiting` |
| `server/src/routes/leads.ts` | MODIFICAR | Cancelar steps `waiting` ao deletar lead |
| `server/src/routes/deals.ts` | MODIFICAR | Cancelar steps `waiting` ao deletar deal |
| `src/components/automations/DelayNode.tsx` | CRIAR | UI do node Delay |
| `src/pages/Automations.tsx` | VERIFICAR/MODIFICAR | Adicionar Delay ao palette + badge "Aguardando" no log |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| AutomationLog não tem `leadId`/`dealId` para cancelamento | Média | Médio | Verificar schema atual — adicionar se necessário |
| Status `waiting` conflita com status existentes | Baixa | Alto | Verificar enum atual antes da migration |
| setInterval de 5min pode acumular jobs se engine for lento | Baixa | Médio | Adicionar lock/flag `processing: true` no log durante execução |
| Campo `followUpDate` pode não existir no modelo Lead | Média | Baixo | Usar apenas campos padrão de data se campo custom não disponível |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Migration Prisma + regenerar client | 30min |
| Engine: case delay + processWaitingSteps | 2h |
| Cancelamento ao deletar lead/deal | 45min |
| Frontend: `DelayNode.tsx` + integração no builder | 2h |
| Badge "Aguardando" no log de automações | 30min |
| Testes manuais (mock executeAt no passado) | 1h |
| **Total** | **~7h** |

---

## Verificação E2E

1. Criar automação: "Lead criado → Enviar email → **Aguardar 3 dias** → Enviar follow-up"
2. Criar um lead novo → verificar log de automação: step "Enviar email" como `success`, step seguinte como `waiting` com `executeAt = now + 3 dias`
3. Na UI: log exibe "Aguardando — Executa em: 26/06/2026 14:30"
4. Simular passagem do tempo: atualizar `executeAt` no banco para 1 minuto atrás → aguardar próximo ciclo do checker (5min) → step processa, email follow-up enviado
5. Criar lead → automação ativa → deletar lead → step `waiting` muda para `cancelled` automaticamente
6. Automação com modo "Aguardar até followUpDate" → campo data do lead configura o executeAt correto

---

*— River, removendo obstáculos 🌊*
*— Data: 2026-06-23*
