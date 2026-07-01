# Spec: Papéis Comerciais — Estrategista (GESTOR) e Analista (USER)

## Objetivo

Introduzir no VYD Engage dois papéis comerciais claros — **Estrategista comercial**
(diretor/gerente) e **Analista comercial** — modelados como **níveis de permissão**,
não como cargos. Hoje o tenant só tem `ADMIN | USER | VIEWER` e **todos veem todos os
negócios**; isso mistura "estrategista comercial" com "admin do sistema" e não dá foco
operacional ao analista. Esta spec adiciona um nível **GESTOR** entre ADMIN e USER, e
faz o **USER (analista) enxergar apenas os próprios negócios**, com o painel estratégico
reservado a GESTOR/ADMIN. O "cargo/título" da pessoa permanece desacoplado do acesso
(pode-se promover/rebaixar sem "trocar de cargo"), evitando engessar o uso.

## Usuários

- **Estrategista comercial (GESTOR)** — diretor/gerente comercial. Acompanha o pipeline
  do time inteiro, mede resultado (Performance, Win/Loss, Metas, Forecast, Desdobramento)
  e **configura o processo de venda**. Nível técnico médio.
- **Analista comercial (USER)** — vendedor/operador. Trabalha o dia a dia dos **próprios**
  negócios. Não configura o processo nem vê painéis de time.
- **Administrador (ADMIN)** — superset do GESTOR + administração do tenant
  (billing, integrações, usuários, API keys, webhooks). Já existe.
- **Observador (VIEWER)** — somente leitura. Já existe; sem novidades comerciais.
- **Platform admin (`isPlatformAdmin`)** — super-admin cross-tenant; inalterado (superset).

## Requisitos

### Obrigatórios

#### A. Modelo de papéis

1. O sistema deve adicionar o valor **`GESTOR`** ao enum `UserRole` (hoje
   `ADMIN | USER | VIEWER`, em `server/prisma/schema.prisma`), via migration **aditiva**.
   A hierarquia de permissão passa a ser **`ADMIN > GESTOR > USER > VIEWER`**.
2. O sistema deve permitir atribuir o papel `GESTOR` a um usuário: (a) no convite
   (`Invitation.role` já é `UserRole`) e (b) na tela de gestão de usuários/equipe
   (`TeamManagement`), onde `GESTOR` passa a ser uma opção selecionável de papel.
3. O papel **não** deve depender de nenhum campo de "cargo/título". Não deve ser criado
   campo de cargo; o `role` é a única fonte de permissão. Um `GESTOR` pode ser chamado de
   "Diretor", "Gerente" etc. livremente, sem impacto no sistema.

#### B. Escopo de dados do Analista (USER) — forçado no backend

4. Quando o usuário autenticado tiver papel `USER`, o backend deve **forçar** o filtro
   "apenas os próprios registros" (`assignedTo = req.user.userId`) — independentemente do
   que o cliente enviar — nas listagens e agregações de:
   - Negociações: `dealService.findAll` (rota `GET /deals`) e o board de pipeline
     `funnelService.findById` (as `deals` de cada coluna do funil).
   - Tarefas: listagem de `Task` (por `assignedTo`).
   - Interações e timeline: apenas interações de negociações/leads do próprio usuário.
   - Estatísticas/agregações de negócio: `dealService` stats/trend, `forecastService`
     e relatórios — todos no escopo do próprio usuário para `USER`.
5. Quando o usuário for `GESTOR`, `ADMIN` ou `isPlatformAdmin`, as mesmas listagens/
   agregações devem abranger **todo o tenant** (comportamento atual preservado). Não há
   recorte por equipe (Times são P1 — fora do escopo).
6. O acesso a um **registro individual** deve respeitar o escopo: um `USER` que tentar
   abrir/editar/mover/excluir uma negociação (ou tarefa) que **não é sua** deve receber
   **404** (`DEAL_NOT_FOUND`/equivalente) — o backend não deve vazar existência nem
   permitir a ação. Vale para `GET/PUT/DELETE /deals/:id`, `/deals/:id/*` (win/lose/pause/
   resume/contacts/products/stage-history) e `POST /funnels/move-deal`.
7. **Negociações sem responsável** (`assignedTo = null`) **não** devem aparecer para o
   `USER`. Apenas `GESTOR`/`ADMIN` as veem e podem atribuí-las.
8. Um `USER` deve poder **criar** negociações/tarefas (atribuídas a si mesmo) e operar as
   próprias (mover no kanban respeitando campos obrigatórios da etapa, qualificar,
   registrar interações, marcar ganho/perda, pausar/retomar). Um `USER` **não** deve poder
   **reatribuir** uma negociação para outro usuário (reatribuição é ação de GESTOR/ADMIN).

#### C. Configuração do processo (GESTOR + ADMIN)

9. As rotas de **configuração do processo comercial** devem exigir papel **`GESTOR` ou
   `ADMIN`**: funis (`/funnels`), colunas/etapas, campos personalizados (`/custom-fields`),
   motivos de perda (`/lost-reasons`), fontes (`/deal-sources`), campanhas de origem
   (`/origin-campaigns`), templates de tarefa por etapa (`/stage-task-templates`),
   regras de score (`/scoring-rules`) e catálogo de produtos (`/products`).
10. Um `USER` que chamar essas rotas de configuração (métodos de escrita) deve receber
    **403** (`FORBIDDEN`/`INSUFFICIENT_ROLE`). Leitura de metadados necessária à operação
    (ex.: listar funis/etapas/campos para preencher a negociação) permanece permitida ao
    `USER`.

#### D. Painéis e navegação (UI)

11. Os **painéis de nível-time** devem ser visíveis apenas para `GESTOR`/`ADMIN` e ocultos
    para `USER`/`VIEWER`: Performance do time (`/app/performance` / `TeamPerformance`),
    Win/Loss, Metas do time, Desdobramento comercial e a tela de **Config. de Negócios**
    (`/app/settings/deal-config`). No `Sidebar` e nas rotas (`ProtectedRoute`
    `requiredRoles`), esses itens exigem no mínimo `GESTOR`.
12. As visões **individuais** — Deals, Pipeline, Tarefas, Inbox, Forecast e Relatórios —
    permanecem visíveis ao `USER`, porém **com escopo próprio** (refletindo o req. 4). Ou
    seja: o `USER` vê essas páginas, mas só com os próprios dados; não são ocultadas.
13. Itens **exclusivos de ADMIN** permanecem exclusivos de ADMIN (billing, integrações,
    gestão de usuários, API keys, webhooks, importação, plataforma). O `GESTOR` **não** os
    acessa.
14. A UI deve degradar graciosamente por papel: um `USER` que navegar diretamente para uma
    rota de GESTOR/ADMIN (via URL) deve ser bloqueado pelo `ProtectedRoute` (redirect ou
    tela "sem permissão"), e a chamada de API correspondente deve retornar 403 (defesa em
    profundidade — a UI não é a única barreira).

#### E. Migração

15. A migração deve ser **aditiva** (apenas `ALTER TYPE "UserRole" ADD VALUE 'GESTOR'`).
    Nenhum usuário existente é rebaixado ou alterado automaticamente (hoje só há 1 usuário,
    `ADMIN`). A atribuição de quem é `GESTOR`/`USER` é feita manualmente depois.

### Fora do Escopo

- **Modelo de Times/Equipes** (`Team`/`TeamMember`) e recorte de dados/visibilidade de
  funil por equipe — é P1. Enquanto não existir, `GESTOR` vê **todo o tenant**.
- **Perfis por capacidades granulares** (Opção C — flags ligáveis por usuário). Ficamos
  com os 4 níveis de papel.
- **Campo de cargo/título** no usuário (rótulo cosmético). Não será criado nesta entrega.
- Reescrever regras de billing/integrações — o recorte ADMIN atual é preservado.
- Alterar o comportamento do `VIEWER` além de garantir que continua somente-leitura.

## Restrições

- **Stack**: Node.js + Express + Prisma + PostgreSQL; multi-tenancy obrigatória (todo
  filtro mantém `tenantId`); resposta `{ status, data }`; CSRF whitelist para novas rotas
  autenticadas de escrita (as rotas de config já existem na whitelist).
- **Segurança / defesa em profundidade**: o escopo do analista e as exigências de papel
  devem ser **impostos no backend** (serviços/rotas), nunca apenas escondidos na UI. A UI
  (Sidebar/ProtectedRoute) é conveniência, não fronteira de segurança.
- **Banco de produção**: migration aditiva e revisada; sem `db push`. O app está em uso.
- **Não regredir**: ADMIN e `isPlatformAdmin` mantêm acesso total; o que já funciona para
  ADMIN continua igual. GESTOR/ADMIN preservam a visão tenant-wide atual.
- **Padrão de checagem de papel**: usar um mecanismo único e reutilizável (ex.: middleware
  `requireRole(...min)` no backend e `requiredRoles` no `ProtectedRoute` do front),
  evitando checagens ad-hoc espalhadas.

## Casos Extremos

- **USER abre negócio de outro por URL direta** (`/app/deals/:id`): backend retorna 404;
  a UI mostra "não encontrado", sem vazar dados.
- **Negócio reatribuído para longe do USER**: some das listas/pipeline dele imediatamente
  na próxima carga; se estava aberto, a próxima ação nele retorna 404.
- **Negócio sem responsável**: invisível ao USER; visível a GESTOR/ADMIN, que podem atribuir.
- **USER tenta reatribuir/atribuir a outro** no formulário: bloqueado (backend ignora/500?
  → deve retornar 403 com mensagem clara; o campo "Responsável" fica travado no próprio
  usuário para USER).
- **USER chama rota de configuração** (criar/editar funil, campo, motivo, etc.): 403.
- **GESTOR sem "time"**: como Times são P1, GESTOR vê todo o tenant (não fica sem dados).
- **VIEWER**: nenhuma ação de escrita; todas as telas em modo leitura; painéis de time
  ocultos (VIEWER < USER).
- **Usuários existentes após o deploy**: um usuário que era `USER` e via tudo passa a ver
  só o próprio — mudança de comportamento intencional; comunicar. (No tenant atual não há
  USER ainda, então sem impacto imediato.)
- **Agregações/relatórios do USER**: números refletem só os negócios dele (ex.: Forecast do
  USER = pipeline próprio), sem vazar totais do time.
- **Platform admin**: continua enxergando tudo, independente do papel no tenant.

## Definição de Concluído

- [ ] `UserRole` inclui `GESTOR`; migration aditiva aplicável em produção sem perda de dados.
- [ ] É possível convidar e definir um usuário como `GESTOR` (convite + tela de usuários).
- [ ] Logado como `USER`: `GET /deals`, o board de pipeline, `GET /tasks`, timeline,
      forecast e relatórios retornam **apenas** registros com `assignedTo = eu`; negócios
      de outros e sem responsável não aparecem.
- [ ] Logado como `USER`: `GET/PUT/DELETE /deals/:id` (e ações `/win`,`/lose`,`/pause`,
      `/resume`,`/contacts`,`/products`) e `POST /funnels/move-deal` sobre um negócio de
      outro retornam **404**; sobre o próprio, funcionam.
- [ ] Logado como `USER`: chamadas de escrita a `/funnels`, `/custom-fields`,
      `/lost-reasons`, `/deal-sources`, `/origin-campaigns`, `/stage-task-templates`,
      `/scoring-rules`, `/products` retornam **403**.
- [ ] Logado como `GESTOR`: vê pipeline/negócios do tenant inteiro; acessa Performance do
      time, Win/Loss, Metas, Forecast e Desdobramento; configura funis/etapas/campos/
      motivos/fontes/campanhas; **não** acessa billing/integrações/usuários/plataforma.
- [ ] `Sidebar` e `ProtectedRoute`: itens/rotas de time exigem ≥ `GESTOR`; itens ADMIN
      seguem só-ADMIN; `USER` vê Deals/Pipeline/Tarefas/Forecast/Relatórios (escopo próprio);
      navegação direta a rota sem permissão é bloqueada no front **e** retorna 403/404 na API.
- [ ] `ADMIN` e `isPlatformAdmin` mantêm acesso total (sem regressão).
- [ ] Backend `tsc` e frontend `vite build` verdes; todas as queries novas mantêm `tenantId`;
      o escopo do analista é imposto no backend (verificável desligando a UI).
