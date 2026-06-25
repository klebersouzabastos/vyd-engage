# Spec: AI Sales Assistant

## Objetivo

Transformar os sinais isolados de scoring e sugestão de próxima ação do VYD Engage em uma experiência de assistente integrada: ao abrir um lead, o vendedor obtém em segundos o contexto completo e a orientação exata de qual ação tomar, eliminando a necessidade de rolar histórico manualmente. O assistente cobre quatro capacidades — resumo contextual, sugestão com justificativa, score de propensão de fechamento por deal e chat em linguagem natural — servindo vendedores, SDRs/BDRs e gestores comerciais.

## Usuários

- **Vendedor Experiente** — 40+ leads ativos, usa o CRM diariamente; tem dificuldade de retomar contexto sem reler todo o histórico.
- **SDR/BDR** — alto volume de leads, foco em abertura; precisa priorizar leads com base em dados, não em intuição.
- **Gestor Comercial** — supervisiona pipeline e forecast; quer identificar quais deals vão fechar sem acionar cada vendedor individualmente.

## Requisitos

### Obrigatórios

#### AI-1.1 — Resumo Contextual do Lead

1. O sistema deve exibir um card "Resumo IA" no topo da página de detalhe do lead (`LeadDetail`), colapsável, aberto por padrão.
2. O sistema deve gerar o resumo com base nas últimas 10 interações do lead, nos deals ativos, nas tarefas pendentes e no score atual.
3. O resumo deve incluir: data e descrição da última interação, situação dos deals abertos, próxima tarefa pendente, score atual e tendência.
4. O sistema deve gerar o conteúdo do resumo de forma lazy — somente quando o card for expandido, sem bloquear o carregamento da página.
5. O sistema deve armazenar em cache o resumo por 30 minutos por lead (Redis ou localStorage com timestamp), evitando chamadas redundantes à IA.
6. O sistema deve disponibilizar um botão "Atualizar" no card que invalida o cache e força a geração de um novo resumo.
7. O card deve exibir um badge "IA" indicando que o conteúdo foi gerado por inteligência artificial.
8. O backend deve expor o endpoint `GET /api/v1/leads/:id/ai-summary` que agrega os dados do lead e chama o serviço de IA com prompt especializado, utilizando `AI_PROVIDER` e `AI_API_KEY` configurados no `.env`.
9. O frontend deve implementar o card no componente `src/components/leads/AISummaryCard.tsx`, com lazy load via Intersection Observer ou clique para expandir.

#### AI-1.2 — Sugestão de Próxima Ação com Justificativa

10. O sistema deve estender o `nextActionService.ts` existente para retornar, além da ação sugerida, um campo `reasoning` com 1 a 2 frases de justificativa contextualizada.
11. O sistema deve exibir a sugestão de próxima ação e sua justificativa tanto na página de detalhe do lead quanto no card do lead na listagem (tooltip ou badge expandível).
12. As ações possíveis retornadas pelo serviço devem ser: `CALL`, `EMAIL`, `WHATSAPP`, `MEETING`, `FOLLOW_UP`, `DEMO`, `PROPOSAL`, `CLOSE`.
13. A justificativa deve referenciar dados reais do lead, por exemplo: "Última interação há 7 dias (email sem resposta). Recomendo ligação direta."
14. O sistema deve recalcular automaticamente a sugestão de próxima ação após o registro de uma nova interação no lead.
15. O backend deve expor o endpoint `GET /api/v1/leads/:id/next-action` retornando o retorno estendido do `nextActionService` com o campo `reasoning: string`.
16. O frontend deve implementar o componente `src/components/leads/NextActionBadge.tsx` exibindo ícone da ação e tooltip com a justificativa.

#### AI-2.1 — Score de Propensão de Fechamento por Deal

17. O sistema deve calcular um score de propensão de fechamento de 0 a 100% por deal, gerado por IA com base em: tempo no stage atual, número de interações, data do último contato, valor do deal e histórico de win rate do responsável.
18. O sistema deve exibir o score em `DealDetail` e no card do deal no kanban do pipeline (gauge circular pequeno).
19. O sistema deve classificar o score visualmente em três faixas: vermelho para score < 30%, amarelo para score entre 30% e 70%, verde para score > 70%.
20. O sistema deve exibir, ao passar o cursor ou clicar no score, os 3 fatores principais que influenciam o valor calculado.
21. O sistema deve recalcular o score semanalmente via job BullMQ (`scoreDeals.ts`) e também permitir recálculo sob demanda.
22. O backend deve expor o endpoint `GET /api/v1/deals/:id/ai-score` que agrega as métricas do deal, chama o provedor de IA e armazena o resultado nos campos `Deal.aiScore Float?`, `Deal.aiScoreUpdatedAt DateTime?` e `Deal.aiScoreFactors Json?` (migração Prisma necessária).
23. O frontend deve implementar o componente `src/components/deals/DealAIScore.tsx` com gauge e tooltip de fatores.

#### AI-2.2 — Chat Contextual no Lead

24. O sistema deve exibir um painel lateral "Chat IA" na página de detalhe do lead, com campo de entrada de pergunta e área de exibição de resposta em streaming.
25. O chat deve responder com base no histórico real do lead — interações, deals e tarefas — sem inventar informações; as respostas devem referenciar dados concretos, por exemplo: "Última ligação em 2026-06-15, anotação: 'interessado, pedir proposta'".
26. O sistema deve suportar perguntas em linguagem natural como: "Quando foi o último contato?", "Qual é o status do deal?", "Quais são as objeções do lead?".
27. O histórico da conversa deve ser mantido em `sessionStorage` (não persiste entre sessões).
28. O painel deve exibir indicação clara de que as respostas são geradas por IA e podem conter erros.
29. O sistema deve transmitir a resposta via streaming (tokens progressivos) para melhor experiência do usuário.
30. O backend deve expor o endpoint `POST /api/v1/leads/:id/ai-chat` recebendo `{ message: string, history: ChatMessage[] }`, agregando o contexto do lead e usando `streamText` do Vercel AI SDK.
31. O frontend deve implementar o componente `src/components/leads/AIChatPanel.tsx` com input e área de stream, usando `useChat` hook do Vercel AI SDK ou fetch manual com `ReadableStream`.

#### Requisitos Transversais

32. O sistema deve aplicar rate limit de 30 chamadas de IA por minuto por tenant para controle de custos.
33. O sistema deve esconder todos os cards e funcionalidades de IA quando `AI_PROVIDER` não estiver configurado no `.env`, exibindo mensagem de orientação de setup no lugar.
34. O sistema deve registrar metadados de cada chamada de IA (tokens consumidos, latência, `lead_id`) para análise futura de billing, sem logar o conteúdo das respostas.
35. O tempo de resposta dos endpoints de resumo e score deve ser inferior a 3 segundos no percentil 95 (p95).
36. O sistema nunca deve logar o conteúdo das respostas geradas pela IA — somente metadados: tokens, latência, `lead_id`.

### Fora do Escopo

- Persistência do histórico de chat entre sessões (armazenamento no banco de dados).
- Interface de configuração de provedor de IA dentro do próprio CRM (feita via variáveis de ambiente).
- Treinamento ou fine-tuning de modelos com dados do tenant.
- Exportação ou compartilhamento de resumos e chats gerados pela IA.
- Análise de sentimento ou classificação automática de leads por IA além das features descritas.
- Billing por consumo de IA diretamente visível ao usuário final nesta versão.

## Restrições

- O provedor de IA é configurado por variável de ambiente (`AI_PROVIDER` e `AI_API_KEY`); o sistema não deve embutir chaves no código.
- A migração Prisma para os campos `aiScore`, `aiScoreUpdatedAt` e `aiScoreFactors` no modelo `Deal` é obrigatória antes de qualquer deploy da Story AI-2.1.
- O job de recálculo de score (`scoreDeals.ts`) requer BullMQ e Redis configurados; deve ser gateado pela variável `ENABLE_AUTOMATION_ENGINE`.
- O endpoint de chat deve usar `streamText` do Vercel AI SDK (ou equivalente com `ReadableStream`) para suportar streaming de tokens.
- O cache do resumo (AI-1.1) deve ser invalidado no máximo a cada 30 minutos por lead; o botão "Atualizar" deve respeitar esse limite ou permitir forçar a invalidação explicitamente.
- Todo o código deve seguir os padrões existentes: middleware `tenantMiddleware` com `tenantId` em todas as queries Prisma, resposta no formato `{ status, data }` / `{ status, error }`.
- A latência máxima aceitável é de 3 segundos no p95 para resumo e score; o chat pode ser mais lento por ser streaming.

## Casos Extremos

- **Lead sem histórico:** o resumo deve ser gerado mesmo com zero interações, retornando texto indicando ausência de histórico em vez de falhar.
- **Lead com mais de 10 interações:** somente as 10 mais recentes são enviadas ao modelo; as anteriores são descartadas.
- **`AI_PROVIDER` não configurado:** todos os componentes de IA devem ocultar-se e exibir mensagem de setup; nenhuma chamada ao backend deve ser feita.
- **Timeout ou erro do provedor de IA:** o endpoint deve retornar erro HTTP 503 com mensagem amigável; o frontend deve exibir estado de erro no card/painel sem travar a página.
- **Rate limit de tenant atingido (30 chamadas/min):** o backend deve retornar HTTP 429; o frontend deve exibir mensagem informando que o limite foi atingido e sugerir tentar novamente em instantes.
- **Score recalculado durante visualização:** o frontend deve exibir o valor armazenado mais recente até a próxima atualização explícita; não há atualização automática em tempo real no cliente.
- **Chat com histórico de sessão muito longo:** o frontend deve truncar `history` enviado ao backend para evitar payloads excessivos; o limite exato deve seguir o máximo de tokens do modelo utilizado.
- **Deal sem interações ou com responsável sem histórico de win rate:** o score deve ser calculado mesmo com dados ausentes; os fatores com dados insuficientes devem ser sinalizados na explicação como "dados insuficientes".
- **Perda de conexão durante streaming de chat:** o frontend deve exibir a parte da resposta já recebida e indicar que a transmissão foi interrompida, sem perder o histórico de sessão já exibido.

## Definição de Concluído

- [ ] Card "Resumo IA" é exibido no topo de `LeadDetail`, colapsável, com badge "IA" e botão "Atualizar" visíveis.
- [ ] O resumo é gerado somente ao expandir o card (lazy), não bloqueia o carregamento da página.
- [ ] O resumo exibe última interação, situação dos deals, próxima tarefa pendente e score com tendência.
- [ ] O cache de 30 minutos por lead funciona: segunda abertura do card dentro do período não dispara nova chamada à IA.
- [ ] O botão "Atualizar" força novo resumo mesmo dentro do período de cache.
- [ ] Badge de próxima ação com justificativa é visível em `LeadDetail` e no card da listagem de leads.
- [ ] A justificativa referencia dados reais do lead (data de interação, canal, etc.).
- [ ] A sugestão de próxima ação é recalculada automaticamente após registro de nova interação.
- [ ] Score de propensão de fechamento (0-100%) é exibido em `DealDetail` e no card do kanban com cor correta (vermelho/amarelo/verde).
- [ ] Hover/click no score exibe os 3 fatores principais que influenciam o valor.
- [ ] Job BullMQ `scoreDeals.ts` recalcula scores em batch semanalmente (verificável via log ou execução manual).
- [ ] Migração Prisma com os campos `aiScore`, `aiScoreUpdatedAt` e `aiScoreFactors` em `Deal` foi aplicada com sucesso.
- [ ] Painel "Chat IA" em `LeadDetail` aceita perguntas e exibe respostas em streaming (tokens progressivos visíveis).
- [ ] Respostas do chat referenciam dados reais do lead e exibem aviso de que são geradas por IA.
- [ ] Histórico do chat persiste durante a sessão (sessionStorage) e é limpo ao fechar/recarregar a aba.
- [ ] Com `AI_PROVIDER` ausente no `.env`, todos os componentes de IA ficam ocultos e exibem mensagem de setup.
- [ ] Rate limit de 30 chamadas/min por tenant retorna HTTP 429 e o frontend exibe mensagem adequada.
- [ ] Metadados de uso de IA (tokens, latência, lead_id) são registrados em log sem incluir conteúdo das respostas.
- [ ] Endpoints de resumo e score respondem em menos de 3 segundos (p95) em ambiente de staging com dados reais.
- [ ] Todos os endpoints passam pela middleware `tenantMiddleware` e filtram dados por `tenantId`.
