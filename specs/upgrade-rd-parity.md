# Spec: Upgrade Engage ≥ RD Station (escopo mestre faseado)

> **Fonte da análise:** navegação autenticada no RD Station CRM (conta EPC
> Engenharia, Plano PRO) em 04/07/2026 — funil, detalhe de negociação, hub de
> configurações e telas de Qualificação, Questionários, Multi-vendas, Modelos de
> Proposta, Metas, Preferências (gatilhos/permissões), Automação, Telefone
> virtual, Usuários/Equipes/Permissões e Integrações — cruzada com inventário
> funcional completo do VYD Engage (frontend, backend, configuração, integrações).
>
> **Este é o ESCOPO MESTRE do épico.** Cada fase (P0–P3) é entregue como
> build/branch/PR separado, na ordem P0 → P1 → P2 → P3, cada um com seu /review.

## Objetivo

Fechar todas as lacunas funcionais entre o VYD Engage e o RD Station CRM — e
superá-lo — para que a área comercial opere 100% no Engage sem sentir falta do
concorrente. As lacunas foram extraídas por navegação direta no RD logado e
divididas em 4 fases: **P0 Paridade core de vendas** (qualificação, questionários,
multi-vendas, fontes/campanhas, segmentos, presets, gatilhos gerenciais, tarefas
do dia, e-mail 1:1), **P1 Times & governança** (equipes, perfis de permissão
personalizados, visibilidade por entidade, aprovações de admin e Lixeira),
**P2 Documentos & integrações externas** (propostas, assinatura eletrônica,
enriquecimento CNPJ, telefone virtual, central de arquivos) e **P3 WhatsApp & IA**
(canal aprofundado, extensão Chrome, copiloto IA, IA de reuniões). O que o Engage
já cobre igual ou melhor (funis/etapas/motivos, esfriamento, pausar/retomar,
playbooks, automações visuais, forecast/relatórios, busca global, API/webhooks)
fica explicitamente fora.

## Usuários

Time comercial multi-tenant do Engage: vendedores (dia a dia em deals, tarefas,
WhatsApp, ligações), gestores (equipes, metas, alertas, aprovações) e admins
(configuração, permissões, integrações). Tenant real em produção (k2). O público
desta spec para **construir e verificar** é um desenvolvedor full-stack (ou uma
sessão futura de Claude) executando uma fase por vez.

## Contexto do código (estado atual — âncoras)

- Deals: `Deal` com funis/colunas configuráveis, coolingDays por etapa, pausar/
  retomar, motivos de perda configuráveis, `lostCompetitor`, produtos
  (`DealProduct`), `DealStageHistory`; kanban `DealPipelineBoard`.
- Leads/Empresas: `Lead` (fonte, score via `ScoreRule`), `Company` (segmento
  livre `industry`, `clientStatus`, contrato guarda-chuva, dono, follow-up).
- Automations: engine em grafo (BullMQ, gated) com 9+ triggers e 9 actions;
  jobs sempre-ativos sem Redis: `taskNotificationChecker`, `staleDeals`, follow-up
  de clientes.
- Times: `UserRole` fixo (ADMIN/GESTOR/USER) + `commercialFunction`; escopo de
  analista via `ownerScope`/`roleScope`.
- Canais: e-mail (Resend/SMTP + campanhas GrapesJS + inbox), WhatsApp (conexão +
  templates + inbox), Google Calendar, tracking pixel/links, API keys/scopes,
  webhooks out, Zapier.
- Sem: qualificação de deal, questionários, multi-vendas, campanhas no deal,
  segmentos configuráveis, presets, gatilhos configuráveis, equipes, perfis
  custom, visibilidade por entidade, aprovações/lixeira, propostas/assinatura,
  enriquecimento CNPJ, telefonia, central de arquivos, extensão Chrome, copiloto.

## Requisitos

### Obrigatórios — P0 · Paridade core de vendas

1. **Qualificação de negociação.** O tenant deve ter uma escala de qualificação
   de 5 níveis com nomes editáveis (padrão: Muito frio, Frio, Morno, Quente,
   Muito quente) e pontuação máxima opcional por nível. Todo deal deve poder
   receber qualificação (1–5), exibida como estrelas no card do kanban e no
   detalhe, editável inline, com filtro por qualificação na lista e no pipeline.
2. **Questionários.** Admin deve criar questionários (nome, perguntas de escolha
   única/múltipla com pontos por resposta, e perguntas abertas sem pontos).
   Vendedor responde o questionário dentro do deal; a resposta fica registrada
   (com data/autor) e a pontuação total é calculada.
3. **Qualificação automática.** Com o toggle "qualificação automática via
   questionários" ligado e pontuação máxima definida por nível (req 1), ao
   salvar uma resposta de questionário o deal deve ser qualificado
   automaticamente no nível correspondente à pontuação. Com o toggle desligado,
   nada muda na qualificação.
4. **Multi-vendas.** Com o toggle de Multi-vendas do tenant ligado, ao marcar um
   deal como GANHO ou PERDIDO o sistema deve oferecer "agendar próxima
   negociação": tipo (pós-venda, cross-sell, upsell, recompra, relacionamento,
   outro), data de início, funil/etapa destino, valor estimado e responsável
   (padrão: o mesmo). Na data, um job sempre-ativo cria o deal (vinculado à
   mesma empresa/contato, origem "multi-venda") e notifica o responsável.
   Negociações agendadas ainda não criadas devem ser listáveis e canceláveis.
5. **Fontes e campanhas no deal.** O tenant deve ter CRUD de fontes e de
   campanhas (settings); o deal deve ter fonte e campanha selecionáveis; a
   lista/kanban filtra por elas e os relatórios de win/loss e funil segmentam
   por fonte/campanha.
6. **Segmentos de empresas.** CRUD de segmentos por tenant; `Company` referencia
   um segmento; filtro por segmento na lista de empresas e no relatório.
7. **Informações pré-definidas (presets).** Admin deve poder definir listas de
   valores pré-definidos para campos padrão de empresa/contato/deal (ex.: cargo,
   setor); nos formulários, campos com preset viram seleção (com opção de
   digitar novo valor quando permitido pelo admin).
8. **Gatilhos gerenciais configuráveis.** Admin/gestor deve criar gatilhos:
   condição (deal sem interação há N dias [geral ou numa etapa], deal parado na
   mesma etapa há N dias, deal perdido, venda acima de R$ X), destinatários
   (responsável, gestores, usuários específicos) e canal (notificação in-app;
   e-mail opcional). Um job sempre-ativo avalia diariamente com deduplicação. O
   staleDeals atual vira um gatilho padrão pré-criado (sem regressão).
9. **Tarefas de hoje + negociações sem tarefa.** Um painel acessível do chrome
   (e widget no Dashboard) deve listar as tarefas do dia do usuário e oferecer
   "ver negociações sem tarefa" — deals abertos do usuário sem tarefa pendente —
   com criação rápida de tarefa a partir da lista.
10. **Modelos de e-mail 1:1.** CRUD de modelos de e-mail (assunto + corpo rico
    com variáveis {{nome}}, {{empresa}}, {{negociacao}}, …) e ação "Enviar
    e-mail" no deal/lead que usa o modelo, envia pela configuração de e-mail
    existente e registra `Interaction` EMAIL na timeline.
11. **Comemoração de venda.** Ao marcar venda, exibir uma celebração breve com
    contagem/valor de vendas do usuário no mês (desativável por tenant).

### Obrigatórios — P1 · Times & governança

12. **Equipes de vendas.** CRUD de equipes (nome, líder, membros). Performance
    (`TeamPerformance`), relatórios e filtros ganham dimensão por equipe; metas
    (`Goal`) passam a aceitar meta de equipe além de individual.
13. **Perfis de permissão personalizados.** Além dos papéis padrão (mapeados de
    ADMIN/GESTOR/USER, imutáveis), o admin deve criar perfis com permissões
    granulares: por entidade (ver/criar/editar/excluir leads, empresas, deals,
    tarefas), exportar, importar, ações em massa, transferir responsável,
    configurar (settings), gerenciar automações. Cada usuário aponta para um
    perfil; o backend aplica as permissões em todas as rotas relevantes.
14. **Visibilidade por entidade.** Por perfil (ou por usuário), definir a
    visibilidade de Negociações, Empresas e Contatos: **Geral** (tudo do
    tenant), **Equipe** (registros de membros da mesma equipe) ou **Somente
    minhas**. O escopo é aplicado no backend (extensão do `ownerScope`) em
    listas, buscas, relatórios e exports.
15. **Aprovação de exportações e ações em massa.** Quando o perfil do usuário
    exigir aprovação, exportações e ações em massa geram uma solicitação
    pendente (o que, quem, quando, escopo); admins são notificados e aprovam ou
    rejeitam numa fila em settings; aprovar executa e notifica o solicitante;
    rejeitar cancela com motivo. Solicitações expiram em 7 dias.
16. **Lixeira e aprovação de exclusão.** Exclusões passam a ir para a Lixeira
    (por entidade, com autor/data). Usuário sem permissão de exclusão definitiva
    gera solicitação para admin (como no RD: "solicitou a exclusão de um
    registro"). Itens na Lixeira são restauráveis por 30 dias; depois podem ser
    expurgados por job. Admin vê/filtra a Lixeira em settings.

### Obrigatórios — P2 · Documentos & integrações externas

17. **Modelos de proposta.** CRUD de modelos (editor rico com variáveis do deal/
    empresa/contato + bloco de tabela de produtos/itens do deal); status
    rascunho/publicado; modelo padrão por tenant.
18. **Geração de proposta no deal.** A partir do deal, gerar proposta de um
    modelo → PDF (com itens e totais), anexada ao deal, registrada na timeline e
    baixável. Regenerar cria nova versão (mantém histórico).
19. **Assinatura eletrônica.** Enviar a proposta gerada para assinatura via
    provedor plugável (primeiro provedor: **ZapSign**; credencial por tenant em
    settings, gated). Acompanhar status no deal (enviado → visualizado →
    assinado/recusado) via webhook do provedor; eventos na timeline. Sem
    credencial configurada, a funcionalidade fica oculta.
20. **Enriquecimento por CNPJ.** Na empresa (criação e detalhe), ação
    "Enriquecer pelo CNPJ" consulta BrasilAPI (fallback ReceitaWS) e propõe
    preenchimento de razão social, nome fantasia, endereço, CNAE/segmento e
    porte, exibindo um diff campo a campo para o usuário aplicar ou descartar.
    Nunca sobrescreve silenciosamente; respeita rate limit com fila/backoff.
21. **Telefone virtual.** Arquitetura de telefonia plugável com um primeiro
    provedor (decidir na implementação entre Zenvia/TotalVoice/Twilio Voice;
    credencial por tenant, gated): clicar no telefone de contato/lead abre o
    webphone no navegador e liga; ao encerrar, registra `Interaction` CALL com
    duração (e URL de gravação se o provedor fornecer). Custo por minuto é do
    provedor/tenant. Sem credencial, telefones seguem como hoje (tel:/wa.me).
22. **Central de arquivos.** Aba "Arquivos" no deal e na empresa consolidando
    anexos (upload manual, propostas geradas, anexos futuros), com nome, tipo,
    tamanho, autor e data; download e exclusão (respeitando Lixeira/permissões).
    Armazenamento em objeto S3-compatível configurável (ex.: Cloudflare R2),
    com limite por tenant.

### Obrigatórios — P3 · WhatsApp & IA

23. **Canal WhatsApp aprofundado.** Enviar WhatsApp a partir do deal/lead/
    empresa usando a conexão existente, com templates com variáveis; mensagens
    enviadas/recebidas de contatos vinculados aparecem na timeline do deal;
    sem conexão ativa, fallback wa.me continua.
24. **Extensão Chrome (estilo WhatStation).** Extensão de navegador que, no
    WhatsApp Web, identifica o número da conversa aberta e mostra painel do
    Engage: lead/contato/empresa/deals correspondentes, últimas interações e
    tarefas, com ações rápidas (criar lead/deal/tarefa, registrar nota).
    Autenticação por API key de usuário (scopes mínimos). Código em diretório
    próprio (`extension/`), empacotável para a Chrome Web Store.
25. **Copiloto IA via WhatsApp.** Um número/conexão dedicada permite ao usuário
    conversar com o Engage: consultas ("minhas tarefas de hoje", "status do deal
    X") respondidas direto; ações de escrita ("cria tarefa...", "atualiza valor
    do deal...") sempre com confirmação explícita antes de executar. Usa o LLM já
    configurado (OpenAI) com tool-calling sobre a API do Engage, respeitando as
    permissões/visibilidade do usuário vinculado ao número.
26. **IA de reuniões.** No deal, subir áudio (ou colar transcrição) de uma
    reunião → transcrever (Whisper), gerar resumo, avaliação e próximos passos
    sugeridos (viram tarefas sugeridas) e sugestões de atualização de campos —
    tudo aplicado somente após revisão/aceite do usuário. Registrado na timeline.

### Fora do Escopo

- Replicar **RD Conversas** e **RD Station Marketing** (produtos separados do
  RD; o Engage cobre com inbox/campanhas próprios).
- **Marketplace visual de integrações** (API pública + webhooks + Zapier já
  cobrem; catálogo visual fica para o futuro).
- **Migração de dados do RD Station** (já existe importador; carga é operação,
  não feature).
- **BI dedicado / exportação para BI** além dos exports e API existentes.
- Recriar o que o Engage já tem igual ou melhor: funis/etapas/motivos de perda,
  esfriamento por etapa + badge, pausar/retomar, dias por etapa, playbooks,
  automações visuais em grafo, forecast/win-loss/performance, busca global
  (Cmd+K), import/export, API keys/scopes/webhooks/Zapier, saved views.
- Faturar telefonia/assinatura em nome do tenant (billing desses serviços é
  direto com o provedor).

## Restrições

- **Fases independentes:** cada fase (P0/P1/P2/P3) = branch dedicada + PR +
  /review + release único; uma fase não pode quebrar as anteriores. Migrações
  Prisma **aditivas** por fase, aplicadas antes do deploy (app em produção,
  tenant k2).
- **Multi-tenant:** toda entidade nova tem `tenantId` e toda query filtra por
  ele; credenciais de provedores externos são por tenant e criptografadas
  (`ENCRYPTION_KEY`, padrão das configs de e-mail/WhatsApp).
- **Gating:** funcionalidades com dependência externa (assinatura, telefonia,
  enriquecimento, IA, copiloto) degradam graciosamente quando não configuradas —
  ocultas ou com CTA de configuração, nunca quebradas.
- **Jobs:** preferir o padrão sempre-ativo sem Redis (`setInterval` + dedup por
  `Notification.metadata`/estado) para multi-vendas, gatilhos e expurgo da
  Lixeira; BullMQ só onde já é usado (automations/campanhas).
- **Permissões:** P1 estende (não substitui) `authMiddleware`/`ownerScope`; os
  papéis ADMIN/GESTOR/USER continuam válidos como perfis padrão; nenhuma rota
  existente pode perder proteção.
- **Segurança:** HTML rico sanitizado (padrão DOMPurify existente); webhooks de
  provedores validados por assinatura/secret; anti-SSRF nos webhooks/URLs;
  novos grupos de rota registrados na whitelist CSRF de `server/src/index.ts`.
- **Design system:** UI nova só com tokens semânticos (gotchas do app:
  `text-foreground`/`text-muted-foreground`/`border-border`); arquivos novos no
  `STRICT_SCOPE` do `check:colors`.
- **Verificação sem produção:** nada de testar contra o banco/canais de
  produção; provedores externos testados com contas sandbox/de teste.

## Casos Extremos

- **Questionário sem perguntas pontuadas:** resposta salva, pontuação 0, não
  altera qualificação nem com o toggle ligado (sem faixa correspondente).
- **Multi-venda com data no passado** (ou tenant desligou o toggle antes da
  data): o job cria imediatamente na próxima varredura / cancela conforme o
  caso; agendamento é cancelável até a criação.
- **Gatilho mal configurado** (N=0, sem destinatário): rejeitado na validação.
- **Usuário movido de equipe:** visibilidade "Equipe" reflete a nova equipe na
  próxima requisição; registros antigos não mudam de dono.
- **Perfil excluído em uso:** bloqueado — exige migrar usuários para outro
  perfil antes.
- **Solicitação de aprovação órfã** (solicitante desativado): expira normalmente
  e é marcada como cancelada.
- **Restauração da Lixeira com pai excluído** (ex.: deal de empresa excluída):
  restaura o pai junto ou bloqueia com mensagem clara.
- **CNPJ inválido/não encontrado/API fora:** mensagem clara, nada é alterado;
  retry manual.
- **Assinatura recusada/expirada:** status no deal + evento na timeline;
  reenvio gera novo envelope.
- **Webphone sem microfone/permissão negada:** erro claro; registro manual da
  ligação continua possível.
- **Extensão sem conversa aberta / número não encontrado:** painel oferece
  "criar lead/contato" com o número detectado.
- **Copiloto: comando ambíguo ou destrutivo:** sempre pergunta antes; nunca
  executa exclusões; número não vinculado a usuário → ignora com resposta
  padrão.
- **IA de reuniões com áudio ruim:** transcrição parcial sinalizada; nada é
  aplicado sem aceite.
- **Storage cheio (limite do tenant):** upload bloqueado com mensagem e CTA.

## Definição de Concluído

**Por fase (aplicável a todas):**
- [ ] Migração Prisma aditiva da fase aplicada sem quebrar dados existentes.
- [ ] `cd server && npx vitest run && npm run build` e `npm run build` (frontend) verdes; `check:colors` + `lint:css` verdes.
- [ ] Entregue em branch dedicada; /review aprovado; release único.

**P0:**
- [ ] Escala de qualificação configurável; estrelas no card e no detalhe; filtro por qualificação.
- [ ] Questionário criado, respondido no deal, pontuado; toggle de qualificação automática qualifica pelo score.
- [ ] Multi-vendas: ao ganhar/perder com toggle ligado, agendamento oferecido; job cria o deal na data e notifica; agendados listáveis/canceláveis.
- [ ] Fontes/campanhas e segmentos configuráveis e filtráveis; presets viram seleção nos formulários.
- [ ] Gatilho gerencial criado dispara notificação correta com dedup; staleDeals preservado como gatilho padrão.
- [ ] Painel "Tarefas de hoje" + "negociações sem tarefa" funcionais; e-mail 1:1 por modelo enviado e registrado na timeline; comemoração de venda exibida (e desativável).

**P1:**
- [ ] Equipes com membros/líder; performance e metas por equipe.
- [ ] Perfil personalizado criado e aplicado: permissões respeitadas no backend (testes de rota provando negação).
- [ ] Visibilidade Geral/Equipe/Somente minhas aplicada em listas, buscas, relatórios e exports das 3 entidades.
- [ ] Exportação/ação em massa de usuário restrito gera solicitação; aprovar executa, rejeitar cancela; fila visível ao admin.
- [ ] Exclusão vai à Lixeira; solicitação de exclusão notifica admin; restauração ≤ 30 dias funciona; expurgo por job.

**P2:**
- [ ] Modelo de proposta com variáveis + tabela de itens; geração no deal produz PDF versionado anexado à timeline.
- [ ] Envio para assinatura (sandbox ZapSign) com status via webhook refletido no deal; oculto sem credencial.
- [ ] Enriquecimento CNPJ mostra diff e aplica só com aceite; erros tratados.
- [ ] Ligação via webphone (sandbox) registra Interaction CALL com duração; oculto sem credencial.
- [ ] Aba Arquivos consolida uploads e propostas com storage S3-compatível e limite por tenant.

**P3:**
- [ ] Envio de WhatsApp pelo deal com template; mensagens na timeline do deal.
- [ ] Extensão Chrome carrega no WhatsApp Web, resolve o número, mostra painel e executa ações rápidas via API key.
- [ ] Copiloto responde consultas e só executa escrita após confirmação; respeita permissões do usuário.
- [ ] IA de reuniões: áudio → transcrição → resumo/sugestões aplicáveis somente com aceite.
