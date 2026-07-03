# Spec: Follow-up de Clientes & Contrato Guarda-Chuva

## Objetivo

Dar à área comercial dois instrumentos que hoje não existem no VYD Engage:
(1) **follow-up sistemático de clientes ativos** — nenhum cliente fica sem contato
por mais tempo que o combinado, via alerta de inatividade + cadência recorrente por
cliente; (2) **mapeamento do contrato guarda-chuva de cada empresa** — no mercado de
engenharia o contratante mantém um contrato-quadro (cardápio de preços) com um
fornecedor e abre OSs ao longo da vigência; registrar **quem detém o contrato**
(nós ou um concorrente) e **quando vence** permite alertar a equipe nos limiares de
antecedência (90/60/30 dias) e disparar, com um clique, uma **cadência de
aquecimento** (desdobramento a partir de um playbook) para chegar à mesa antes da
renovação — tanto para defender contrato nosso quanto para atacar contrato do
concorrente.

## Usuários

Time comercial do VYD Engage (multi-tenant; tenant real em produção): gestores/admins
que configuram limiares e mapeiam contratos, e vendedores (donos de conta) que
recebem os alertas e executam follow-ups e aquecimentos. Nível técnico variado; a
feature reusa superfícies conhecidas (Empresas, Dashboard, Tarefas, Desdobramentos).
O público desta spec para **construir e verificar** é um desenvolvedor full-stack
(ou uma sessão futura de Claude).

## Contexto do código (estado atual)

- `Company` (`server/prisma/schema.prisma:425-473`): **não** tem status
  cliente/prospect, dono da conta, nem qualquer campo de contrato/vencimento/
  fornecedor. Relações 1:N já existentes: `leads`, `deals`, `interactions`, `tasks`,
  `empreendimentos`, `commercialRoadmaps`, `deepResearches`.
- Concorrente só existe como `Deal.lostCompetitor` (texto livre ao perder deal).
  Não há entidade de concorrente nem de contrato.
- Motor de cadência **pronto**: Playbook → desdobramento (`CommercialRoadmap`) →
  Tasks com `offsetDays`/SLA e mapeamento função→pessoa
  (`roadmapService.generateActionsFromPlaybook`; UI `RoadmapCreateDialog` com
  seleção de playbook — entregue na spec `playbook-aprimoramento`).
- Infra de alerta por data **pronta e reutilizável**: jobs sempre-ativos por
  `setInterval` sem Redis — `taskNotificationChecker.ts` (30 min) e `staleDeals.ts`
  (24 h, lê `Tenant.staleDays`, dedup por `Notification.metadata`, cria
  `Notification` + `emitToTenant`). Enum `NotificationType` em uso:
  TASK_DUE/TASK_OVERDUE/DEAL_AT_RISK/etc.
- UI: `CompanyDetail.tsx` com abas (Leads/Deals/Empreendimentos/Timeline/
  Informações) e botão "Editar"; `Companies.tsx` lista com filtros; Dashboard com
  widgets (ex.: "Deals em Risco" `Dashboard.tsx:339-380`); comandos por tela ficam
  no corpo da página (shell ribbon é só navegação).

## Requisitos

### Obrigatórios

#### A. Modelo de dados (migração Prisma aditiva)

1. O sistema deve adicionar ao modelo `Company` (todas as colunas opcionais/ com
   default — migração aditiva):
   - `clientStatus ClientStatus @default(PROSPECT)` — enum novo
     `ClientStatus { PROSPECT, CLIENTE_ATIVO, INATIVO }`;
   - `assignedTo String?` (FK → `User`, SetNull) — **dono da conta**, com relação
     nomeada e índice `[tenantId, assignedTo]`;
   - `followUpIntervalDays Int?` — cadência de follow-up própria da empresa
     (null = usa o padrão do tenant);
   - `contractHolder ContractHolder @default(NENHUM)` — enum novo
     `ContractHolder { NOS, CONCORRENTE, NENHUM }`;
   - `contractCompetitor String?` — nome do concorrente detentor (texto livre);
   - `contractStartDate DateTime?` e `contractEndDate DateTime?` (vencimento);
   - `contractValue Decimal?` e `contractScope String?` (escopo/cardápio resumido,
     texto livre);
   - índice para o job de vencimento: `[tenantId, contractEndDate]`.
2. O sistema deve adicionar ao modelo `Tenant`: `clientFollowUpDays Int @default(30)`
   (limiar de inatividade padrão do follow-up) e `contractAlertDays Json
   @default("[90,60,30]")` (limiares de antecedência do alerta de contrato, em dias,
   lista decrescente).
3. O enum `NotificationType` deve ganhar `CONTRACT_EXPIRING` e `CLIENT_FOLLOWUP`.
4. As rotas/serviços de empresa (`companies.ts`/`companyService`) devem aceitar e
   persistir os novos campos (validação Zod: `contractCompetitor` exigido quando
   `contractHolder = CONCORRENTE`; datas coercidas; `contractEndDate >=
   contractStartDate` quando ambas presentes). A rota de settings do tenant deve
   permitir a ADMIN/GESTOR editar `clientFollowUpDays` e `contractAlertDays`.

#### B. Status de cliente (manual + sugestão automática)

5. O usuário deve poder definir manualmente o `clientStatus` da empresa
   (Prospect / Cliente ativo / Inativo) no formulário de criar/editar empresa, e o
   status deve aparecer como badge na lista de Empresas e no `CompanyDetail`.
6. Quando um deal vinculado a uma empresa transiciona para **GANHO** (WON), o
   sistema deve promover automaticamente o `clientStatus` dessa empresa para
   `CLIENTE_ATIVO`, exceto se já for `CLIENTE_ATIVO`. A edição manual continua
   sempre possível (inclusive voltar para Prospect/Inativo depois).

#### C. Módulo 1 — Follow-up de clientes ativos (inatividade + cadência)

7. Um job diário **sempre-ativo** (padrão `staleDeals.ts`: `setInterval` 24 h, sem
   Redis) deve varrer, por tenant, as empresas com `clientStatus = CLIENTE_ATIVO` e
   calcular o intervalo efetivo de follow-up de cada uma:
   `followUpIntervalDays` da empresa, se definido; senão `Tenant.clientFollowUpDays`.
8. Para cada cliente ativo cuja **última `Interaction`** (qualquer tipo, da empresa
   ou de seus leads/deals vinculados) seja mais antiga que o intervalo efetivo — ou
   que nunca teve interação —, o sistema deve, **se não existir já uma tarefa de
   follow-up em aberto para a empresa**:
   - criar uma `Task` de follow-up (título "Follow-up — {empresa}", `companyId`
     preenchido, `dueDate` = hoje, atribuída ao `assignedTo` da empresa; sem dono →
     sem atribuição);
   - criar uma `Notification` `CLIENT_FOLLOWUP` para o dono da conta (sem dono →
     para admins/gestores do tenant), com link para a empresa e dedup diária via
     `metadata.companyId` (mesmo padrão do `taskNotificationChecker`).
9. Registrar um novo contato (qualquer `Interaction` da empresa) **reinicia o
   relógio** por construção (o job olha a última interação) — gerando o
   comportamento de cadência recorrente: a cada intervalo sem contato, nova tarefa.
10. A lista de Empresas deve permitir filtrar por `clientStatus` e por "follow-up
    pendente" (clientes ativos com tarefa de follow-up em aberto), para servir de
    visão "Clientes para follow-up".

#### D. Módulo 2 — Contrato guarda-chuva + alertas de vencimento

11. O `CompanyDetail` deve exibir um cartão/seção **"Contrato guarda-chuva"** com:
    detentor (Nós / Concorrente {nome} / Nenhum), vigência (início–vencimento),
    valor, escopo e a contagem regressiva ("Vence em N dias" / badge **"Vencido"**
    com token de perigo quando `contractEndDate` < hoje). A seção deve ter ação de
    editar (dialog) que grava via a rota de empresa (req 4).
12. O mesmo job diário do req 7 deve varrer empresas com `contractEndDate` definida
    e `contractHolder != NENHUM` e, para cada limiar configurado em
    `Tenant.contractAlertDays` (padrão 90/60/30):
    - quando `diasAteVencer <= limiar` e **ainda não houve** notificação daquele
      limiar para aquela empresa (dedup via `metadata: { companyId, threshold }`),
      criar `Notification` `CONTRACT_EXPIRING` para o dono da conta **e** para
      admins/gestores, com título indicando detentor e prazo (ex.: "Contrato
      {empresa} ({concorrente}) vence em {N} dias") e link para a empresa;
    - notificar **apenas o menor limiar aplicável** no primeiro disparo (ex.:
      contrato cadastrado faltando 20 dias → só o alerta de 30, não 90+60+30);
    - contrato já **vencido** ao ser varrido → uma única notificação de vencido
      (dedup própria), sem repetição diária;
    - emitir também o evento Socket correspondente via `emitToTenant`.
13. **Aquecimento em 1 clique:** a seção "Contrato guarda-chuva" (req 11) deve
    oferecer o botão **"Iniciar aquecimento"**, que abre o fluxo existente de novo
    desdobramento (`RoadmapCreateDialog`) **pré-preenchido** com a empresa e título
    sugerido ("Aquecimento — {empresa}"), deixando o usuário escolher o playbook e
    o mapeamento função→pessoa já existentes. O desdobramento criado é um
    `CommercialRoadmap` normal vinculado à empresa (nenhum campo novo no roadmap).
14. O Dashboard deve ganhar o widget **"Contratos a vencer"**: lista das próximas
    empresas com contrato vencendo (ordenada por `contractEndDate` asc, janela =
    maior limiar configurado), mostrando empresa, detentor (badge Nós/Concorrente),
    data e dias restantes; cada linha navega para a empresa. Vazio → estado vazio
    discreto.
15. A lista de Empresas deve permitir filtrar por situação de contrato (ex.:
    "vence em até N dias", "vencido", "com concorrente", "conosco", "sem
    contrato"), suficiente para uma visão "Contratos a vencer" filtrável; o widget
    (req 14) pode linkar para essa visão.

#### E. Configuração e permissões

16. Em Settings (área do tenant), ADMIN/GESTOR devem poder editar:
    `clientFollowUpDays` (número > 0) e os limiares `contractAlertDays` (lista de
    inteiros > 0, sem duplicatas; persistida em ordem decrescente). Valores
    inválidos são rejeitados com mensagem clara.
17. Os novos campos de empresa (status, dono, cadência, contrato) são editáveis por
    qualquer papel que já pode editar empresa hoje; a configuração do req 16 é
    restrita a ADMIN/GESTOR. Nenhuma mudança no escopo de leitura existente
    (analista continua vendo o que vê hoje).

### Fora do Escopo

- **Não** cadastrar o cardápio de preços detalhado nem rastrear consumo/abertura de
  OSs ao longo do contrato (fica para uma fase futura de gestão de contrato).
- **Não** criar entidade dedicada de Concorrente (segue texto livre) nem múltiplos
  contratos/histórico de contratos por empresa (um contrato corrente por empresa;
  renovação = atualizar as datas).
- **Não** criar modelo novo de contrato (decisão: campos tipados na `Company`).
- **Não** aplicar escopo de posse por `Company.assignedTo` nas listagens (o dono da
  conta serve para rotear alertas/tarefas, não para restringir acesso).
- **Não** disparar aquecimento automaticamente sem clique do usuário.
- **Não** enviar e-mail/WhatsApp de alerta (só notificação in-app + Socket).
- **Não** usar editor rico nos campos de contrato (`contractScope` é textarea
  simples).

## Restrições

- **Multi-tenant:** toda query nova filtra por `tenantId`; o job itera por tenant.
- **Produção:** app em produção (tenant k2). Migração Prisma **aditiva** (enums +
  colunas opcionais/default), aplicada antes do deploy; entrega em **branch
  dedicada** e deploy como release único.
- **Job sem Redis:** o job novo segue o padrão sempre-ativo de
  `staleDeals.ts`/`taskNotificationChecker.ts` (`setInterval`, initial delay), sem
  depender de `ENABLE_AUTOMATION_ENGINE`/BullMQ. Deduplicação por
  `Notification.metadata` para sobreviver a reinícios.
- **Cálculo por data (não hora):** dias até vencer/inatividade calculados por data
  civil, para não oscilar com fuso/horário do servidor.
- **Rotas:** preferir estender rotas existentes (`companies`, settings do tenant).
  Se um grupo de rotas novo for montado, registrar CSRF na whitelist de
  `server/src/index.ts`.
- **Design system:** UI nova só com tokens semânticos (no app: `text-foreground`
  p/ leitura, `text-muted-foreground` p/ meta, `bg-action-danger`/`danger` p/
  "Vencido"); arquivos novos entram no `STRICT_SCOPE` do `check:colors`.
- **Verificação sem produção:** validar em dev/preview; não criar
  notificações/tarefas de teste no banco de produção.

## Casos Extremos

- **Contrato sem `contractEndDate`** (ou `contractHolder = NENHUM`): nunca gera
  alerta, mesmo com outros campos preenchidos.
- **Contrato cadastrado já dentro de um limiar** (ex.: faltam 20 dias): dispara só
  o menor limiar aplicável (30), uma vez.
- **Contrato vencido no cadastro:** uma única notificação de vencido; badge
  "Vencido" na UI; sem loop diário.
- **Empresa sem dono (`assignedTo` null):** alertas vão para admins/gestores; a
  tarefa de follow-up é criada sem atribuição.
- **Cliente ativo sem nenhuma interação registrada:** conta como inativo desde
  sempre → gera follow-up já na primeira varredura.
- **Tarefa de follow-up já aberta:** o job não cria outra (dedup por tarefa aberta
  de follow-up da empresa), evitando pilha de tarefas.
- **Empresa marcada INATIVO/PROSPECT:** sai da varredura de follow-up
  imediatamente; tarefas já criadas permanecem.
- **Alteração de limiares pelo tenant:** vale a partir da próxima varredura; dedup
  por `{companyId, threshold}` evita renotificar limiares já disparados.
- **Deal ganho de empresa já CLIENTE_ATIVO:** promoção é no-op (não sobrescreve
  nem notifica de novo).
- **`contractHolder = CONCORRENTE` sem `contractCompetitor`:** rejeitado na
  validação (mensagem clara).
- **Soft-deleted (`deletedAt`):** empresas deletadas ficam fora de varreduras,
  widget e filtros.

## Definição de Concluído

- [ ] Migração Prisma aditiva aplicada: enums `ClientStatus`/`ContractHolder`, campos novos em `Company` (+ índices) e `Tenant`, `NotificationType` +2 — sem quebrar dados existentes.
- [ ] Criar/editar empresa aceita status, dono da conta, cadência e os campos de contrato, com validações do req 4 (incl. concorrente obrigatório quando detentor = CONCORRENTE).
- [ ] Badge de `clientStatus` visível na lista de Empresas e no `CompanyDetail`; deal GANHO promove empresa a CLIENTE_ATIVO (exceto se já for).
- [ ] Job diário sempre-ativo registrado no boot (`index.ts`), rodando sem Redis.
- [ ] Follow-up: cliente ativo sem interação além do intervalo efetivo gera Task + Notification `CLIENT_FOLLOWUP` (dedup: sem duplicar tarefa aberta; notificação 1×/dia); registrar interação reinicia o ciclo.
- [ ] Lista de Empresas filtra por status de cliente e follow-up pendente.
- [ ] Seção "Contrato guarda-chuva" no `CompanyDetail` com detentor/vigência/valor/escopo, contagem regressiva, badge "Vencido" e edição funcionando.
- [ ] Alertas `CONTRACT_EXPIRING` disparam nos limiares configurados (padrão 90/60/30) para dono + gestores, com dedup por limiar, menor-limiar-aplicável no primeiro disparo e caso "vencido" único.
- [ ] Botão "Iniciar aquecimento" abre o fluxo de desdobramento pré-preenchido com a empresa; desdobramento criado aparece vinculado à empresa.
- [ ] Widget "Contratos a vencer" no Dashboard (ordenado, com badge do detentor, navegação para a empresa, estado vazio) e filtro de contrato na lista de Empresas.
- [ ] Settings: ADMIN/GESTOR editam `clientFollowUpDays` e `contractAlertDays` com validação; papéis menores não acessam.
- [ ] `cd server && npx vitest run && npm run build` e `npm run build` (frontend) sem erros; `check:colors` + `lint:css` verdes.
- [ ] Verificação em dev/preview: cadastrar contrato do concorrente vencendo em ~20 dias → alerta único do limiar 30 na varredura + widget mostra a empresa + "Iniciar aquecimento" cria o desdobramento.
- [ ] Entregue em branch dedicada, para deploy como release único.
