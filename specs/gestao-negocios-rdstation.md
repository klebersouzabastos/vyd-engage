# Spec: Gestão de Negócios (Pipeline de Deals) — Migração RD Station → VYD Engage

> Origem desta spec: exploração do RD Station CRM do tenant **EPC Engenharia** (funil "Desenvolvimento de Negócios" e demais) via navegador + gap analysis do código atual do VYD Engage. O objetivo é que, ao migrar do RD Station para o Engage, a equipe **não sinta diferença** ao operar o fluxo de gestão de negócios.

## Objetivo

Replicar no VYD Engage o processo de **gestão de negócios** que a EPC/Tenax usa hoje no RD Station CRM — múltiplos funis de venda com etapas ricas (sigla, objetivo, playbook, esfriamento e campos obrigatórios por etapa), negociações com qualificação/fonte/campanha/valores/produtos/múltiplos contatos, status ganho/perdido/pausado com motivo de perda configurável, detalhe da negociação em abas (histórico, e-mail, tarefas, questionários, produtos, arquivos, propostas), kanban com cards personalizáveis, e o sistema de campos personalizados por entidade. O Engage já possui o esqueleto (funis de Deal, colunas, drag-drop, produtos, histórico de etapa, motivo de perda texto-livre, job de esfriamento global e automação por evento de deal); esta spec cobre o **delta** necessário para paridade funcional, registrando cada novo model, campo, módulo e adequação.

## Usuários

- **Vendedor / Desenvolvimento de Negócios** — opera o dia a dia: cria e move negociações no kanban, preenche campos por etapa, registra interações e tarefas, marca ganho/perda. Uso intenso e diário; nível técnico médio; é o usuário que **não pode sentir diferença** na migração.
- **Gestor Comercial / Diretoria** — acompanha pipeline, win/loss, metas, visibilidade por equipe; configura funis, etapas, campos, motivos de perda, fontes.
- **Administrador do tenant** — configura o processo de venda (funis, etapas, playbook, campos personalizados, motivos de perda, fontes/campanhas, equipes, automações) e conduz a migração de dados do RD Station.

## Requisitos

> Prioridade: **P0** = fluxo diário/núcleo (a migração não é transparente sem isto); **P1** = parte da experiência, porém de uso menos frequente; **P2** = configuração avançada/adjacente. Status atual no Engage indicado como `[presente]`, `[parcial]` ou `[ausente]` para orientar reuso vs construção.

### Obrigatórios

#### A. Funis e etapas

1. **(P0)** O sistema deve suportar **múltiplos funis de negociação** por tenant, cada um com etapas (colunas) ordenadas, selecionáveis no topo do kanban, com criar/renomear/marcar-como-padrão/excluir. `[presente — Funnel.type=DEAL, FunnelColumn ordenada+cor; Deals.tsx]`
2. **(P0)** Cada **etapa** deve ter: nome, **sigla/abreviação**, **objetivo** (texto até 200 caracteres) e **descrição/playbook** (texto até 1.500 caracteres). `[parcial — FunnelColumn só tem title/color/order; faltam abbreviation/objective/playbook]`
3. **(P0)** Cada etapa deve ter configuração de **esfriamento por etapa**: um toggle "destacar negociações esfriando" e um número de **dias de inatividade** (N) — uma negociação na etapa sem interação há mais de N dias é destacada como "esfriando há X dias". `[parcial — detecção stale existe mas é global via Tenant.staleDays; precisa por etapa em FunnelColumn]`
4. **(P0)** O sistema deve permitir definir **campos personalizados obrigatórios por etapa** e **bloquear o avanço** de uma negociação para a próxima etapa enquanto os campos obrigatórios da etapa de destino não estiverem preenchidos (validação no backend ao mover, com feedback claro na UI listando os campos pendentes). `[ausente — required é global, sem enforcement no moveDeal]`
5. **(P1)** O sistema deve permitir configurar **visibilidade de funil por equipe** (cada funil visível para todas as equipes ou para equipes específicas), filtrando os funis listados conforme a equipe do usuário. `[ausente — não há model Team nem visibilidade de funil]`
6. **(P2)** O sistema deve suportar **automação entre funis**: ao entrar numa etapa, criar/mover uma negociação em outro funil. `[ausente — automationEngine não tem step de mover/criar deal em outro funil]`
7. **(P0)** A migração deve recriar os **8 funis** do RD Station com suas etapas e siglas (ver seção "Dados de Migração"), de modo que a estrutura seja idêntica à atual.

#### B. Campos personalizados (custom fields)

8. **(P0)** O sistema deve permitir campos personalizados em **4 entidades**: Negociação (Deal), Empresa (Company), Contato (Lead/Contact) e **Produto** (Product). `[parcial — Lead/Deal/Company já têm customFields Json, mas CustomField não tem coluna de entidade e Product não aceita custom fields]`
9. **(P0)** Os **tipos** de campo personalizado devem incluir: Texto livre, Seleção única (dropdown), **Seleção múltipla (multi-select)**, Data e Numérico — e a migração deve preservar o tipo de cada campo existente. `[parcial — enum só TEXT/NUMBER/DATE/SELECT/TEXTAREA/CHECKBOX; faltam MULTI_SELECT e, idealmente, máscaras CPF/CNPJ]`
10. **(P0)** Cada campo personalizado deve ter **obrigatoriedade configurável**: "não obrigatório" ou **"obrigatório por etapa"** (vinculado a uma etapa específica do funil — ver requisito 4). `[ausente — required é booleano global]`
11. **(P1)** Cada campo personalizado deve ter **visibilidade configurável**: visível sempre, visível apenas no formulário de cadastro, visível por funil específico, ou único (não duplicável). `[ausente]`
12. **(P0)** Os campos personalizados devem ser **ordenáveis** e renderizados nos formulários (criação/edição) e no detalhe da entidade conforme tipo, ordem e visibilidade. `[parcial — order existe; falta render por entidade/visibilidade/tipo-multi]`
13. **(P0)** A migração deve recriar **todos** os campos personalizados existentes no RD Station (~39 em Negociação + os de Empresa/Contato/Produto), com nome, tipo, obrigatoriedade e opções (ver "Dados de Migração").

#### C. Campos e relações da Negociação (Deal)

14. **(P0)** A negociação deve ter os campos padrão: **Nome**, **Empresa** (1), **Responsável** (1), **Qualificação (1 a 5 estrelas)**, **Previsão de fechamento** (data), **Fonte**, **Campanha**, **Valor único**, **Valor recorrente**, **Valor total** (derivado/produtos), **Funil**, **Etapa**, **Criada em**. `[parcial — existem name/value/expectedCloseDate/funnel/stage/companyId; faltam qualification, source, campaign, oneTimeValue, recurringValue]`
15. **(P0)** A **Qualificação** deve ser editável como estrelas de 1 a 5 no formulário, no detalhe e (opcionalmente) no card. `[ausente]`
16. **(P0)** A negociação deve permitir **múltiplos contatos** (N), cada contato com nome, cargo, telefone e e-mail, além de 1 empresa. `[parcial — Deal.companyId ok, mas Deal.leadId é singular; precisa pivot Deal↔Contato]`
17. **(P0)** A negociação deve ter **itens de produto/serviço** (catálogo + linha com quantidade/valor) que somam no valor total. `[presente — Product + DealProduct + DealProducts.tsx]`
18. **(P1)** A **Fonte** e a **Campanha** da negociação devem vir de listas configuráveis pelo tenant (cadastro de Fontes e Campanhas). `[ausente — Lead.source é enum fixo; Campaign é só email marketing]`

#### D. Status, Ganho/Perda e Pausar

19. **(P0)** A negociação deve ter status explícito: **Em andamento (aberto)**, **Ganho**, **Perdido**, e a flag independente **Pausado**. `[parcial — status é inferido do stage (WON/LOST); falta PAUSED/pausedAt e separação de status]`
20. **(P0)** O usuário deve **Marcar venda** (ganho) por ação dedicada, registrando `wonAt` e atualizando métricas. `[parcial — hoje só muda stage para WON]`
21. **(P0)** O usuário deve **Marcar perda** por ação dedicada, **exigindo um motivo de perda escolhido de uma lista configurável** pelo tenant, registrando `lostAt` e o motivo. `[parcial — modal de perda existe com 6 motivos hardcoded; lostReason é texto livre]`
22. **(P0)** O sistema deve ter um **cadastro configurável de Motivos de Perda** (lista por tenant, com ativar/desativar e ordenar), e a migração deve recriar os 13 motivos atuais (ver "Dados de Migração"). `[ausente]`
23. **(P1)** O usuário deve poder **Pausar** e **Retomar** uma negociação; negociações pausadas não disparam esfriamento e são distinguíveis nos filtros (Pausado / Não pausado). `[ausente]`

#### E. Detalhe da Negociação (em abas)

24. **(P0)** O detalhe deve exibir um **stepper horizontal das etapas** do funil, destacando a etapa atual e mostrando **tempo na etapa atual** (ex.: "657 dias"); clicar numa etapa avança/retrocede a negociação (respeitando os campos obrigatórios da etapa de destino — requisito 4). `[parcial — DealStageHistory tem duração, mas exibida como lista; não é stepper clicável]`
25. **(P0)** O detalhe deve exibir o **playbook da etapa atual** (objetivo + descrição configurados na etapa). `[ausente — depende do requisito 2]`
26. **(P0)** O detalhe deve exibir um **badge de esfriamento** quando a negociação estiver inativa além do limite da etapa. `[parcial — badge existe no card]`
27. **(P0)** O detalhe deve organizar o conteúdo em **abas**: Histórico, E-mail, Tarefas, Produtos, Arquivos, Propostas e Questionários. `[parcial — hoje é layout único; Produtos presente, demais variam]`
28. **(P0)** A aba **Histórico** deve mostrar a timeline de eventos (mudança de etapa, ganho/perda, pausa/retomada, tarefas criadas/concluídas, e-mails, anotações, automações), com **filtros por tipo de evento** e ação de **criar anotação**. `[parcial — timeline de Interaction + AuditTimeline existem; faltam filtros por tipo e organização em aba]`
29. **(P1)** A aba **Tarefas** deve listar e permitir CRUD das tarefas vinculadas à negociação (`Task.dealId`), incluindo as criadas automaticamente por etapa (StageTaskTemplate). `[parcial — model/auto-criação existem; falta aba na UI do detalhe]`
30. **(P1)** A aba **Arquivos** deve permitir anexar/baixar arquivos na negociação. `[ausente — sem model de anexo]`
31. **(P1)** A aba **Propostas** deve listar propostas geradas e permitir gerar a partir de **modelos de proposta** configuráveis. `[parcial — existe export PDF único; faltam histórico e modelos]`
32. **(P1)** A aba **E-mail** deve exibir a thread de e-mails relacionados à negociação. `[ausente — só "Gerar Email" via IA hoje]`
33. **(P2)** A aba **Questionários** deve permitir aplicar/responder questionários configuráveis vinculados à negociação. `[ausente]`

#### F. Kanban e cards

34. **(P0)** O kanban deve renderizar **uma coluna por etapa** do funil selecionado, com drag-and-drop entre etapas (persistindo etapa e posição) e **totais por coluna** (contagem + soma de valor). `[presente — DealPipelineBoard]`
35. **(P0)** O **card** da negociação deve exibir: status (em andamento/ganho/perdido/pausado), indicador de esfriamento, nome, empresa, qualificação, responsável, valor e contagem de tarefas. `[parcial — card mostra nome/valor/responsável/score/risco; faltam empresa, qualificação, contagem de tarefas, status]`
36. **(P1)** O usuário deve poder **Personalizar os campos do card** ("Personalizar cartões"): escolher quais campos aparecem, por funil (preferência por usuário). Campos fixos: status, esfriamento, nome. Campos opcionais: empresa, qualificação, responsável, valor único, valor recorrente, data de criação, data de último contato, previsão de fechamento, campanha, fonte. `[ausente]`
37. **(P0)** O kanban deve oferecer **filtros** (responsável, status, ordenação) e **busca** diretamente na visão de funil, além do **toggle visão lista**. `[parcial — filtros/saved views existem na visão lista; expor também no pipeline]`

#### G. Configurações de apoio

38. **(P1)** O sistema deve ter telas de configuração para: **Funis/Etapas** (sigla, objetivo, playbook, esfriamento, campos obrigatórios), **Campos personalizados** (por entidade), **Motivos de perda**, **Fontes e campanhas**, **Equipes** (e visibilidade de funil), **Catálogo de produtos**. `[parcial — campos personalizados e produtos têm base; demais ausentes]`
39. **(P2)** O sistema deve suportar **Modelos de proposta** e **Questionários** configuráveis (ver requisitos 31 e 33).
40. **(P1)** As **Metas** existentes devem permanecer compatíveis com o conceito de pipeline (metas por usuário/período; alinhar a funil/equipe se necessário). `[presente — Goal model]`

#### H. Automação

41. **(P1)** O sistema deve disparar automações por evento de negociação (criada, mudou de etapa) com ações como enviar e-mail e criar tarefa (inclui criação automática de tarefa por etapa). `[presente — automationEngine + StageTaskTemplate; requer ENABLE_AUTOMATION_ENGINE+Redis]`
42. **(P0)** O job de **esfriamento** deve usar o limite de dias **da etapa** em que a negociação está (com fallback para o limite global do tenant) e destacar/alertar negociações inativas. `[parcial — staleDeals usa só Tenant.staleDays]`

### Fora do Escopo

- **Telefonia/VOIP** do RD Station ("Saldo telefônico", "Telefone virtual", ligações registradas via discador). Interações de ligação podem ser registradas manualmente, mas o discador/saldo não será portado.
- **Add-on de IA do RD** que grava/avalia reuniões e atualiza o CRM automaticamente.
- Produtos externos do RD: **RD Station Conversas**, **RD Station Marketing**, **extensão de WhatsApp**, **Rê (assistente WhatsApp)**.
- **Enriquecimento de empresas**, **Assinatura eletrônica**, **Multi-vendas**, **BI/Exportação para BI**, **Integrações** específicas do RD.
- Recriar features que o Engage já tem e não pertencem a este fluxo (ex.: módulos de IA do Engage, campanhas de e-mail marketing) — permanecem como estão.
- **Migração automatizada de dados** via API do RD Station (a importação dos registros existentes será tratada separadamente, por arquivo/script; esta spec define a estrutura-alvo e o seed de configuração).

## Restrições

- **Stack:** seguir o padrão do Engage — Backend Node.js + Express + Prisma + PostgreSQL; Frontend React + TypeScript + shadcn/ui + TanStack Query; multi-tenancy obrigatória (toda query filtra `tenantId`); CSRF whitelist para novas rotas autenticadas; resposta `{ status, data }`.
- **Reuso obrigatório (não duplicar):** `Funnel`/`FunnelColumn`, `Deal`, `DealProduct`/`Product`, `DealStageHistory`, `StageTaskTemplate`, `CustomField`, `Task`, `Interaction`/`AuditLog`, `Company`, `Lead`, `Goal`, `Automation`. Estender estes models em vez de criar paralelos.
- **Fidelidade de migração:** os nomes de funis, etapas, siglas, campos personalizados (e suas opções), motivos de perda e fontes devem ser idênticos aos do RD Station (ver "Dados de Migração"), para que o usuário reconheça seu ambiente.
- **Banco:** o app ainda **não está em produção**, então migrations podem ser aplicadas; ainda assim, migrations devem ser criadas e revisadas (não usar `db push`).
- **Não regredir:** o que o Engage já faz (drag-drop, totais, produtos, histórico, automação) deve continuar funcionando.

## Adequações Necessárias no Engage (novos models, campos e módulos)

> Registro explícito de tudo que precisa ser criado/alterado para a paridade (requisito do solicitante). Cada item referencia o(s) requisito(s) acima.

### Novos campos em models existentes

- **FunnelColumn**: `abbreviation String?`, `objective String? @db.VarChar(200)`, `playbook String? @db.VarChar(1500)`, `coolingEnabled Boolean @default(false)`, `coolingDays Int?` — reqs 2, 3.
- **Deal**: `qualification Int?` (1-5), `sourceId String?`, `campaignId String?`, `oneTimeValue Decimal?`, `recurringValue Decimal?`, `status DealStatus @default(OPEN)`, `pausedAt DateTime?`, `wonAt DateTime?`, `lostAt DateTime?`, `lostReasonId String?` — reqs 14, 15, 18, 19, 20, 21, 23.
- **CustomField**: `entity CustomFieldEntity` (DEAL|COMPANY|CONTACT|PRODUCT), `visibility CustomFieldVisibility` (VISIBLE|ON_CREATE|BY_FUNNEL|UNIQUE), tipo estendido (`MULTI_SELECT`, e máscaras `CPF`/`CNPJ`) — reqs 8, 9, 11. Obrigatoriedade por etapa via novo model `StageRequiredField` (req 10).
- **Product**: `customFields Json @default("{}")` — req 8.
- **Enum DealStatus** (novo): `OPEN | WON | LOST | PAUSED`.

### Novos models

- **Team** (`id, tenantId, name`) + **TeamMember** (`teamId, userId`) e **FunnelVisibility**/`Funnel.visibleToTeamIds` — req 5.
- **LostReason** (`id, tenantId, label, active, order`) — req 22 (substitui motivos hardcoded; `Deal.lostReasonId` referencia).
- **DealContact** (pivot `dealId, leadId, roleNoDeal`) reaproveitando `Lead` como contato — req 16.
- **StageRequiredField** (`funnelColumnId, customFieldId`) — reqs 4, 10 (validação que trava avanço).
- **DealSource** (`id, tenantId, name, active`) e **OriginCampaign** (origem de negociação, distinta de Campaign de e-mail) — req 18.
- **CardFieldPreference** (`tenantId, userId, funnelId, fields Json`) — req 36 (ou persistir em SavedView/localStorage).
- **DealFile**/**Attachment** (`dealId, name, url/path, size`) — req 30.
- **Proposal** + **ProposalTemplate** — req 31.
- **Questionnaire** + **QuestionnaireResponse** — req 33.

### Adequações de comportamento (sem novo schema, ou além dele)

- `staleDeals` job: usar `coolingDays` da etapa do deal (fallback `tenant.staleDays`) — req 42.
- `moveDeal`/`dealService.update`: validar `StageRequiredField` da etapa de destino e bloquear avanço — req 4.
- `DealCard`: render dinâmico de campos (status, esfriamento, empresa, qualificação, tarefas) conforme `CardFieldPreference` — reqs 35, 36.
- `DealDetail`: reorganizar em **abas** (req 27) + **stepper clicável** com tempo-na-etapa (req 24) + **playbook** (req 25).
- `automationEngine`: novos step types `move_deal_to_funnel` / `create_deal_in_funnel` — req 6.

## Casos Extremos

- **Avançar etapa com obrigatórios vazios** (drag-drop ou stepper): bloquear, manter a negociação na etapa atual e exibir mensagem listando os campos pendentes da etapa de destino.
- **Marcar perda sem motivo**: bloquear; exigir seleção de motivo da lista configurável.
- **Negociação pausada**: não dispara esfriamento, não conta no "pipeline aberto"/forecast, e some dos alertas de inatividade até ser retomada.
- **Funil sem visibilidade para a equipe do usuário**: não aparece no seletor nem nas queries do usuário.
- **Campo multi-select / CPF / CNPJ**: validar formato; CPF/CNPJ com máscara e validação de dígitos; multi-select aceita 0..N opções.
- **Esfriamento por etapa não configurado**: usar fallback do tenant (`staleDays`); se também ausente, não destacar.
- **Migração — etapa/campo/motivo inexistente no Engage**: o seed deve criar todas as estruturas antes de importar registros; valores de campos sem destino vão para o `customFields` correspondente; deal sem etapa equivalente cai na 1ª etapa do funil.
- **Múltiplos contatos**: remover o contato principal não pode deixar a negociação inconsistente; empresa permanece independente dos contatos.
- **Valor**: `valor total` = soma de produtos quando houver itens; quando não houver, aceita `valor único`/`recorrente` manuais; evitar dupla contagem.
- **Automação entre funis**: evitar laço infinito (deal criado em funil B que dispara automação que cria em A...).

## Dados de Migração (estrutura-alvo idêntica ao RD Station)

### Funis e etapas (8 funis)
1. **Gestão de Contratos**: Registro da Solicitação (RDS) · Análise da Minuta Contratual–Circulação (ADMC-C) · Envio da Minuta Contratual ao Cliente (EDMCAC) · Revisão Final do Contrato (RFDC) · Liberação para Assinatura do Contrato (LPADC) · Contratos Ativos · Contratos Paralisados · Contratos Encerrados.
2. **Desenvolvimento de Negócios**: Oportunidades · Licitações Públicas · Qualificação das Oportunidades (QDO) · Habilitação Técnica Financeira (HTF) · Identificação de Contatos e Alianças (IDCEA) · Em tentativa de Contato (ETDC) · Conexão aos Contatos (CAC) · Apresentação · Acompanhamento.
3. **Cadastro no Cliente**: Registro do Cadastro (RDC) · Avaliação dos Documentos Solicitados (ADDS) · Solicitação de Documentos aos Setores Internos (SDDASI) · Documentação Enviada ao Cliente (DEAC) · Documentação Não Aprovada (DNA) · Documentação Aprovada.
4. **GO, NO GO – Convites**: Registro do Convite (RDC) · Avaliação Inicial–Comercial (AI-C) · Avaliação Diretoria Técnica (ADT) · Avaliação Diretoria Comercial (ADC) · Avaliação Presidência · Propostas GO · Proposta NO GO (PNG).
5. **Orçamentos**: Registro do Número de Proposta (RDNDP) · Reunião de Esclarecimento (RDE) · Elaboração de Proposta e Estimativas Técnicas (EDPEET) · Elaboração de Proposta Comercial (EDPC) · Revisão Comercial · Fechamento–Diretoria (F-D) · Reunião de Entrega com o Cliente (RDECOC) · Envio de Propostas ao Cliente (EDPAC) · Revisão da Proposta a Pedido do Cliente (RDPAPDC).
6. **Proposta e Estimativas Técnicas**: Registro da Solicitação (RDS) · Apresentação do Escopo (ADE) · Estimativa de Recursos (EDR) · Fechamento e Revisão PT (FERP) · Proposta e Estimativa Enviada (PEEE).
7. **Pipeline de Oportunidades**: Leads Identificados · Conexão aos Leads (CAL) · Reunião Agendada · Diagnóstico · Acompanhamento.
8. **Relacionamento com Clientes**: Cliente Ativo · Cliente Inativo.

### Campos personalizados de Negociação (~39) — nome (tipo)
Enquadramento (multi) · Origem (multi) · Origem da Solicitação (multi) · Visita Técnica (multi) · Critérios de Medição (texto) · Escopo Geral (texto) · Entrega da Proposta (data) · Detalhes da Entrega da Proposta (texto) · Recomendação de GNG Comercial (única) · Prazo para Pagamento (texto) · Seguros/Garantias (texto) · Riscos Comerciais Identificados (texto) · Número da Proposta (texto) · Disciplinas Envolvidas (multi) · Recomendação de GNG Técnico (única) · Metodologia de Projeto (multi) · Prazo para Elaboração dos Projetos (texto) · Exclusões de Escopo (texto) · Necessidade de Subcontratação (única) · Riscos Técnicos Identificados (texto) · Atividades Sob Domínio (única) · Considerações Técnicas (texto) · Tipo de Proposta (única) · Revisão (texto) · Margem Bruta % (texto) · Empresa TENAX (única) · Responsável BI (única) · Natureza do Cliente (única) · Reajustamento dos Preços (texto) · Data Base dos Preços (data) · Critério de Medição (texto) · Prazo de Execução (texto) · Riscos Observados (texto) · Prazo de Vigência do Contrato (texto) · Classificação do Ticket (multi) · Pendências (texto) · Documentos Solicitados (texto) · % Go x Get (texto) · Recomendação de GNG Presidência (multi).
Campos padrão da Negociação: Nome, Empresa, Produto e valor, Qualificação, Previsão de fechamento, Fonte, Campanha, Criada em, Valor total, Valor único, Funil, Etapa.

### Campos personalizados — Empresa / Contato / Produto
- **Empresa** (padrão: Nome, Segmento, URL, Resumo, Endereço) + custom: CNPJ (texto, único), Nome Fantasia (texto, único).
- **Contato** (padrão: Nome, Cargo, Telefone, E-mail, Privacidade, Empresa) + custom: Celular (texto, único).
- **Produto** (padrão: Nome, Descrição, Valor).

### Motivos de perda (13)
Cliente Bloqueado · Cliente optou por não realizar o projeto · Contrato de Pequeno Porte · Equipe Comercial Indisponível · Equipe Técnica Indisponível · Falta de Atestação · Falta de Competitividades · Falta de Expertise · Fechou com outra empresa · Fora da área de negócios da TENAX · Prazo Curto de Proposta · Preço · Sem retorno do Cliente.

## Definição de Concluído

- [ ] Existem múltiplos funis de negociação selecionáveis; os 8 funis do RD foram recriados com as etapas e siglas corretas.
- [ ] Cada etapa tem sigla, objetivo (≤200), playbook (≤1500), toggle de esfriamento e dias configuráveis — editáveis na configuração do funil.
- [ ] Tentar avançar uma negociação para uma etapa com campos obrigatórios vazios é bloqueado, com mensagem listando os campos pendentes (testar via drag-drop e via stepper).
- [ ] Campos personalizados podem ser criados para Negociação, Empresa, Contato e Produto, com tipos texto/única/múltipla/data/numérico, obrigatoriedade por etapa e visibilidade configurável; os ~39 campos de Negociação do RD foram migrados.
- [ ] A negociação tem Qualificação (1-5 estrelas), Fonte, Campanha, Valor único, Valor recorrente e Valor total, múltiplos contatos e itens de produto.
- [ ] "Marcar venda" define status Ganho e `wonAt`; "Marcar perda" exige motivo de uma lista configurável (13 itens migrados) e define `lostAt`.
- [ ] Pausar/Retomar funciona; negociação pausada não esfria nem entra no pipeline aberto; filtro Pausado/Não pausado funciona.
- [ ] O detalhe exibe stepper clicável com tempo-na-etapa, playbook da etapa, badge de esfriamento e abas (Histórico, E-mail, Tarefas, Produtos, Arquivos, Propostas, Questionários).
- [ ] A aba Histórico mostra timeline com filtros por tipo de evento e permite criar anotação.
- [ ] O card do kanban exibe status, esfriamento, nome, empresa, qualificação, responsável, valor e contagem de tarefas; "Personalizar cartões" permite escolher campos por funil/usuário.
- [ ] O job de esfriamento usa o limite de dias da etapa (fallback tenant).
- [ ] Visibilidade de funil por equipe filtra os funis listados conforme a equipe do usuário.
- [ ] Existem telas de configuração para Funis/Etapas, Campos personalizados, Motivos de perda, Fontes/Campanhas e Equipes.
- [ ] Backend e frontend compilam (`tsc` / `vite build`); todas as queries novas filtram `tenantId`; novas rotas autenticadas estão na whitelist de CSRF.
- [ ] Um usuário que vinha do RD Station consegue executar o fluxo diário (criar negociação, preencher campos por etapa, mover no kanban, marcar ganho/perda) sem encontrar diferença estrutural relevante.
