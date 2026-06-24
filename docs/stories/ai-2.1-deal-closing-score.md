# Story: Score de Propensão de Fechamento por Deal

**Story ID:** AI-2.1  
**Epic:** EPIC-AI-SALES  
**Tipo:** Feature  
**Prioridade:** P1  
**Pontos:** 8  
**Sprint:** 2  
**Fase:** 2 — Predição e Chat  
**Dependências:** AI-1.1 (padrão de integração aiSalesService estabelecido)  
**Status:** Draft

---

## Descrição

Como gerente comercial, quero ver um score de propensão de fechamento (0-100) para cada deal aberto, com os principais fatores que influenciam o score, para priorizar o esforço da equipe nos deals com maior chance de fechar e identificar deals em risco antes que seja tarde.

---

## Acceptance Criteria

### AC-1: Score Visual no Kanban e no Detalhe do Deal
- [ ] `DealCard` no Kanban exibe badge circular com o score (verde 70-100, amarelo 40-69, vermelho 0-39)
- [ ] `DealDetail` exibe seção "Score de Fechamento" com gauge de 0-100 e lista dos top 3 fatores positivos e negativos
- [ ] Score exibido como "XX% propensão"

### AC-2: Geração e Armazenamento do Score
- [ ] `POST /api/v1/deals/:id/ai-score` gera novo score (chamada manual ou automática)
- [ ] Score armazenado em `Deal.aiScore`, `Deal.aiScoreUpdatedAt`, `Deal.aiScoreFactors` (JSON)
- [ ] Geração automática quando deal muda de stage (disparo não-bloqueante, `.catch(() => {})`)
- [ ] Modelo: `gpt-4o-mini` com structured output (JSON schema)
- [ ] Cache: 12h — `GET /api/v1/deals/:id/ai-score` retorna cached se < 12h

### AC-3: Fatores do Score
- [ ] Resposta inclui `factors: { label: string, impact: 'positive'|'negative', weight: number }[]` (max 5 fatores)
- [ ] Fatores derivados de: dias em stage, número de interações, valor do deal, empresa do lead, histórico de wins/losses no tenant
- [ ] Exibidos em `DealDetail` como chips coloridos (verde/vermelho)

### AC-4: Job de Re-scoring em Batch
- [ ] Job BullMQ `dealScorer` roda diariamente às 06h
- [ ] Re-calcula score para todos deals abertos do tenant com score > 12h
- [ ] Gated por flag `ENABLE_DEAL_SCORER_JOB` (default false para não gastar créditos em dev)

---

## Dev Notes

### Campos no modelo Deal

```prisma
// server/prisma/schema.prisma — Deal
aiScore          Float?
aiScoreUpdatedAt DateTime?
aiScoreFactors   Json?
```

### Endpoint e geração

```typescript
// server/src/routes/ai.ts
router.post('/deals/:id/ai-score', authenticate, tenantScope, async (req, res) => {
  const deal = await prisma.deal.findFirst({
    where: { id: req.params.id, tenantId: req.user.tenantId },
    include: { lead: { include: { interactions: { take: 10 } } } }
  })
  if (!deal) return res.status(404).json({ error: 'Deal não encontrado' })

  const result = await aiSalesService.generateDealScore(deal)
  await prisma.deal.update({
    where: { id: deal.id },
    data: { aiScore: result.score, aiScoreUpdatedAt: new Date(), aiScoreFactors: result.factors }
  })
  res.json(result)
})
```

### Prompt estruturado

```typescript
async generateDealScore(deal: DealWithLead) {
  const prompt = `Avalie a propensão de fechamento deste deal de CRM (0-100).

Deal: ${deal.name}
Valor: R$ ${deal.value?.toFixed(2) ?? '?'}
Stage: ${deal.stage}
Dias no stage atual: ${daysSince(deal.stageChangedAt)}
Lead: ${deal.lead.name} | ${deal.lead.company}
Interações nos últimos 30 dias: ${deal.lead.interactions.length}
Probabilidade declarada: ${deal.probability ?? 'não definida'}%

Responda em JSON: {"score": <0-100>, "factors": [{"label": "...", "impact": "positive|negative", "weight": <1-3>}], "reasoning": "..."}`

  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })
  return JSON.parse(response.choices[0].message.content!)
}
```

### DealAIScore component (gauge circular)

```tsx
// Usar Recharts RadialBarChart ou uma implementação SVG simples
// Score 0-100 → arco de 0° a 270°
const scoreColor = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red'
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/routes/ai.ts` | MODIFICAR — POST/GET /deals/:id/ai-score |
| `server/src/services/aiSalesService.ts` | MODIFICAR — generateDealScore() |
| `server/src/jobs/dealScorer.ts` | CRIAR — job BullMQ de re-scoring |
| `server/prisma/schema.prisma` | MODIFICAR — Deal.aiScore/aiScoreUpdatedAt/aiScoreFactors |
| `src/components/deals/DealAIScore.tsx` | CRIAR — gauge + fatores |
| `src/components/deals/DealCard.tsx` | MODIFICAR — badge do score |
| `src/pages/DealDetail.tsx` | MODIFICAR — seção Score |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: endpoint + generateDealScore + migração | 3h |
| Backend: job dealScorer | 1h |
| Frontend: DealAIScore + DealCard badge | 3h |
| Testes + prompt tuning | 1h |
| **Total** | **~8h** |

---

## Verificação E2E

1. Abrir deal em NEGOTIATION há 5 dias com 3 interações → score > 60
2. Deal parado há 15 dias sem interações → score < 30, fatores negativos visíveis
3. DealCard no Kanban mostra badge colorido corretamente
4. Mudar stage do deal → score regenerado automaticamente em background
5. `GET /api/v1/deals/:id/ai-score` com cache < 12h → sem nova chamada OpenAI

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
