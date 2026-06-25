# Spec: Email Campaigns

## Objetivo

Módulo de campanhas de email integrado ao CRM VYD Engage que permite criar, segmentar, agendar e medir o resultado de envios em lote diretamente sobre a base de leads existente. Elimina a necessidade de ferramentas externas como Mailchimp ou RD Station, unificando o funil de vendas e o disparo de email marketing em um único sistema.

## Usuários

- **Gestor de Marketing/Vendas:** cria campanhas semanais para a base de leads, quer saber quais leads abriram e viraram deals sem exportar CSVs para ferramentas externas.
- **Vendedor Proativo:** faz follow-up em lote para leads frios (ex.: 80 leads parados há 30 dias), enviando email personalizado para todos de uma vez.

Ambos os perfis são usuários de negócio sem conhecimento técnico de HTML; operam via interface web do CRM.

## Requisitos

### Obrigatórios

**Listagem e criação de campanhas (EC-1.1)**

1. O sistema deve exibir a página `/app/campaigns` com a listagem de todas as campanhas do tenant, mostrando nome, status e métricas básicas de cada uma.
2. O sistema deve oferecer um botão "Nova Campanha" que abre um wizard com os passos: Nome, Remetente, Assunto, Editor, Audiência e Agendar.
3. O sistema deve permitir ao usuário construir o corpo do email com um editor de blocos drag-and-drop contendo os tipos: Texto, Imagem (por URL), Botão, Divisor e Espaçador.
4. O sistema deve suportar merge tags `{{lead.name}}`, `{{lead.company}}` e `{{lead.email}}` no campo Assunto e no corpo do email, substituindo-as pelos dados reais do lead no momento do envio.
5. O sistema deve exibir um preview do email renderizado antes do envio.
6. O sistema deve permitir o envio de um email de teste para o endereço de email do usuário logado.
7. O sistema deve persistir as campanhas com os status: `DRAFT`, `SCHEDULED`, `SENDING`, `SENT`, `PAUSED` e `CANCELLED`.
8. O sistema deve criar os modelos `Campaign` e `CampaignRecipient` no banco de dados conforme o schema definido no PRD.
9. O sistema deve expor rotas CRUD em `/api/v1/campaigns` protegidas por autenticação e middleware de tenant.
10. O sistema deve enviar emails em lote via `emailMessagingService.sendEmail` com rate limiting máximo de 100 emails/minuto por tenant, utilizando BullMQ.
11. O sistema deve sanitizar o HTML compilado do template antes do envio para prevenir XSS em conteúdo inserido pelo usuário.

**Segmentação de audiência e agendamento (EC-1.2)**

12. O sistema deve disponibilizar um passo "Audiência" no wizard com filtros de seleção de leads pelos critérios: status, tag, responsável, source, score, data da última interação (antes de / depois de) e ausência de interação há N dias.
13. O sistema deve exibir um preview da audiência com a contagem de leads selecionados ("X leads selecionados") e uma amostra de 5 nomes antes do envio.
14. O sistema deve excluir automaticamente da audiência todos os leads com `unsubscribed = true`.
15. O sistema deve disponibilizar um passo "Agendamento" com as opções "Enviar agora" e "Agendar para" com seletor de data e hora.
16. O sistema deve enfileirar o envio agendado via BullMQ com delay correspondente ao horário selecionado.
17. O sistema deve expor o endpoint `GET /api/v1/campaigns/:id/preview-audience` que aplica os filtros configurados e retorna count e sample de leads.
18. O sistema deve expor o endpoint `POST /api/v1/campaigns/:id/schedule` que enfileira o job de envio da campanha.

**Tracking de abertura e clique (EC-2.1)**

19. O sistema deve inserir um pixel de rastreamento (imagem 1×1) em cada email enviado, com URL única por combinação `(campaignId, leadId)`.
20. O sistema deve substituir cada URL no corpo do email por um link de redirecionamento rastreável antes do envio.
21. O sistema deve registrar um evento do tipo `OPENED` no model `CampaignEvent` quando o pixel de abertura for requisitado.
22. O sistema deve registrar um evento do tipo `CLICKED` no model `CampaignEvent`, incluindo a URL original, quando o link de redirecionamento for acessado, e então redirecionar o usuário para o destino.
23. O sistema deve incluir um link de descadastro no rodapé de todo email de campanha que, ao ser acessado via `GET /api/v1/track/unsubscribe/:token`, sete `lead.unsubscribed = true` e registre `unsubscribedAt`.
24. O sistema deve processar notificações de bounce vindas do webhook do Resend/SendGrid via a rota de webhooks existente e registrar um evento `BOUNCED` no `CampaignEvent`.
25. O sistema deve criar o model `CampaignEvent` no banco de dados com os campos definidos no PRD.
26. O sistema deve expor as rotas `GET /api/v1/track/campaign-open/:token` e `GET /api/v1/track/campaign-click/:token` como rotas públicas, sem autenticação e sem CSRF.
27. O link de descadastro deve funcionar sem autenticação, acessível por token único público, e deve remover o lead de todas as futuras campanhas automaticamente (conformidade LGPD).

**Dashboard de resultados (EC-2.2)**

28. O sistema deve exibir uma aba "Resultados" na página de detalhe de campanha (`CampaignDetail`), disponível apenas após a campanha ter sido enviada.
29. O sistema deve apresentar na aba de resultados as métricas: total de Enviados, Entregues, Abertos (únicos), Cliques (únicos), Descadastros e Bounces.
30. O sistema deve calcular e exibir as taxas percentuais: Taxa de abertura (%), CTR (%) e Taxa de descadastro (%).
31. O sistema deve exibir uma tabela de destinatários com colunas: nome, email, status do destinatário (enviado/aberto/clicado/descadastrado) e data de abertura.
32. O sistema deve exibir um gráfico de aberturas por hora nas primeiras 48 horas após o envio, utilizando Recharts.
33. O sistema deve oferecer um botão "Exportar CSV" que baixa a lista completa de destinatários com seus respectivos eventos.
34. O sistema deve expor o endpoint `GET /api/v1/campaigns/:id/stats` que agrega os `CampaignEvent` por tipo e retorna as métricas calculadas.

### Fora do Escopo

- Editor visual avançado com bibliotecas de terceiros como Unlayer ou GrapeJS.
- Templates de email pré-prontos ou biblioteca de templates.
- Automações disparadas por resultado de campanha (ex.: mover lead de estágio ao abrir email).
- Integração com ferramentas externas de email marketing (Mailchimp, RD Station, SendGrid como ferramenta direta).
- A/B testing de subject ou conteúdo.
- Relatório consolidado entre múltiplas campanhas.
- Gerenciamento de listas de contatos fora do modelo de leads existente no CRM.

## Restrições

- **Rate limiting:** máximo de 100 emails/minuto por tenant; controle via BullMQ + rate limiter no job de envio.
- **Editor de blocos:** implementado com `@dnd-kit/core` (já instalado no projeto), sem dependências externas de editor de email.
- **Rastreamento:** rotas `GET /api/v1/track/campaign-open/:token` e `GET /api/v1/track/campaign-click/:token` devem ser registradas como públicas (`/api/public` e `/api/v1/public`) — sem autenticação, sem CSRF.
- **Segurança:** HTML do template deve ser sanitizado antes do envio para evitar XSS.
- **Multi-tenancy:** todas as queries Prisma de campanhas devem filtrar por `tenantId`.
- **LGPD:** leads com `unsubscribed = true` devem ser excluídos automaticamente de qualquer envio presente ou futuro, sem intervenção manual.
- **Schema:** adicionar campos `unsubscribed: Boolean @default(false)` e `unsubscribedAt: DateTime?` ao model `Lead` existente via migration Prisma.
- **Infraestrutura de jobs:** o envio em lote e o agendamento dependem de `ENABLE_AUTOMATION_ENGINE=true` e Redis configurado.

## Casos Extremos

- **Audiência vazia:** se o filtro de segmentação não retornar nenhum lead (após exclusão de descadastrados), o sistema deve bloquear o avanço no wizard e exibir mensagem informativa.
- **Merge tag sem dado:** se `{{lead.company}}` estiver vazia para um lead específico, o sistema deve substituir a tag por string vazia (não exibir a tag literal no email).
- **Envio simultâneo:** se a campanha já estiver com status `SENDING`, novas tentativas de disparo devem ser ignoradas ou rejeitadas.
- **Campanha agendada para o passado:** o sistema deve validar que o horário agendado é futuro; caso contrário, rejeitar com erro de validação.
- **Bounce em lead já descadastrado:** registrar o evento `BOUNCED` normalmente sem duplicar o estado `UNSUBSCRIBED`.
- **Token de rastreamento inexistente:** `GET /track/campaign-open/:token` com token inválido deve retornar a imagem 1×1 normalmente (silencioso), sem erro visível ao cliente de email.
- **Token de descadastro inexistente ou já usado:** `GET /track/unsubscribe/:token` deve retornar página de confirmação sem expor detalhes de erro ao usuário.
- **Falha no provedor de email (Resend/SMTP):** o job de envio deve registrar o erro no `CampaignRecipient`, incrementar contador de erros e não reprocessar o mesmo destinatário mais de 3 vezes.
- **Redis indisponível:** se BullMQ não estiver acessível, a tentativa de agendar ou enviar deve retornar erro 503 com mensagem clara ao usuário.

## Definição de Concluído

- [ ] A rota `/app/campaigns` exibe a listagem de campanhas com nome, status e métricas básicas para o tenant autenticado.
- [ ] O wizard "Nova Campanha" percorre os passos Nome → Remetente → Assunto → Editor → Audiência → Agendar sem erros de navegação.
- [ ] O editor de blocos permite adicionar, reordenar via drag-and-drop e remover blocos dos tipos Texto, Imagem, Botão, Divisor e Espaçador.
- [ ] Ao inserir `{{lead.name}}` no assunto e enviar a campanha, o email recebido exibe o nome real do lead no lugar da merge tag.
- [ ] O preview renderiza o HTML compilado do email antes do envio ser confirmado.
- [ ] O envio de email de teste entrega uma mensagem na caixa de entrada do usuário logado.
- [ ] A campanha salva transita entre os status DRAFT → SCHEDULED → SENDING → SENT conforme o fluxo de envio.
- [ ] O passo Audiência exibe "X leads selecionados" e 5 nomes de amostra ao configurar filtros válidos.
- [ ] Leads com `unsubscribed = true` não aparecem na contagem de audiência nem recebem o email.
- [ ] A opção "Agendar para" agenda o envio e a campanha permanece com status SCHEDULED até o horário configurado.
- [ ] Cada email enviado contém um pixel de rastreamento 1×1 com URL única por destinatário.
- [ ] Ao abrir o email (carregamento do pixel), um evento `OPENED` é registrado na tabela `CampaignEvent` para o lead correspondente.
- [ ] Ao clicar em um link rastreado, o usuário é redirecionado para a URL destino e um evento `CLICKED` é registrado.
- [ ] Ao acessar o link de descadastro, o campo `lead.unsubscribed` é setado para `true` e o lead não recebe campanhas futuras.
- [ ] A aba "Resultados" exibe corretamente as métricas: Enviados, Abertos, Cliques, Descadastros, Bounces e as taxas percentuais.
- [ ] A tabela de destinatários mostra nome, email, status e data de abertura para cada lead da campanha.
- [ ] O gráfico de aberturas por hora é exibido para as primeiras 48h após o envio.
- [ ] O botão "Exportar CSV" gera e baixa um arquivo com a lista de destinatários e eventos.
- [ ] As rotas `/api/v1/track/campaign-open/:token` e `/api/v1/track/campaign-click/:token` respondem sem autenticação (rotas públicas).
- [ ] O envio em lote respeita o limite de 100 emails/minuto por tenant sem erros de throttling.
