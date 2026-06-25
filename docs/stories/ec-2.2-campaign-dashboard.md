# Story: Dashboard de Resultados de Campanha

**Story ID:** EC-2.2  
**Epic:** EPIC-EMAIL-CAMPAIGNS  
**Tipo:** Feature  
**Prioridade:** P1  
**Pontos:** 5  
**Sprint:** 2  
**Fase:** 2 — Tracking e Resultados  
**Dependências:** EC-2.1 completa (`CampaignEvent` com dados de abertura/clique)  
**Status:** Draft

---

## Descrição

Como usuário, quero ver um dashboard com as métricas de performance de cada campanha (taxa de abertura, cliques, bounces, unsubscribes), para entender o ROI de cada envio e melhorar campanhas futuras.

---

## Acceptance Criteria

### AC-1: Visão Geral na Listagem de Campanhas
- [ ] `Campaigns.tsx` exibe métricas resumidas inline na tabela: enviados | abertos (%) | cliques (%) | bounces (%) | unsubs (%)
- [ ] Métricas calculadas em tempo real a partir de `CampaignEvent` e `CampaignRecipient`

### AC-2: Página de Detalhe da Campanha
- [ ] `CampaignDetail.tsx` com 4 KPI cards no topo: Enviados | Taxa de Abertura | Taxa de Cliques | Bounces
- [ ] Gráfico de linha temporal: aberturas acumuladas ao longo do tempo (por hora nas primeiras 24h, por dia depois)
- [ ] Tabela de recipients com: lead (nome + email) | status | abriu? (data) | clicou? (data)
- [ ] Filtros da tabela: "Todos" | "Abriram" | "Clicaram" | "Não abriram" | "Bounce"
- [ ] Botão "Exportar CSV" dos recipients

### AC-3: Links Mais Clicados
- [ ] Seção "Links clicados" no detalhe: tabela URL | cliques totais | cliques únicos (por lead)
- [ ] Baseado em `CampaignEvent.metadata.url`

### AC-4: Backend — Endpoint de Métricas
- [ ] `GET /api/v1/campaigns/:id/stats` — calcula métricas agregadas
- [ ] Resposta: `{ sent, opened, openRate, clicked, clickRate, bounced, bounceRate, unsubscribed }`
- [ ] `GET /api/v1/campaigns/:id/stats/timeline` — eventos agrupados por hora/dia

---

## Dev Notes

### Query de métricas

```typescript
// server/src/routes/campaigns.ts
router.get('/:id/stats', authenticate, tenantScope, async (req, res) => {
  const { id, tenantId } = { id: req.params.id, tenantId: req.user.tenantId }

  const [sent, opened, clicked, bounced, unsubscribed] = await Promise.all([
    prisma.campaignRecipient.count({ where: { campaignId: id, campaign: { tenantId } } }),
    prisma.campaignRecipient.count({ where: { campaignId: id, campaign: { tenantId }, openedAt: { not: null } } }),
    prisma.campaignEvent.groupBy({
      by: ['leadId'],
      where: { campaignId: id, type: 'CLICKED', campaign: { tenantId } },
      _count: true
    }).then(r => r.length), // unique clickers
    prisma.campaignRecipient.count({ where: { campaignId: id, campaign: { tenantId }, status: 'BOUNCED' } }),
    prisma.campaignRecipient.count({ where: { campaignId: id, campaign: { tenantId }, status: 'UNSUBSCRIBED' } }),
  ])

  res.json({
    sent,
    opened, openRate: sent ? (opened / sent * 100).toFixed(1) : 0,
    clicked, clickRate: sent ? (clicked / sent * 100).toFixed(1) : 0,
    bounced, bounceRate: sent ? (bounced / sent * 100).toFixed(1) : 0,
    unsubscribed
  })
})
```

### Timeline query

```typescript
router.get('/:id/stats/timeline', authenticate, tenantScope, async (req, res) => {
  const events = await prisma.campaignEvent.findMany({
    where: { campaignId: req.params.id, type: 'OPENED', campaign: { tenantId: req.user.tenantId } },
    select: { occurredAt: true },
    orderBy: { occurredAt: 'asc' }
  })
  // Agrupar por hora no frontend ou no backend com date-fns
  res.json(events.map(e => e.occurredAt))
})
```

### Gráfico de linha temporal

```tsx
// Usar Recharts LineChart com dados agrupados por hora/dia
// Data point: { time: '14:00', opens: 23 }
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/routes/campaigns.ts` | MODIFICAR — GET /:id/stats, GET /:id/stats/timeline |
| `src/pages/Campaigns.tsx` | MODIFICAR — métricas na listagem |
| `src/pages/CampaignDetail.tsx` | CRIAR — página de detalhe |
| `src/components/campaigns/CampaignStats.tsx` | CRIAR — KPI cards + gráfico |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: endpoints de stats + timeline | 2h |
| Frontend: CampaignDetail + KPI cards | 2h |
| Frontend: gráfico Recharts + tabela filtrada | 1h |
| **Total** | **~5h** |

---

## Verificação E2E

1. Após enviar campanha para 10 leads, abrir 4 emails e clicar 2 links → stats: 40% abertura, 20% clique
2. Gráfico temporal mostra pico de aberturas logo após envio
3. Tabela de recipients filtrando "Abriram" → mostra apenas os 4
4. Tabela "Links clicados" mostra URL + contagem
5. Exportar CSV → arquivo com recipients e status

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
