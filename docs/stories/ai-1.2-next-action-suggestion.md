# Story: Sugestão de Próxima Ação com Justificativa

**Story ID:** AI-1.2  
**Epic:** EPIC-AI-SALES  
**Tipo:** Feature  
**Prioridade:** P0  
**Pontos:** 5  
**Sprint:** 1  
**Fase:** 1 — Contexto e Próxima Ação (paralelo com AI-1.1)  
**Dependências:** AI-1.1 (padrão de integração OpenAI estabelecido)  
**Status:** Draft

---

## Descrição

Como vendedor, quero que o CRM sugira qual deve ser minha próxima ação com um lead específico (ex: "Enviar proposta", "Agendar follow-up"), com uma justificativa de 1-2 frases explicando o raciocínio, para priorizar meu tempo de forma inteligente sem depender só do meu feeling.

---

## Acceptance Criteria

### AC-1: Badge de Próxima Ação
- [ ] `LeadDetail` exibe badge "Próxima Ação Sugerida" imediatamente abaixo do AISummaryCard (AI-1.1)
- [ ] Badge mostra: ícone de tipo + texto da ação + tooltip com justificativa
- [ ] Tipos de ação possíveis: CALL, EMAIL, MEETING, PROPOSAL, FOLLOW_UP, CLOSE_DEAL, NURTURE
- [ ] Cada tipo tem ícone e cor distintos (vermelho urgente, verde positivo, cinza neutro)

### AC-2: Geração da Sugestão
- [ ] `GET /api/v1/leads/:id/next-action` gera ou retorna sugestão cacheada (cache 12h)
- [ ] Considera: dias desde última interação, stage do deal, última interação (tipo), notas recentes, histórico de follow-ups sem resposta
- [ ] Resposta JSON: `{ action: string, type: ActionType, reasoning: string, urgency: 'low'|'medium'|'high' }`
- [ ] `urgency = 'high'` se última interação > 7 dias ou deal em NEGOTIATION sem atividade há 3 dias

### AC-3: Urgência Visual
- [ ] Badge de urgência `high` → cor vermelha + ícone de alerta
- [ ] Badge de urgência `medium` → cor laranja
- [ ] Badge de urgência `low` → cor azul/cinza

### AC-4: Ação Rápida a partir da Sugestão
- [ ] Botão "Executar" ao lado do badge → abre o diálogo correspondente:
  - `CALL` → abre modal de criação de interação (tipo CALL)
  - `EMAIL` → abre modal de email
  - `MEETING` → abre criação de tarefa tipo MEETING
  - `PROPOSAL` → navega para aba de deals
  - `FOLLOW_UP` → abre criação de tarefa tipo follow-up
- [ ] Clicar "Executar" não cria nada automaticamente — apenas abre o diálogo correspondente

---

## Dev Notes

### Endpoint

```typescript
// server/src/routes/ai.ts
router.get('/leads/:id/next-action', authenticate, tenantScope, apiLimiter, async (req, res) => {
  const forceRefresh = req.query.refresh === 'true'
  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, tenantId: req.user.tenantId },
    include: {
      interactions: { orderBy: { occurredAt: 'desc' }, take: 5 },
      tasks: { where: { status: { in: ['TODO', 'IN_PROGRESS'] } }, take: 3 },
      deals: { where: { stage: { notIn: ['WON', 'LOST'] } }, take: 1 }
    }
  })

  const cacheAge = lead?.aiNextActionUpdatedAt
    ? Date.now() - lead.aiNextActionUpdatedAt.getTime()
    : Infinity
  if (!forceRefresh && cacheAge < 12 * 60 * 60 * 1000 && lead?.aiNextAction) {
    return res.json(JSON.parse(lead.aiNextAction))
  }

  const suggestion = await aiSalesService.generateNextAction(lead)
  await prisma.lead.update({
    where: { id: lead!.id },
    data: { aiNextAction: JSON.stringify(suggestion), aiNextActionUpdatedAt: new Date() }
  })
  res.json(suggestion)
})
```

### Prompt de próxima ação

```typescript
async generateNextAction(lead: LeadWithContext) {
  const daysSinceLastInteraction = lead.interactions[0]
    ? Math.floor((Date.now() - lead.interactions[0].occurredAt.getTime()) / 86400000)
    : 999

  const prompt = `Você é um coach de vendas experiente. Com base no contexto abaixo, sugira UM próxima ação específica.

Lead: ${lead.name} | Empresa: ${lead.company} | Stage: ${lead.deals[0]?.stage ?? 'sem deal'}
Dias desde última interação: ${daysSinceLastInteraction}
Última interação: ${lead.interactions[0]?.type ?? 'nenhuma'} — ${lead.interactions[0]?.content?.slice(0, 200) ?? ''}
Tarefas pendentes: ${lead.tasks.map(t => t.title).join(', ') || 'nenhuma'}

Responda SOMENTE com JSON válido no formato:
{"action": "Texto da ação em português (max 60 chars)", "type": "CALL|EMAIL|MEETING|PROPOSAL|FOLLOW_UP|CLOSE_DEAL|NURTURE", "reasoning": "Justificativa em 1-2 frases em português", "urgency": "low|medium|high"}`

  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })
  return JSON.parse(response.choices[0].message.content!)
}
```

### Migração Prisma

```prisma
// Lead — adicionar
aiNextAction          String?
aiNextActionUpdatedAt DateTime?
```

### Frontend — NextActionBadge

```tsx
// src/components/leads/NextActionBadge.tsx
const ACTION_CONFIG = {
  CALL: { icon: Phone, color: 'blue', label: 'Ligar' },
  EMAIL: { icon: Mail, color: 'purple', label: 'Email' },
  FOLLOW_UP: { icon: Clock, color: 'orange', label: 'Follow-up' },
  CLOSE_DEAL: { icon: DollarSign, color: 'green', label: 'Fechar deal' },
  // ...
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/routes/ai.ts` | MODIFICAR — GET /leads/:id/next-action |
| `server/src/services/aiSalesService.ts` | MODIFICAR — generateNextAction() |
| `server/prisma/schema.prisma` | MODIFICAR — aiNextAction + aiNextActionUpdatedAt |
| `src/components/leads/NextActionBadge.tsx` | CRIAR |
| `src/pages/LeadDetail.tsx` | MODIFICAR — incluir NextActionBadge |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: endpoint + generateNextAction | 2h |
| Frontend: NextActionBadge + ação rápida | 2h |
| Testes + ajuste de prompt | 1h |
| **Total** | **~5h** |

---

## Verificação E2E

1. Lead com última interação há 8 dias → urgência HIGH, ação sugerida FOLLOW_UP
2. Lead em NEGOTIATION sem atividade → ação CLOSE_DEAL ou CALL
3. Lead novo sem interações → ação EMAIL, urgência LOW
4. Badge tooltip mostra justificativa ao hover
5. Clicar "Executar" em ação CALL → modal de interação abre com tipo CALL pré-selecionado

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
