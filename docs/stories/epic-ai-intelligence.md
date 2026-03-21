# Epic: AI Intelligence — Revenue Forecast, Funnel Analytics, AI Assistant & Email Generation

**Epic ID:** EPIC-INTELLIGENCE
**Tipo:** Feature — Competitive Advantage
**Prioridade:** P1 — Features que diferenciam o VYD Engage de CRMs genéricos
**Origem:** Análise competitiva — Morgan (PM) — 2026-03-18
**Data:** 2026-03-18
**Agente:** @pm (Morgan)
**Status:** Done
**Closed:** 2026-03-20
**Closed By:** Pax (PO)
**Commit:** a7e12bc
**Estimativa Total:** ~23 pontos (4 stories)

---

## Epic Summary

O VYD Engage possui pipeline de deals com value/probability/stage, scoring rule-based funcional, dashboard com métricas básicas e pipeline kanban. Porém, faltam capacidades analíticas avançadas e inteligência preditiva que concorrentes já oferecem. Este epic entrega 4 features progressivas: forecast de receita baseado em dados existentes, visualização de conversão do funil, assistente de ações sugeridas (rule-based), e geração de emails por IA.

**Diferencial:** Stories 1 e 2 são 100% determinísticas (math pura sobre dados existentes). Story 3 é rule-based (sem LLM). Apenas Story 4 introduz dependência de LLM — com fallback para templates estáticos.

**Métricas de sucesso:**
- Usuário visualiza forecast de receita dos próximos 3-6 meses em < 2 segundos
- Taxas de conversão entre stages do funil visíveis e filtráveis
- Cada lead/deal exibe sugestão de próxima ação sem intervenção manual
- Tempo de composição de email reduzido em 70% com drafts gerados por IA
- Fallback funcional: sistema opera 100% sem chave de API de IA configurada

---

## Análise do Estado Atual

### O que já existe (lido do codebase):

| Componente | Status | Arquivo | Dados Relevantes |
|---|---|---|---|
| Deal model completo | Existe | `server/prisma/schema.prisma` | `value Decimal(12,2)`, `probability Int`, `expectedCloseDate DateTime?`, `stage DealStage`, `closedAt DateTime?`, `createdAt` |
| DealStage enum | Existe | `schema.prisma` | QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSING, WON, LOST |
| STAGE_PROBABILITY map | Existe | `server/src/services/dealService.ts:6-13` | QUALIFICATION=20, PROPOSAL=40, NEGOTIATION=60, CLOSING=80, WON=100, LOST=0 |
| dealService.getStats() | Existe | `server/src/services/dealService.ts:228-339` | Já calcula: totalPipelineValue, weightedValue, wonValue, lostValue, winRate, avgDealSize, avgCycleTime, byStage |
| DealAnalytics component | Existe | `src/components/deals/DealAnalytics.tsx` | Exibe Pipeline, Forecast Ponderado, Ganhos, Win Rate, tabela por stage |
| Lead scoring rules | Existe | `server/src/services/scoringService.ts` | processEvent(), recalculateLeadScore(), ScoreEvent enum |
| Lead model com score | Existe | `schema.prisma` | `score Int @default(0)` |
| LeadStatus enum | Existe | `schema.prisma` | NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST |
| Reports/metrics endpoint | Existe | `server/src/routes/reports.ts:50-261` | `/api/reports/metrics` — leads by status, by source, pipeline stages, tasks, interactions by day |
| Interaction model | Existe | `schema.prisma` | type, direction, content, leadId, dealId, createdAt |
| Dashboard page | Existe | `src/pages/Dashboard.tsx` | Widgets grid, charts, DealAnalytics (compact), date range filter |
| Pipeline page (Kanban) | Existe | `src/pages/Pipeline.tsx` | Funil kanban com drag-drop, filtro por source, resumo do funil |
| Email send flow | Existe | `server/src/routes/` + `src/pages/EmailCampaigns.tsx` | Envio de email funcional |
| Funnel/FunnelColumn models | Existe | `schema.prisma` | Funnel com columns, leads por column, mappedStatus |
| Index em expectedCloseDate | Existe | `schema.prisma` | `@@index([tenantId, expectedCloseDate])` no Deal |

### O que NÃO existe (gaps):

| Gap | Impacto |
|---|---|
| Forecast temporal (por mês) | Não há visão de receita futura distribuída no tempo |
| Gráfico de tendência Won vs Lost | Não há análise histórica de resultados |
| Funnel conversion rates | Pipeline stages mostram contagem, mas não taxas de conversão |
| Drop-off analysis | Sem visibilidade de onde leads abandonam o funil |
| Time-in-stage calculation | `avgTimeInStage` retorna `{}` vazio no endpoint metrics |
| Next-best-action engine | Zero sugestões automatizadas de ação |
| AI email generation | Emails são 100% manuais |
| AI settings/config page | Não há configuração de provider de IA |

---

## Inventário de Reusos

| Componente | Reuso | Arquivo | Como Reaproveitar |
|---|---|---|---|
| `dealService.getStats()` | Estender | `server/src/services/dealService.ts` | Base para forecast — já calcula weightedValue por stage |
| `STAGE_PROBABILITY` map | Reusar | `dealService.ts:6-13` | Probabilidade default por stage |
| `DealAnalytics` component | Estender | `src/components/deals/DealAnalytics.tsx` | Adicionar gráfico de forecast temporal |
| `/api/reports/metrics` | Estender | `server/src/routes/reports.ts` | Adicionar funnel conversion, time-in-stage |
| Dashboard page + widgets | Estender | `src/pages/Dashboard.tsx` | Adicionar widget de forecast e funnel |
| Pipeline page stats | Estender | `src/pages/Pipeline.tsx` | Adicionar conversion rates ao resumo |
| `scoringService` | Reusar | `server/src/services/scoringService.ts` | Score trend para next-best-action |
| Interaction model queries | Reusar | `schema.prisma` Interaction | Last interaction date para stale detection |
| `apiClient` | Estender | `src/services/api/client.ts` | Novos métodos para forecast, AI |
| shadcn/ui components | Reusar | `src/components/ui/` | Dialog, Card, Select, Tabs para novas UIs |
| `useDashboard` hook | Estender | `src/hooks/useDashboard.ts` | Incluir forecast data |
| Deal index `[tenantId, expectedCloseDate]` | Reusar | `schema.prisma` | Query de forecast por mês já indexada |

---

## Stories

---

### Story 1 | Revenue Forecast Dashboard (5 pts)

**Prioridade:** P1 | **Pontos:** 5 | **Sprint:** 1
**Dependências:** Nenhuma (usa dados existentes do Deal model)

**Descrição:** Criar dashboard de forecast de receita baseado em deals ativos. Cálculos 100% server-side usando `deal.value * deal.probability / 100` agrupados por `expectedCloseDate`. Sem IA — é matemática pura sobre dados que já existem no banco.

**AC:**

Backend:
- [ ] `GET /api/deals/forecast` retorna forecast mensal dos próximos 6 meses
- [ ] Cálculo: para cada mês, agregar deals cujo `expectedCloseDate` cai naquele mês
- [ ] Cada mês retorna: `{ month: '2026-04', totalValue: number, weightedValue: number, dealCount: number }`
- [ ] `weightedValue = SUM(deal.value * deal.probability / 100)` para deals do mês
- [ ] Filtros opcionais via query params: `?months=6&assignedTo=userId&stage=NEGOTIATION`
- [ ] Deals sem `expectedCloseDate` aparecem em bucket "Sem previsão"
- [ ] Endpoint tenant-scoped (usa `req.tenantId`)

Won vs Lost trend:
- [ ] `GET /api/deals/trend` retorna contagem e valor de deals WON vs LOST por mês nos últimos 6 meses
- [ ] Agrupa por `closedAt` month: `{ month: '2026-03', won: { count, value }, lost: { count, value } }`
- [ ] Exclui deals sem `closedAt`

KPIs agregados:
- [ ] Response inclui KPIs: `totalPipelineValue`, `totalWeightedForecast`, `avgDealSize`, `avgCloseTimeDays`
- [ ] KPIs reutilizam lógica do `dealService.getStats()` existente

Frontend — Widget no Dashboard:
- [ ] Novo widget "Forecast de Receita" na Dashboard existente
- [ ] Exibe: valor total do pipeline, forecast ponderado total, ticket médio
- [ ] Mini bar chart mostrando forecast por mês (próximos 3 meses)
- [ ] Link "Ver detalhes" navega para página dedicada

Frontend — Página dedicada `/app/forecast`:
- [ ] Gráfico de barras: forecast ponderado por mês (6 meses)
- [ ] Gráfico de linha: tendência Won vs Lost (últimos 6 meses)
- [ ] Tabela detalhada: cada mês com total, ponderado, contagem de deals
- [ ] Filtros: período, assignee, stage mínimo
- [ ] Cards no topo: Pipeline Total, Forecast Ponderado, Avg Deal Size, Avg Cycle Time
- [ ] Responsivo: cards empilham em mobile

Testes:
- [ ] 3 deals com expectedCloseDate em meses diferentes → forecast correto por mês
- [ ] Deal com probability=50 e value=10000 → weighted = 5000
- [ ] Deals sem expectedCloseDate aparecem no bucket "Sem previsão"
- [ ] Won vs Lost trend mostra dados corretos dos últimos 6 meses
- [ ] Filtro por assignee retorna apenas deals do usuário

**Dev Notes:**
- Criar `server/src/routes/deals.ts` ou estender se já existe — adicionar rotas `/forecast` e `/trend`
- Usar `prisma.deal.groupBy()` com `expectedCloseDate` truncado ao mês, ou raw query com `DATE_TRUNC('month', "expectedCloseDate")`
- Para Won vs Lost trend: `prisma.deal.groupBy()` onde `stage IN ('WON','LOST')` agrupado por `DATE_TRUNC('month', "closedAt")`
- Reusar `STAGE_PROBABILITY` de `dealService.ts` como fallback
- Frontend: usar Recharts (já no projeto?) ou chart nativo do shadcn. Verificar se `recharts` está no `package.json`
- Nova página: `src/pages/Forecast.tsx` — registrar rota em `App.tsx`
- Widget no dashboard: criar `src/components/forecast/ForecastWidget.tsx`
- Index `[tenantId, expectedCloseDate]` já existe no Deal — queries serão performáticas

**Inventário de reusos (Story 1):**
| Ativo | Reuso |
|---|---|
| `dealService.getStats()` | KPIs base (weightedValue, avgDealSize, avgCycleTime) |
| `DealAnalytics` component | Padrão visual dos StatCards |
| Index `[tenantId, expectedCloseDate]` | Performance da query de forecast |
| `useDashboard` hook pattern | Padrão para novo `useForecast` hook |
| Dashboard widget system | Adicionar widget de forecast |

**Riscos:**
| Risco | Probabilidade | Mitigação |
|---|---|---|
| Muitos deals sem expectedCloseDate | Alta | Bucket "Sem previsão" + alerta UX incentivando preenchimento |
| Performance com muitos deals | Baixa | Index já existe; groupBy é O(n) no banco |
| Gráfico library não instalada | Média | Verificar package.json; instalar recharts se necessário |

---

### Story 2 | Funnel Conversion Visualization (5 pts)

**Prioridade:** P1 | **Pontos:** 5 | **Sprint:** 1
**Dependências:** Nenhuma (usa dados existentes de Lead e Deal)

**Descrição:** Criar visualização de funil de conversão mostrando taxa de transição entre cada stage do lead e do deal. Calcular onde leads/deals são perdidos (drop-off) e quanto tempo ficam em cada stage. Dados já existem — falta apenas a query de agregação e a visualização.

**AC:**

Backend — Lead Funnel:
- [ ] `GET /api/reports/funnel` retorna volume e conversion rate por lead stage
- [ ] Para cada transição (NEW→CONTACTED, CONTACTED→QUALIFIED, etc.), calcula: `conversionRate = count_next_stage / count_current_stage * 100`
- [ ] Retorna: `{ stages: [{ stage, count, conversionToNext, dropOffRate, avgTimeInStage }] }`
- [ ] `avgTimeInStage`: calculado a partir de Interactions do tipo STATUS_CHANGE (timestamps de mudança)
- [ ] Filtros: `?from=date&to=date&source=WEBSITE&assignedTo=userId`
- [ ] Tenant-scoped

Backend — Deal Funnel:
- [ ] `GET /api/reports/deal-funnel` retorna volume e conversion por deal stage
- [ ] Mesma estrutura: count por stage, conversion rate, drop-off
- [ ] Usa `deal.stage` e `deal.value` para calcular valor acumulado por stage

Frontend — Componente de Funnel:
- [ ] Componente `FunnelChart` visual: barras horizontais decrescentes (formato funil clássico)
- [ ] Cada barra mostra: nome do stage, contagem, percentual do total, taxa de conversão para próximo stage
- [ ] Cores do CHART_COLORS existente (ou gradiente de azul→verde)
- [ ] Indicador visual de drop-off entre stages (seta + percentual vermelho)
- [ ] Tooltip com detalhes ao hover

Frontend — Página `/app/funnel`:
- [ ] Tabs: "Lead Funnel" e "Deal Funnel"
- [ ] Filtros: date range, source (para leads), assignee
- [ ] Seção "Time in Stage": cards mostrando avg time em cada stage
- [ ] Seção "Drop-off Analysis": highlight dos stages com maior perda
- [ ] Responsivo

Frontend — Widget no Dashboard:
- [ ] Mini funnel no dashboard mostrando os 3 principais stages com conversion rates
- [ ] Link para página completa

Testes:
- [ ] 10 leads NEW, 8 CONTACTED, 4 QUALIFIED, 2 WON → conversions: 80%, 50%, 50%
- [ ] Filtro por source "WEBSITE" retorna apenas leads daquela source
- [ ] Deal funnel mostra valor acumulado correto por stage
- [ ] avgTimeInStage retorna valor > 0 quando há interactions de STATUS_CHANGE

**Dev Notes:**
- Endpoint `/api/reports/funnel`: usar `prisma.lead.groupBy({ by: ['status'] })` para contagem por stage
- Para conversion rate: stage N tem `X` leads, stage N+1 tem `Y` leads → rate = Y/X*100. Approach simplificado (snapshot, não cohort)
- Para `avgTimeInStage`: buscar Interactions do tipo STATUS_CHANGE, calcular diff entre timestamps consecutivas por lead. Alternativa mais simples: calcular baseado em createdAt e updatedAt se interações não estiverem disponíveis
- O endpoint `/api/reports/metrics` (reports.ts:50) já retorna `pipelineStages` com count por stage e `avgTimeInStage: {}` (vazio) — estender para preencher
- FunnelChart: componente custom com divs estilizadas (não precisa de lib de gráfico) — widths proporcionais
- Stage order definido em reports.ts:123: `['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']`
- Stage colors definidas em reports.ts:124-127 — reusar

**Inventário de reusos (Story 2):**
| Ativo | Reuso |
|---|---|
| `/api/reports/metrics` pipelineStages | Contagem por stage já pronta |
| `stageOrder` + `stageColors` + `stageNames` | Mapeamento de stages em reports.ts |
| Dashboard widget system | Adicionar mini funnel widget |
| Interaction model (STATUS_CHANGE) | Base para time-in-stage |
| `CHART_COLORS` | Design tokens para cores |
| Filtro de date range no Dashboard | Reusar pattern para filtros do funnel |

**Riscos:**
| Risco | Probabilidade | Mitigação |
|---|---|---|
| Poucos leads com interações de STATUS_CHANGE | Alta | Fallback: calcular time-in-stage com heurística baseada em createdAt/updatedAt |
| Conversion rate "snapshot" não reflete cohort real | Média | Documentar como "snapshot atual"; cohort analysis fica como evolução futura |
| Stage order customizado (FunnelColumn) vs enum | Média | Usar LeadStatus enum para funil padrão; menção ao Funnel model como evolução |

---

### Story 3 | AI Assistant — Next Best Action (8 pts)

**Prioridade:** P2 | **Pontos:** 8 | **Sprint:** 2
**Dependências:** Nenhuma (usa dados existentes, mas beneficia-se da Story 1 para context)

**Descrição:** Para cada lead e deal, exibir sugestão da "próxima melhor ação" baseada em regras determinísticas. Engine 100% rule-based — sem LLM. Analisa: tempo desde última interação, tendência do score, stage + probability, e padrões de deals ganhos. Exibe como card contextual nas páginas de detalhe de lead e deal.

**AC:**

Backend — Next Best Action Engine:
- [ ] `GET /api/leads/:id/next-action` retorna sugestão de ação para o lead
- [ ] `GET /api/deals/:id/next-action` retorna sugestão de ação para o deal
- [ ] Response: `{ action: string, reason: string, priority: 'high'|'medium'|'low', category: string }`
- [ ] Service: `server/src/services/nextActionService.ts` — engine determinístico

Regras para Leads:
- [ ] **Stale lead** (> 7 dias sem interação): action="Fazer follow-up", priority=high
- [ ] **Hot lead** (score > 70): action="Agendar reunião — lead quente", priority=high
- [ ] **Score caindo** (score atual < score 7 dias atrás): action="Re-engajar — score em queda", priority=medium
- [ ] **Sem email** (lead sem email cadastrado): action="Coletar email de contato", priority=medium
- [ ] **Novo sem contato** (status=NEW, > 24h): action="Fazer primeiro contato", priority=high
- [ ] **Qualified sem deal** (status=QUALIFIED, nenhum deal vinculado): action="Criar deal/oportunidade", priority=medium
- [ ] Priorização: retorna a ação de maior prioridade; se empate, a mais urgente por tempo

Regras para Deals:
- [ ] **Deal estagnado** (> 14 dias no mesmo stage): action="Mover negociação — deal parado há X dias", priority=high
- [ ] **Probability baixa em stage avançado** (CLOSING + probability < 50): action="Agendar reunião de fechamento", priority=high
- [ ] **Sem expectedCloseDate**: action="Definir data prevista de fechamento", priority=medium
- [ ] **ExpectedCloseDate passada**: action="Atualizar previsão — data expirada", priority=high
- [ ] **Deal grande sem interação recente** (value > avg e > 7 dias sem interação): action="Priorizar — deal de alto valor", priority=high

Frontend — Lead Detail:
- [ ] Card "Próxima Ação" no topo da página de detalhe do lead
- [ ] Exibe: ícone de categoria, texto da ação, razão, badge de prioridade
- [ ] Cores: high=red/orange, medium=yellow, low=gray
- [ ] Botão "Fazer agora" que navega para a ação relevante (ex: abrir modal de interação, criar deal)
- [ ] Se não há ação sugerida: exibe "Tudo em dia" com check verde

Frontend — Deal Detail:
- [ ] Mesmo padrão do lead detail — card "Próxima Ação"
- [ ] Ações contextuais ao deal (atualizar stage, definir data, etc.)

Frontend — Dashboard Widget:
- [ ] Widget "Ações Pendentes" no dashboard: lista os top 5 leads/deals com ações de alta prioridade
- [ ] Cada item: nome do lead/deal, ação sugerida, link direto

Testes:
- [ ] Lead com última interação há 10 dias → "Fazer follow-up"
- [ ] Lead com score 85 → "Agendar reunião — lead quente"
- [ ] Deal em CLOSING com probability 30 → "Agendar reunião de fechamento"
- [ ] Deal sem expectedCloseDate → "Definir data prevista de fechamento"
- [ ] Lead com tudo ok (contato recente, score estável, deal vinculado) → "Tudo em dia"
- [ ] Dashboard mostra top 5 ações de alta prioridade

**Dev Notes:**
- Criar `server/src/services/nextActionService.ts` com funções `getLeadNextAction(tenantId, leadId)` e `getDealNextAction(tenantId, dealId)`
- Para "última interação": `prisma.interaction.findFirst({ where: { leadId }, orderBy: { createdAt: 'desc' } })`
- Para "score trend": comparar `lead.score` atual com score calculado em recalculate. Alternativa: armazenar snapshot de score semanal (mas adiciona schema change — evitar na v1, usar heurística)
- Para "deals do lead": `prisma.deal.findMany({ where: { leadId } })`
- Pattern de priorização: array de regras ordenadas por prioridade, primeira que matcha retorna
- Rotas: adicionar em `server/src/routes/leads.ts` e `server/src/routes/deals.ts` (GET `/:id/next-action`)
- Frontend: componente `NextActionCard` reutilizável para lead e deal
- Para "score caindo" sem histórico: v1 pode simplesmente pular essa regra e focar nas outras. Evolução futura: ScoreHistory model

**Inventário de reusos (Story 3):**
| Ativo | Reuso |
|---|---|
| `scoringService.ts` | Score atual do lead |
| Interaction model | Última interação (date) |
| Deal model (stage, probability, expectedCloseDate) | Contexto do deal |
| Lead model (status, score, assignedTo) | Contexto do lead |
| Dashboard widget system | Widget de ações pendentes |
| `apiClient` | Novos métodos para next-action |
| shadcn Card, Badge | Componente NextActionCard |

**Riscos:**
| Risco | Probabilidade | Mitigação |
|---|---|---|
| Regras simplistas demais (não capturam nuances) | Média | v1 cobre 80% dos casos; iterar com feedback de usuários |
| Score trend requer histórico que não existe | Alta | v1 sem score trend; adicionar ScoreHistory em sprint futuro |
| Performance: N+1 queries se calcular para lista inteira | Média | Endpoint individual por lead/deal; batch endpoint para dashboard (top 5) |
| Regras conflitantes | Baixa | Priorização determinística — primeira regra que matcha vence |

---

### Story 4 | AI Email Draft Generation (5 pts)

**Prioridade:** P2 | **Pontos:** 5 | **Sprint:** 2
**Dependências:** Story 3 (conceito de next-action informa template sugerido; pode ser implementada independente)

**Descrição:** Dado o contexto de um lead (nome, empresa, stage, interações), gerar draft de email usando LLM (OpenAI/Anthropic). Templates pré-definidos: "Primeiro contato", "Follow-up", "Proposta", "Agradecimento". Usuário edita antes de enviar. Fallback: se nenhuma API key configurada, exibir biblioteca de templates estáticos.

**AC:**

Backend — AI Configuration:
- [ ] Novo model ou campo em Tenant settings: `aiProvider` (openai|anthropic|none), `aiApiKey` (encrypted)
- [ ] `GET /api/settings/ai` retorna config de IA do tenant (sem expor API key completa — mascarada)
- [ ] `PUT /api/settings/ai` atualiza config: provider, API key, custom prompt
- [ ] API key armazenada encriptada no banco (usar padrão existente de encryption)
- [ ] Validação: ao salvar, faz test call para verificar se key é válida

Backend — Email Generation:
- [ ] `POST /api/ai/generate-email` aceita `{ leadId, template: string, customInstructions?: string }`
- [ ] Templates suportados: `initial_outreach`, `follow_up`, `proposal`, `thank_you`
- [ ] Service monta contexto: nome do lead, empresa, stage atual, últimas 3 interações, score
- [ ] Chama LLM com prompt estruturado + contexto + template type
- [ ] Retorna: `{ subject: string, body: string, tokensUsed: number }`
- [ ] Rate limit: máximo 20 gerações/hora por tenant
- [ ] Fallback: se `aiProvider=none` ou API key inválida, retorna template estático preenchido com dados do lead

Backend — Static Templates:
- [ ] 4 templates estáticos armazenados no código (não no banco)
- [ ] Cada template usa placeholders: `{{lead.name}}`, `{{lead.company}}`, `{{user.name}}`
- [ ] Retornados via `GET /api/ai/templates` — funciona sem LLM configurado

Frontend — Settings:
- [ ] Nova seção em Settings: "Inteligência Artificial"
- [ ] Campos: Provider (select: OpenAI, Anthropic, Nenhum), API Key (input password), Custom Prompt (textarea)
- [ ] Botão "Testar Conexão" que valida a key
- [ ] Indicador visual: "IA Configurada" (verde) ou "Sem IA — usando templates" (gray)

Frontend — Email Composer:
- [ ] Na página de detalhe do lead, botão "Gerar Email com IA"
- [ ] Modal: selecionar template type, campo opcional de instruções customizadas
- [ ] Botão "Gerar" chama API, exibe loading com estimativa
- [ ] Draft aparece em editor editável (textarea ou rich text simples)
- [ ] Botões: "Enviar" (usa flow de email existente), "Copiar", "Descartar"
- [ ] Se IA não configurada: modal mostra templates estáticos com dados preenchidos

Testes:
- [ ] Com API key configurada: gerar email para lead com contexto → retorna subject + body coerente
- [ ] Sem API key: gerar email → retorna template estático com placeholders preenchidos
- [ ] Rate limit: 21a requisição no mesmo período → retorna erro 429
- [ ] Settings: salvar API key → mascarada no GET subsequente
- [ ] Template "follow_up" menciona última interação do lead

**Dev Notes:**
- Criar `server/src/services/aiService.ts` — abstração sobre OpenAI/Anthropic SDKs
- Interface: `generateEmail(provider, apiKey, prompt, context): Promise<{ subject, body }>`
- Usar env vars como fallback: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` — tenant override tem prioridade
- Para encryption da API key: verificar se já existe utility de encryption no projeto. Se não, usar `crypto.createCipher` com chave em env var
- Prompt template (hardcoded): incluir papel ("Você é um vendedor profissional..."), contexto do lead, tipo de email, tom
- Rate limit: usar um counter simples com Redis (já usado pelo BullMQ) ou in-memory com TTL
- Frontend: criar `src/pages/Settings/AISettings.tsx` (ou seção em settings existente)
- Email composer: `src/components/ai/EmailDraftModal.tsx`
- Rota: `server/src/routes/ai.ts` — novo router
- Static templates: `server/src/services/emailTemplates.ts` — export const templates com placeholders

**Inventário de reusos (Story 4):**
| Ativo | Reuso |
|---|---|
| Email send flow | Integração com envio existente após edição do draft |
| Interaction model | Últimas interações como contexto para o LLM |
| Lead model completo | Contexto (name, company, stage, score) |
| Redis (BullMQ) | Rate limiting do endpoint de IA |
| Settings page pattern | Padrão visual para AI Settings |
| `apiClient` | Novo método para generate-email |
| Dialog/Modal components | EmailDraftModal |
| Rate limit middleware | Reusar pattern de `rateLimit.ts` |

**Riscos:**
| Risco | Probabilidade | Mitigação |
|---|---|---|
| API key exposure | Alta se mal implementado | Encryption no banco + mascaramento na API + nunca logar a key |
| Custo de API imprevisível | Média | Rate limit por tenant + exibir tokensUsed + limite configurable |
| Latência da LLM (2-5s) | Alta | Loading state claro + streaming se API suportar |
| Qualidade do draft em português | Média | Prompt explícito para PT-BR + user pode editar |
| Dependência de SDK externo (openai/anthropic) | Baixa | Abstração aiService.ts isola a dependência |
| Fallback inelegante | Baixa | Templates estáticos são genuinamente úteis mesmo sem IA |

---

## Plano de Sprints

| Sprint | Stories | Pontos | Notas |
|---|---|---|---|
| Sprint 1 | Story 1 (Forecast) + Story 2 (Funnel) | 10 | 100% determinístico, sem dependências externas |
| Sprint 2 | Story 3 (Next Action) + Story 4 (AI Email) | 13 | Story 3 é rule-based; Story 4 introduz LLM |

**Sequência recomendada dentro de cada sprint:**
- Sprint 1: Stories são independentes — podem ser desenvolvidas em paralelo
- Sprint 2: Story 3 primeiro (independente), Story 4 depois (pode usar next-action como contexto para sugerir template)

---

## Definição de Pronto (DoD)

- [ ] Todos os ACs com checkbox marcado
- [ ] Endpoints retornam dados corretos (testados manualmente ou automatizado)
- [ ] Frontend responsivo (desktop + mobile)
- [ ] Tenant isolation verificada (dados de um tenant não vazam para outro)
- [ ] Fallbacks funcionam (sem IA configurada, sem deals, sem interações)
- [ ] Zero erros no console do browser
- [ ] Build de frontend passa sem erros
- [ ] Build de backend passa sem erros TypeScript

---

## Arquitetura de Novos Arquivos

```
server/src/
├── routes/
│   ├── ai.ts                          # [NEW] Rotas de IA (generate-email, templates, settings)
│   └── deals.ts                       # [EXTEND] Adicionar /forecast e /trend
├── services/
│   ├── nextActionService.ts           # [NEW] Engine de próxima melhor ação
│   ├── aiService.ts                   # [NEW] Abstração OpenAI/Anthropic
│   ├── emailTemplates.ts             # [NEW] Templates estáticos de email
│   ├── forecastService.ts            # [NEW] Lógica de forecast e trend
│   └── dealService.ts                # [EXTEND] Reusar getStats()
└── routes/
    └── reports.ts                     # [EXTEND] Funnel conversion endpoint

src/
├── pages/
│   ├── Forecast.tsx                   # [NEW] Página de forecast
│   ├── FunnelAnalysis.tsx            # [NEW] Página de análise de funil
│   └── Dashboard.tsx                  # [EXTEND] Novos widgets
├── components/
│   ├── forecast/
│   │   └── ForecastWidget.tsx        # [NEW] Widget de forecast para dashboard
│   ├── funnel/
│   │   └── FunnelChart.tsx           # [NEW] Componente visual de funil
│   ├── ai/
│   │   ├── EmailDraftModal.tsx       # [NEW] Modal de geração de email
│   │   ├── NextActionCard.tsx        # [NEW] Card de próxima ação
│   │   └── AISettingsForm.tsx        # [NEW] Form de configuração de IA
│   └── deals/
│       └── DealAnalytics.tsx          # [EXTEND] Gráfico de forecast
├── hooks/
│   ├── useForecast.ts                # [NEW] Hook para dados de forecast
│   └── useFunnelAnalysis.ts          # [NEW] Hook para dados de funnel
└── services/api/
    └── client.ts                      # [EXTEND] Novos métodos
```

---

## Decisões Arquiteturais

| Decisão | Escolha | Justificativa |
|---|---|---|
| Forecast: server-side vs client-side | Server-side | Dados sensíveis (deal values) + aggregation no banco é mais eficiente |
| Funnel: snapshot vs cohort | Snapshot (v1) | Cohort requer tracking de transições que não existe; snapshot é pragmático |
| Next Action: LLM vs rule-based | Rule-based | Determinístico, grátis, instantâneo. LLM é overkill para regras simples |
| AI Email: multi-provider | OpenAI + Anthropic | Dois providers mais populares; abstração permite adicionar mais |
| AI config: tenant-level vs global | Tenant-level com fallback global | Cada tenant pode ter sua key; env vars como fallback |
| Score trend: histórico vs heurística | Heurística (v1) | Evita schema change; evolução futura adiciona ScoreHistory |
| Chart library | Recharts (verificar) ou CSS puro | FunnelChart pode ser CSS puro; forecast precisa de chart lib |
