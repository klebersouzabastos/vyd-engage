# Story: Chat Contextual no Lead

**Story ID:** AI-2.2  
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

Como vendedor, quero ter um chat de IA dentro do contexto do lead — onde posso fazer perguntas como "qual é o histórico com esse cliente?" ou "sugira um email de proposta" — para ter um assistente especializado no contexto específico daquele lead sem precisar copiar e colar informações manualmente.

---

## Acceptance Criteria

### AC-1: Painel de Chat na LeadDetail
- [ ] `LeadDetail` exibe aba "Assistente IA" (ao lado de Interações e Tarefas)
- [ ] Painel de chat com histórico de mensagens (scroll), input de texto e botão enviar
- [ ] Histórico persistido em `localStorage` por `leadId` (sem armazenar no banco — privacidade)
- [ ] Botão "Limpar histórico" no topo do painel
- [ ] Largura: painel lateral (33% da tela) ou aba expandida — responsivo

### AC-2: Streaming de Respostas
- [ ] Respostas da IA chegam em streaming (SSE — Server-Sent Events)
- [ ] Cursor piscante enquanto IA está respondendo
- [ ] Botão "Parar geração" para interromper resposta

### AC-3: Contexto Injetado Automaticamente
- [ ] Primeiro token do sistema = contexto do lead (nome, empresa, stage, últimas 10 interações)
- [ ] Contexto não visível para o usuário — injetado no backend como system message
- [ ] Perguntas contextuais funcionam sem o usuário precisar reexplicar o lead

### AC-4: Comandos Rápidos (Quick Actions)
- [ ] Chips de ações rápidas acima do input: "Resumir histórico", "Sugerir email", "Analisar objeções", "Próximos passos"
- [ ] Clicar em chip = preenche o input com uma pergunta pré-formulada + envia

### AC-5: Segurança e Custo
- [ ] Contexto enviado ao backend — nunca exposto à API da OpenAI pelo frontend
- [ ] Max 20 mensagens no histórico de conversa enviado ao modelo (janela de contexto)
- [ ] Model: `gpt-4o-mini` para custo, `gpt-4o` se `AI_PREMIUM_ENABLED=true`
- [ ] Rate limit: máx 30 mensagens/hora por usuário (via Redis ou in-memory)

---

## Dev Notes

### Endpoint SSE

```typescript
// server/src/routes/ai.ts
router.post('/leads/:id/chat', authenticate, tenantScope, async (req, res) => {
  const { messages } = req.body // últimas 20 mensagens do frontend
  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, tenantId: req.user.tenantId },
    include: { interactions: { orderBy: { occurredAt: 'desc' }, take: 10 }, deals: { take: 1 } }
  })

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const systemPrompt = buildLeadSystemPrompt(lead)
  const stream = await openai.chat.completions.create({
    model: process.env.AI_PREMIUM_ENABLED === 'true' ? 'gpt-4o' : 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-20)],
    stream: true,
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`)
  }
  res.write('data: [DONE]\n\n')
  res.end()
})
```

### System prompt contextual

```typescript
function buildLeadSystemPrompt(lead: LeadWithContext): string {
  return `Você é um assistente de vendas especializado no lead abaixo. 
Use APENAS as informações fornecidas para responder. Se não souber, diga que não tem a informação.

Lead: ${lead.name} | Empresa: ${lead.company ?? '?'} | Cargo: ${lead.position ?? '?'}
Stage atual: ${lead.deals[0]?.stage ?? 'sem deal ativo'}
Valor do deal: R$ ${lead.deals[0]?.value?.toFixed(2) ?? '?'}

Últimas interações:
${lead.interactions.map(i => `[${i.type}] ${i.content?.slice(0, 300)}`).join('\n')}

Responda sempre em português, de forma direta e útil para o vendedor.`
}
```

### Frontend — AIChatPanel

```tsx
// src/components/leads/AIChatPanel.tsx
// Usar fetch + ReadableStream para consumir SSE
const response = await fetch(`/api/v1/ai/leads/${leadId}/chat`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages })
})
const reader = response.body!.getReader()
// Ler chunks e acumular texto da resposta
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/routes/ai.ts` | MODIFICAR — POST /leads/:id/chat (SSE) |
| `server/src/services/aiSalesService.ts` | MODIFICAR — buildLeadSystemPrompt() |
| `src/components/leads/AIChatPanel.tsx` | CRIAR — painel de chat + SSE consumer |
| `src/pages/LeadDetail.tsx` | MODIFICAR — aba "Assistente IA" |

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| SSE quebrando em proxy reverso (Railway) | Média | Alto | Adicionar `X-Accel-Buffering: no` no header; Railway suporta SSE |
| Histórico em localStorage = sem sincronização entre dispositivos | Baixa | Baixo | Documentar limitação; opcional no futuro migrar para DB |
| Rate limit OpenAI excedido | Baixa | Médio | Retry com backoff exponencial no aiSalesService |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: endpoint SSE + system prompt | 3h |
| Frontend: AIChatPanel + SSE consumer + quick actions | 4h |
| Testes de integração SSE | 1h |
| **Total** | **~8h** |

---

## Verificação E2E

1. Abrir lead → aba "Assistente IA" visível
2. Digitar "Qual o histórico com esse lead?" → resposta em streaming menciona interações corretas
3. Clicar chip "Sugerir email" → pergunta pré-formulada enviada → email de proposta gerado
4. Botão "Parar geração" interrompe a resposta mid-stream
5. Atualizar página → histórico mantido via localStorage
6. Clicar "Limpar histórico" → painel vazio

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
