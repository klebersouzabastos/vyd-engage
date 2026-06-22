# PRD — Épico: VYD Engage para Equipes Comerciais

## Contexto

O VYD Engage possui base sólida de CRM: leads, pipeline kanban, deals, forecast ponderado, automações, inbox unificado e audit trail. Para atender uma **área comercial profissional** (vendedores, gestores, BDRs), faltam instrumentos críticos: visibilidade de performance individual, análise de win/loss, alertas de negócios em risco, produtos/itens em propostas e metas por vendedor. Este épico cobre esses gaps de forma faseada, sem reescritas arquiteturais.

---

## Personas

| Persona | Perfil | Dor Principal |
|---------|--------|---------------|
| **Gerente Comercial** | Supervisiona time de 3-10 vendedores, reporta para diretoria | "Não consigo ver quem está performando e quais negócios estão em risco" |
| **Vendedor/SDR** | Gerencia 30-80 leads ativos, usa CRM diariamente | "Perco deals sem perceber que estavam parados há dias" |
| **Diretor/CEO** | Quer previsibilidade de receita e análise de ciclo | "Não sei por que estamos perdendo e qual é o ticket médio real por produto" |

---

## Análise de Gaps (base para os requisitos)

**Backend existente** (não precisa recriar): AuditLog, Forecast ponderado, Scoring, Socket.IO, BullMQ, Automations, Interactions, FunnelColumn, `emitToTenant`, `createAuditLog`.

**Gaps críticos identificados:**
- Nenhum modelo `Product` / line items em deals → deals sem discriminação de valor por produto
- Nenhuma entidade `Goal`/`Quota` → sem metas por vendedor/mês
- Win/Loss não tem campos estruturados (só `deal.lostReason` texto livre)
- Sem alertas automáticos de inatividade em deals (stale deal detection)
- Sem dashboard de performance por usuário (win rate, ciclo médio, pipeline individual)
- Forecast sem cenários (só ponderado; sem melhor/pior caso)
- `DealDetail` não exibe tempo decorrido em cada stage
- Tasks não geram automaticamente ao avançar de stage
- Scheduling de relatórios existe no modelo mas provavelmente não envia email ainda

---

## Épico: Comercial Pro

### Fase 1 — Visibilidade e Risco (P0 — 3-4 semanas)

**Story 1.1 — Dashboard de Performance da Equipe**

Como gerente, quero ver um ranking consolidado do time para identificar quem precisa de suporte.

*Requisitos funcionais:*
- Nova página `/app/performance` visível apenas para `admin` e `gestor` (usar `requiredRoles` no `ProtectedRoute`)
- Métricas por usuário no período selecionado (7/30/90 dias): deals ganhos (qtd e R$), deals perdidos, win rate (%), ciclo médio (dias), pipeline ativo (R$), tarefas concluídas
- Ranking visual (lista ordenável por qualquer coluna)
- Widget opcional no Dashboard existente

*Backend:* Nova rota `GET /api/v1/reports/team-performance?from=&to=&funnelId=` — agrega via `groupBy` em `Deal` e `Task` por `assignedTo`.

*Frontend:* `src/pages/TeamPerformance.tsx` + rota em `src/utils/routes.tsx`.

---

**Story 1.2 — Alertas de Deals em Risco**

Como vendedor e gerente, quero ser alertado quando um deal fica sem atividade por mais de N dias.

*Requisitos funcionais:*
- Configuração por tenant: limiar de inatividade em dias (padrão 5 dias) — em Settings > Pipeline
- Job diário às 08h verifica deals `stage != WON && stage != LOST` sem `Interaction` recente
- Notificação in-app (modelo `Notification` existente) para o `assignedTo`
- Badge "Em risco" em `DealCard.tsx` e `DealPipelineBoard.tsx`
- Widget "Deals em risco" no Dashboard

*Backend:* `server/src/jobs/staleDeals.ts` (BullMQ ou adaptação de `taskNotificationChecker.ts`). Campo `staleDays Int @default(5)` em `Tenant` (migração Prisma).

*Frontend:* Badge condicional em `src/components/deals/DealCard.tsx`. Widget em Dashboard.

---

**Story 1.3 — Análise Win/Loss Estruturada**

Como gerente, quero entender por que perdemos deals para ajustar abordagem comercial.

*Requisitos funcionais:*
- Ao mover deal para `LOST`: modal obrigatório com motivo (dropdown configurável: Preço, Concorrente, Timing, Sem orçamento, Não qualificado, Outro) + campo `lostCompetitor` (texto livre)
- Relatório `/app/reports/win-loss`: gráfico pizza motivos, barras Win vs Lost por mês, tabela de concorrentes
- `PATCH /deals/:id` com `stage=LOST` valida presença de `lostReason`

*Backend:* Migração: `lostCompetitor String?` em `Deal`. Rota `GET /api/v1/reports/win-loss`.

*Frontend:* Modal em `src/pages/DealDetail.tsx`. Nova página `src/pages/WinLossReport.tsx`.

---

**Story 1.4 — Produtos e Itens de Proposta**

Como vendedor, quero associar produtos/serviços a um deal para calcular valor real da proposta.

*Requisitos funcionais:*
- CRUD de produtos (nome, preço unitário, categoria) em `/app/settings/products`
- Seção "Itens da Proposta" em DealDetail: adicionar produto, quantidade, desconto %, total por item e total geral
- `deal.value` atualiza automaticamente com soma dos itens (override manual possível)
- Itens exportados no PDF de proposta

*Backend:* Novos modelos Prisma:
```
Product { id, tenantId, name, description, unitPrice, category, active }
DealProduct { id, dealId, productId, quantity, unitPrice, discount }
```
Rotas `CRUD /api/v1/products` + `CRUD /api/v1/deals/:id/products`.

*Frontend:* `src/pages/Products.tsx`. Componente `src/components/deals/DealProducts.tsx` embutido em `DealDetail.tsx`.

---

### Fase 2 — Metas e Rastreamento (P1 — 2-3 semanas)

**Story 2.1 — Metas e Quotas por Vendedor**

*Requisitos:* CRUD de metas (usuário, mês/ano, meta R$, meta qtd deals, meta novos leads). Barra de progresso em tempo real no Dashboard individual e TeamPerformance. Alertas in-app ao atingir 50%, 80%, 100%.

*Backend:* Modelo `Goal { id, tenantId, userId, month, year, targetRevenue, targetDeals, targetLeads }`. Rotas `CRUD /api/v1/goals`.

*Frontend:* `src/components/GoalProgress.tsx`.

---

**Story 2.2 — Tracking de Tempo em Stage**

*Requisitos:* Tabela `DealStageHistory { id, dealId, stage, enteredAt, exitedAt }` registrada a cada mudança de stage. DealDetail exibe duração por stage. Stale deal detection (1.2) usa esta tabela.

*Backend:* Migração + hook em `server/src/services/dealService.ts` ao mudar stage.

*Frontend:* Seção em `DealDetail.tsx` após timeline de interações.

---

**Story 2.3 — Tasks Automáticas por Stage**

*Requisitos:* Configuração por funil/stage: "ao entrar em Proposta, criar tarefa X com prazo de Y dias". Modelo `StageTaskTemplate`. Hook em `dealService.ts` cria Task ao mudar stage.

*Backend:* Migração. Rotas `CRUD /api/v1/stage-task-templates`. Lógica em `dealService.ts`.

*Frontend:* Configuração em Settings > Pipeline (nenhuma mudança em deal UI — automático).

---

### Fase 3 — Analytics e Previsibilidade (P2 — 2-3 semanas)

**Story 3.1 — Forecast por Cenários**

*Requisitos:* 3 cenários no Forecast: Conservador (prob ≥ 70%), Esperado (ponderado atual), Otimista (sem desconto). Gráfico de barras agrupadas por mês.

*Backend:* Lógica adicional em `GET /api/v1/forecast`.

*Frontend:* Atualização em `src/pages/Forecast.tsx`.

---

**Story 3.2 — Pipeline Health Score**

*Requisitos:* Score 0-100 baseado em % deals com atividade recente, distribuição entre stages, win rate vs meta, ciclo médio vs benchmark. Card gauge (verde/amarelo/vermelho) no Dashboard.

*Backend:* `server/src/services/pipelineHealthService.ts`.

*Frontend:* `src/components/PipelineHealthGauge.tsx`.

---

**Story 3.3 — Relatórios Agendados por Email**

*Requisitos:* Verificar se scheduling em `Report` já envia email (provavelmente não). Completar lógica com BullMQ + Resend. Templates pré-built: "Resumo semanal de vendas", "Pipeline atual", "Deals em risco".

*Backend:* `server/src/jobs/reportScheduler.ts`. Usar `Report.schedule` já existente.

*Frontend:* Verificar `src/pages/Reports.tsx` — ajustar UI se necessário.

---

## Requisitos Não-Funcionais

- **Multi-tenancy:** todos os novos modelos devem ter `tenantId` filtrado em todas as queries Prisma
- **CSRF:** novas rotas autenticadas registradas na whitelist em `server/src/index.ts:163-190`
- **Role-based:** features de gestão exigem `admin` ou `gestor` via `ProtectedRoute`
- **Performance:** queries de agregação usam `groupBy` Prisma com índices em `(tenantId, createdAt)` e `(tenantId, assignedTo)`
- **Socket:** eventos de Task automática emitem `task:created` via `emitToTenant`

---

## Métricas de Sucesso

| Métrica | Baseline | Meta (90 dias pós-deploy) |
|---------|----------|--------------------------|
| Deals perdidos sem motivo registrado | ~100% | < 10% |
| Deals sem atividade 7+ dias detectados | 0 (manual) | 100% alertados automaticamente |
| Uso semanal do Dashboard de Performance | N/A | > 3 sessões/gestor |
| Forecast accuracy (previsto vs fechado) | N/A | delta < 15% em 60 dias |

---

## Faseamento Resumido

| Fase | Stories | Duração | Paralelizável |
|------|---------|---------|---------------|
| **P0** | 1.1, 1.2, 1.3, 1.4 | 3-4 semanas | 1.2 e 1.4 paralelizáveis no sprint 1 |
| **P1** | 2.1, 2.2, 2.3 | 2-3 semanas | Após P0 |
| **P2** | 3.1, 3.2, 3.3 | 2-3 semanas | Após P1 |

---

## Verificação E2E (por fase)

**P0:**
1. `cd server && npx vitest run && npm run build` — sem erros
2. `npm run build` — frontend compila
3. Criar deal → mover para LOST → modal aparece com dropdown de motivo → relatório Win/Loss exibe corretamente
4. Criar deal sem interação (mock `updatedAt` com data antiga) → job roda → notificação gerada → badge aparece
5. Adicionar produtos ao deal → valor total atualiza → PDF exportado contém itens
6. Acessar `/app/performance` como `gestor` → ranking visível; como `membro` → redirecionado
