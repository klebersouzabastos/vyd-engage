# PRD — Épico: AI Sales Assistant

**Epic ID:** EPIC-AI-SALES  
**Prioridade:** P0 (diferenciador competitivo)  
**Duração estimada:** 3-4 semanas  
**Sequência no Roadmap:** 2 de 4

---

## Contexto

O VYD Engage já tem scoring de leads e sugestão básica de próxima ação (`nextActionService.ts`). O passo seguinte é transformar esses sinais isolados em uma experiência de assistente integrada: o vendedor abre o lead e, em segundos, entende o contexto completo e sabe exatamente o que fazer.

Nenhum CRM BR de médio porte entrega isso de forma integrada. É o principal argumento de venda para equipes que já usam IA em outros contextos.

---

## Personas

| Persona | Perfil | Dor Principal |
|---------|--------|---------------|
| **Vendedor Experiente** | 40+ leads ativos, usa CRM diariamente | "Abro o lead e preciso rolar 3 telas de histórico para lembrar onde parei." |
| **SDR/BDR** | Alta rotatividade de leads, foco em abertura | "Não sei quais leads vale a pena priorizar hoje. Fico tentando 'a' feeling." |
| **Gestor Comercial** | Quer ver por que deals estão parando | "Não consigo saber quais deals vão fechar sem ligar para cada vendedor." |

---

## Análise de Gaps

| Gap | Impacto |
|-----|---------|
| `nextActionService` retorna texto sem contexto | Sugestão genérica, baixa confiança |
| Sem resumo automático de histórico | Vendedor gasta 2-5 min re-lendo interações antigas |
| Score de lead sem explicação | Não gera ação — apenas um número |
| Sem predição de deal | Gestor não sabe onde focar coaching |
| AI drift isolado em `aiDraftService` | IA só no email draft, não na análise |

---

## Épico: AI Sales Assistant

### Fase 1 — Contexto e Próxima Ação (P0 — 2 semanas)

---

**Story AI-1.1 — Resumo Contextual do Lead (IA)**

Como vendedor, quero ver um resumo em linguagem natural do estado atual do lead ao abrir o detalhe, para não precisar ler todo o histórico manualmente.

*Requisitos funcionais:*
- Card "Resumo IA" no topo de `LeadDetail` — colapsável, aberto por padrão
- Conteúdo gerado com base em: últimas 10 interações, deals ativos, tarefas pendentes, score atual
- Inclui: última interação (quando e o quê), situação dos deals abertos, próxima tarefa pendente, score e tendência
- Geração lazy: só dispara quando o card é expandido (não bloqueia carregamento da página)
- Cache de 30 minutos por lead (Redis ou localStorage com timestamp)
- Botão "Atualizar" para forçar novo resumo
- Badge "IA" no card — transparência para o usuário

*Backend:* `GET /api/v1/leads/:id/ai-summary` — agrega dados do lead e chama `aiDraftService` com prompt especializado. Usa `AI_PROVIDER` + `AI_API_KEY` do `.env`.

*Frontend:* `src/components/leads/AISummaryCard.tsx`. Lazy load via Intersection Observer ou click-to-expand.

---

**Story AI-1.2 — Sugestão de Próxima Ação com Justificativa**

Como vendedor, quero receber uma sugestão de próxima ação para um lead com a justificativa, para agir com mais confiança.

*Requisitos funcionais:*
- Enhances `nextActionService.ts` existente: adiciona `reasoning` (1-2 frases) ao retorno
- Exibe em `LeadDetail` e no card de lead na listagem (tooltip ou badge expandível)
- Ações possíveis: CALL, EMAIL, WHATSAPP, MEETING, FOLLOW_UP, DEMO, PROPOSAL, CLOSE
- Justificativa contextualizada: "Última interação há 7 dias (email sem resposta). Recomendo ligação direta."
- Recalcula automaticamente após nova interação registrada

*Backend:* `GET /api/v1/leads/:id/next-action` — expande retorno de `nextActionService` com campo `reasoning: string`.

*Frontend:* `src/components/leads/NextActionBadge.tsx` — badge com ícone da ação + tooltip com justificativa.

---

### Fase 2 — Predição e Chat (P1 — 2 semanas)

---

**Story AI-2.1 — Score de Propensão de Fechamento por Deal**

Como gestor, quero ver uma probabilidade de fechamento calculada por IA para cada deal, para priorizar coaching e forecast.

*Requisitos funcionais:*
- Score 0-100% por deal, calculado por IA com base em: tempo no stage, n° de interações, último contato, valor do deal, histórico do assignee (win rate)
- Exibido em `DealDetail` e no card do pipeline kanban (gauge circular pequeno)
- Classificação: 🔴 < 30% | 🟡 30-70% | 🟢 > 70%
- Explicação em hover/click: 3 fatores principais que influenciam o score
- Recalcula semanalmente via job (BullMQ) ou sob demanda

*Backend:* `GET /api/v1/deals/:id/ai-score` — agrega métricas do deal e chama AI provider. Armazena em `Deal.aiScore Float?` e `Deal.aiScoreUpdatedAt DateTime?` (migração Prisma). Job `scoreDeals.ts` recalcula em batch.

*Frontend:* `src/components/deals/DealAIScore.tsx` — gauge + tooltip com fatores.

---

**Story AI-2.2 — Chat Contextual no Lead**

Como vendedor, quero fazer perguntas em linguagem natural sobre um lead e receber respostas baseadas no histórico real, para tomar decisões sem re-ler tudo.

*Requisitos funcionais:*
- Painel lateral "Chat IA" em `LeadDetail` — input de pergunta, stream de resposta
- Perguntas exemplo: "Quando foi o último contato?", "Qual é o status do deal?", "Quais são as objeções do lead?"
- Respostas com referência ao dado real (não inventar): "Última ligação em 2026-06-15, anotação: 'interessado, pedir proposta'"
- Histórico da conversa local (sessionStorage — não persiste entre sessões)
- Indicação clara que é IA e pode cometer erros
- Streaming de resposta (tokens progressivos) para melhor UX

*Backend:* `POST /api/v1/leads/:id/ai-chat` — recebe `{ message: string, history: ChatMessage[] }`. Agrega contexto do lead (interações, deals, tasks) e usa `streamText` do Vercel AI SDK.

*Frontend:* `src/components/leads/AIChatPanel.tsx` — input + área de stream. Usa `useChat` hook (Vercel AI SDK se disponível, ou fetch manual com ReadableStream).

---

## Requisitos Não-Funcionais

- Rate limit AI: 30 chamadas/min por tenant (evitar custos descontrolados)
- Fallback: se `AI_PROVIDER` não configurado → esconde cards de IA com mensagem de setup
- Custo por uso: logar tokens consumidos para análise futura de billing
- Latência: resumo e score devem retornar em < 3s (p95)
- PII: nunca logar conteúdo das respostas (só metadados: tokens, latência, lead_id)

---

## Modelo de Dados

```prisma
// Adicionar em Deal:
aiScore          Float?
aiScoreUpdatedAt DateTime?
aiScoreFactors   Json?  // [{ factor: string, weight: number }]
```

---

## Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| % de leads abertos com card AI Summary expandido | > 50% |
| CTR em "Sugestão de Próxima Ação" → ação criada | > 30% |
| Retenção de usuários que usam AI Chat vs. não usam (D30) | +20pp |
| NPS da feature "Resumo do Lead" | > 4.5/5 |
