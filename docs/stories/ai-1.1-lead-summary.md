# Story: Resumo Contextual do Lead (IA)

**Story ID:** AI-1.1  
**Epic:** EPIC-AI-SALES  
**Tipo:** Feature  
**Prioridade:** P0  
**Pontos:** 5  
**Sprint:** 1  
**Fase:** 1 — Contexto e Próxima Ação (paralelo com AI-1.2)  
**Dependências:** `OPENAI_API_KEY` configurado em produção  
**Desbloqueia:** AI-1.2, AI-2.1, AI-2.2  
**Status:** Draft

---

## Descrição

Como vendedor, quero que o CRM gere automaticamente um resumo de 3-5 linhas sobre um lead — baseado no histórico de interações, notas, dados da empresa e estágio atual no funil — para que eu possa entrar em uma conversa de vendas já contextualizado, sem precisar rolar páginas de histórico.

---

## Acceptance Criteria

### AC-1: Card de Resumo na Página do Lead
- [ ] `LeadDetail` exibe card "Resumo IA" no topo da seção de contexto (acima da timeline)
- [ ] Card tem header "Resumo IA" + ícone de sparkle + botão "Atualizar"
- [ ] Estado inicial: esqueleto de loading enquanto primeira geração é feita
- [ ] Se sem interações suficientes (< 1 interação E sem notas): card mostra "Adicione interações ou notas para gerar um resumo"

### AC-2: Geração do Resumo
- [ ] `GET /api/v1/leads/:id/ai-summary` gera ou retorna resumo cacheado
- [ ] Cache: se resumo tem < 24h, retorna o cacheado sem chamar OpenAI
- [ ] Gerado a partir de: nome, empresa, cargo, notas, últimas 10 interações (tipo + conteúdo truncado a 500 chars cada), stage atual do deal ativo
- [ ] Resumo: 3-5 frases em português, focado em contexto de vendas
- [ ] Se OpenAI retorna erro: exibir "Não foi possível gerar o resumo. Tente novamente."

### AC-3: Botão "Atualizar"
- [ ] Botão "Atualizar" força nova geração (bypass cache)
- [ ] Loading spinner no card durante geração
- [ ] Novo resumo substitui o anterior

### AC-4: Custo e Segurança
- [ ] Prompt construído no backend (nunca no frontend) — dados sensíveis não saem do servidor
- [ ] Modelo: `gpt-4o-mini` (custo/qualidade ideal para resumos curtos)
- [ ] Max tokens resposta: 250
- [ ] Temperature: 0.3 (consistência sobre criatividade)

---

## Dev Notes

### Endpoint e cache

```typescript
// server/src/routes/ai.ts (adicionar)
router.get('/leads/:id/ai-summary', authenticate, tenantScope, apiLimiter, async (req, res) => {
  const { id } = req.params
  const { tenantId } = req.user
  const forceRefresh = req.query.refresh === 'true'

  const lead = await prisma.lead.findFirst({
    where: { id, tenantId },
    include: {
      interactions: { orderBy: { occurredAt: 'desc' }, take: 10 },
      deals: { where: { stage: { notIn: ['WON', 'LOST'] } }, take: 1 }
    }
  })
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' })

  // Cache simples: campo aiSummary + aiSummaryUpdatedAt no model Lead
  const cacheAge = lead.aiSummaryUpdatedAt
    ? Date.now() - lead.aiSummaryUpdatedAt.getTime()
    : Infinity
  if (!forceRefresh && cacheAge < 24 * 60 * 60 * 1000 && lead.aiSummary) {
    return res.json({ summary: lead.aiSummary, cached: true })
  }

  const summary = await aiSalesService.generateLeadSummary(lead)
  await prisma.lead.update({ where: { id }, data: { aiSummary: summary, aiSummaryUpdatedAt: new Date() } })
  res.json({ summary, cached: false })
})
```

### Prompt de resumo

```typescript
// server/src/services/aiSalesService.ts
async generateLeadSummary(lead: LeadWithContext): Promise<string> {
  const interactionText = lead.interactions
    .map(i => `[${i.type}] ${i.content?.slice(0, 500) ?? '(sem conteúdo)'}`)
    .join('\n')

  const prompt = `Você é um assistente de vendas. Gere um resumo CONCISO (3-5 frases) sobre o lead abaixo para ajudar o vendedor antes de uma conversa.

Lead: ${lead.name}
Empresa: ${lead.company ?? 'não informada'}
Cargo: ${lead.position ?? 'não informado'}
Estágio atual: ${lead.deals[0]?.stage ?? 'sem deal ativo'}
Notas: ${lead.notes ?? 'nenhuma'}

Últimas interações:
${interactionText || 'Nenhuma interação registrada'}

Foque em: situação atual do lead, tom do relacionamento, próximos passos evidentes. Escreva em português.`

  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 250,
    temperature: 0.3,
  })
  return response.choices[0].message.content ?? ''
}
```

### Migração Prisma (campo de cache)

```prisma
// Lead — adicionar
aiSummary          String?
aiSummaryUpdatedAt DateTime?
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/routes/ai.ts` | MODIFICAR — adicionar GET /leads/:id/ai-summary |
| `server/src/services/aiSalesService.ts` | CRIAR — generateLeadSummary() |
| `server/prisma/schema.prisma` | MODIFICAR — Lead.aiSummary + aiSummaryUpdatedAt |
| `src/components/leads/AISummaryCard.tsx` | CRIAR — card com cache + refresh |
| `src/pages/LeadDetail.tsx` | MODIFICAR — incluir AISummaryCard |

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Custo OpenAI com muitos leads | Média | Médio | Cache de 24h; rate limit por tenant |
| Resumo com dados incorretos/alucinação | Baixa | Médio | Prompt estritamente baseado em dados reais; temperature 0.3 |
| `OPENAI_API_KEY` não configurado em dev | Alta | Baixo | Retornar mock em dev; checkar env na inicialização |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: endpoint + aiSalesService + migração | 2h |
| Frontend: AISummaryCard + integração | 2h |
| Testes e ajustes de prompt | 1h |
| **Total** | **~5h** |

---

## Verificação E2E

1. Abrir lead com 3+ interações → card "Resumo IA" carrega automaticamente em < 5s
2. Conteúdo do resumo menciona empresa/interações do lead
3. Clicar "Atualizar" → novo resumo gerado (diferente se houve novas interações)
4. Abrir mesmo lead em até 24h → indicador "cached" (sem nova chamada OpenAI)
5. Lead sem interações → mensagem orientativa no lugar do resumo
6. `OPENAI_API_KEY` ausente → erro amigável exibido, não quebra a página

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
