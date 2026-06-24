# Story: Segmentação de Audiência e Agendamento

**Story ID:** EC-1.2  
**Epic:** EPIC-EMAIL-CAMPAIGNS  
**Tipo:** Feature  
**Prioridade:** P0  
**Pontos:** 5  
**Sprint:** 1  
**Fase:** 1 — Criação e Envio (sequencial após EC-1.1)  
**Dependências:** EC-1.1 completa (`Campaign` model existente)  
**Status:** Draft

---

## Descrição

Como usuário, quero selecionar a audiência da campanha com filtros (ex: leads em determinado stage ou tag) e agendar o envio para uma data/hora específica, para enviar a mensagem certa para o grupo certo no momento ideal.

---

## Acceptance Criteria

### AC-1: Seletor de Audiência
- [ ] Na criação/edição de campanha (EC-1.1), etapa "Audiência" antes de enviar
- [ ] Opções de seleção: Todos os leads | Por tag | Por status | Por funil/stage | Seleção manual
- [ ] "Por tag": multi-select de tags do tenant
- [ ] "Por status": dropdown de status de lead (NEW, CONTACTED, etc.)
- [ ] "Por funil/stage": select de funil + select de stage dentro do funil
- [ ] Contador ao vivo: "X leads selecionados" (atualiza conforme filtros)
- [ ] Leads com `unsubscribed = true` excluídos automaticamente da contagem e do envio

### AC-2: Agendamento
- [ ] Opção "Enviar agora" (imediato) ou "Agendar" (datepicker + timepicker)
- [ ] Agendamento mínimo: 5 minutos no futuro
- [ ] `Campaign.scheduledAt` preenchido ao agendar
- [ ] `Campaign.status = SCHEDULED` após agendar
- [ ] Toast: "Campanha agendada para DD/MM às HH:MM"

### AC-3: Job de Envio em Lote (BullMQ)
- [ ] `campaignSender.ts` — job BullMQ que roda a cada minuto
- [ ] Busca campanhas com `status = SCHEDULED` e `scheduledAt <= now()`
- [ ] Envia para todos os recipients em lotes de 50 (rate-limit Resend = 100/s)
- [ ] Atualiza `CampaignRecipient.status = SENT` conforme envia
- [ ] `Campaign.status = SENDING` durante envio, `SENT` ao finalizar
- [ ] Gated por `ENABLE_CAMPAIGN_SENDER` env var (default false)

### AC-4: Envio Imediato
- [ ] "Enviar agora" → cria recipients no banco → dispara job imediatamente via `queue.add(..., { priority: 1 })`
- [ ] Progresso visível: "Enviando... X de Y"

### AC-5: Unsubscribe Handler
- [ ] `GET /unsubscribe/:recipientId` — rota pública (sem auth, sem CSRF)
- [ ] Seta `Lead.unsubscribed = true`, `Lead.unsubscribedAt = now()`
- [ ] Seta `CampaignRecipient.status = UNSUBSCRIBED`
- [ ] Retorna página HTML estática de confirmação ("Você foi removido da lista")

---

## Dev Notes

### Filtro de audiência (backend)

```typescript
// server/src/services/campaignService.ts
async buildAudienceLeadIds(tenantId: string, filter: AudienceFilter): Promise<string[]> {
  const where: Prisma.LeadWhereInput = {
    tenantId,
    unsubscribed: false,
    email: { not: null },
  }
  if (filter.type === 'tag') where.tags = { some: { tagId: { in: filter.tagIds } } }
  if (filter.type === 'status') where.status = filter.status
  if (filter.type === 'stage') where.deals = { some: { stage: filter.stage, funnelId: filter.funnelId } }

  const leads = await prisma.lead.findMany({ where, select: { id: true } })
  return leads.map(l => l.id)
}
```

### Job BullMQ

```typescript
// server/src/jobs/campaignSender.ts
const BATCH_SIZE = 50
const BATCH_DELAY_MS = 1100 // ~50/s → dentro do limite Resend

export async function startCampaignSenderJob() {
  const queue = new Queue('campaign-sender', { connection: redisClient })
  const worker = new Worker('campaign-sender', async (job) => {
    const { campaignId } = job.data
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { recipients: true } })
    // ... processar em lotes
  }, { connection: redisClient })
}
```

### Rota de unsubscribe (pública)

```typescript
// server/src/index.ts — montar em /api/public
app.get('/unsubscribe/:recipientId', async (req, res) => {
  await prisma.campaignRecipient.update({
    where: { id: req.params.recipientId },
    data: {
      status: 'UNSUBSCRIBED',
      lead: { update: { unsubscribed: true, unsubscribedAt: new Date() } }
    }
  })
  res.send('<html><body><h1>Você foi removido da lista de emails.</h1></body></html>')
})
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/services/campaignService.ts` | MODIFICAR — buildAudienceLeadIds() |
| `server/src/jobs/campaignSender.ts` | CRIAR — job BullMQ |
| `server/src/index.ts` | MODIFICAR — rota pública /unsubscribe |
| `server/prisma/schema.prisma` | MODIFICAR — Lead.unsubscribed + unsubscribedAt |
| `src/components/campaigns/AudienceSelector.tsx` | CRIAR |
| `src/pages/CampaignEditor.tsx` | MODIFICAR — etapa Audiência + Agendamento |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: buildAudienceLeadIds + agendamento | 2h |
| Backend: job campaignSender | 1h |
| Backend: rota unsubscribe | 0.5h |
| Frontend: AudienceSelector + datepicker | 1.5h |
| **Total** | **~5h** |

---

## Verificação E2E

1. Criar campanha → etapa Audiência → selecionar "Por tag: Quente" → contador mostra leads corretos
2. Leads com `unsubscribed = true` excluídos da contagem
3. Agendar para 2 min no futuro → status "Agendada" → job dispara → emails chegam
4. Clicar link de unsubscribe no email → página de confirmação → lead marcado como unsubscribed
5. Tentar incluir lead unsubscribed em próxima campanha → não aparece na contagem

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
