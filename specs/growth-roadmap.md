# Spec: Growth Roadmap — VYD Engage

## Objetivo

Implementar quatro épicos sequenciais que eliminam os três bloqueadores de conversão e retenção identificados na fase pós-foundation do VYD Engage: (1) migração impossível de CRM anterior, (2) diferenciação competitiva fraca, e (3) ecossistema fechado que obriga o uso de ferramentas externas. O roadmap cobre Import Pro, AI Sales Assistant, Email Campaigns e API Hub, com duração estimada de 14 a 19 semanas.

## Usuários

Times de vendas e seus gestores que já usam o VYD Engage em produção (`engage.vydhub.com`), avaliadores que ainda não migraram do CRM anterior, e desenvolvedores/parceiros que precisam integrar sistemas externos. Nível técnico heterogêneo: usuários finais de vendas (não-técnicos) e desenvolvedores (técnicos).

## Requisitos

### Obrigatórios

1. O sistema deve permitir que um cliente complete a migração de dados de outro CRM em menos de 30 minutos (cobrindo o épico Import Pro, stories IMP-1.1, IMP-1.2, IMP-2.1, IMP-2.2).
2. O sistema deve exibir o contexto completo de um lead para o vendedor em até 10 segundos, com sugestão de próxima ação justificada pela IA (cobrindo o épico AI Sales Assistant, stories AI-1.1, AI-1.2, AI-2.1, AI-2.2).
3. O sistema deve permitir que o time de vendas crie, segmente e envie campanhas de e-mail diretamente do CRM, sem dependência de ferramenta externa (cobrindo o épico Email Campaigns, stories EC-1.1, EC-1.2, EC-2.1, EC-2.2).
4. O sistema deve permitir que desenvolvedores e parceiros completem uma integração com o VYD Engage em menos de 1 dia útil (cobrindo o épico API Hub, stories API-1.1, API-1.2, API-2.1, API-2.2).
5. Todo novo model de banco de dados deve incluir o campo `tenantId` e todas as queries devem filtrar por `tenantId`.
6. Toda nova rota autenticada deve ser adicionada à whitelist de CSRF em `server/src/index.ts:163-190`.
7. Rotas de alto custo computacional (import, AI) devem ter rate limiter dedicado separado do limiter geral.
8. Novos models onde aplicável devem incluir o campo `deletedAt DateTime?` para soft delete.
9. Novos models devem ter índices em `(tenantId, createdAt)` e `(tenantId, status)`.
10. Os testes (`npx vitest run`) e o build (`npm run build`) devem passar antes de cada commit em qualquer épico.
11. Os épicos devem ser implementados na sequência definida: Import Pro → AI Sales Assistant → Email Campaigns → API Hub.

### Fora do Escopo

- Implementação de integrações nativas além do Zapier (API Hub cobre apenas Zapier como integração nativa de terceiros).
- Funcionalidades de CRM não listadas nos quatro épicos do roadmap.
- Alteração de épicos, stories ou pontos já concluídos antes deste roadmap (TD, Comercial Pro, UX Power, Security).
- Infraestrutura de Redis/BullMQ para outros jobs além dos já existentes (`billing.ts`, `automationEngine.ts`).
- Campanhas de canais além de e-mail (SMS, push, WhatsApp) no épico Email Campaigns.

## Restrições

- **Sequência dos épicos:** Import Pro deve ser concluído antes de AI Sales Assistant; AI Sales Assistant antes de Email Campaigns; Email Campaigns antes de API Hub — conforme roadmap visual (jul/2026 a out/2026).
- **Dependências de infraestrutura:** EPIC-AI-SALES requer `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` e `AI_PROVIDER` configurados no ambiente; `aiDraftService.ts` e `nextActionService.ts` já existem e devem ser reaproveitados.
- **Dependências de código existente:** cada épico deve reaproveitar a base listada no PRD (e.g., `leadService.create`, `emailMessagingService.ts`, `outgoingWebhooks.ts`, `apiKeys.ts`) antes de criar novas abstrações.
- **Multi-tenancy não negociável:** nenhuma query em novo código pode omitir o filtro `tenantId`.
- **Ciclo total:** 14 a 19 semanas; execução paralela de épicos é permitida somente quando a dependência sequencial estiver satisfeita.
- **Ambiente de produção ativo:** o backend e o frontend estão em produção; nenhuma migração destrutiva pode ser aplicada sem rollback documentado.

## Casos Extremos

- **Import Pro:** arquivo enviado com colunas não mapeáveis deve ser rejeitado com mensagem de erro antes de persistir qualquer registro; importação parcialmente falha deve ser reversível via rollback.
- **AI Sales Assistant:** ausência de `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` no ambiente deve degradar graciosamente (feature oculta ou mensagem de configuração) sem derrubar outras rotas.
- **Email Campaigns:** tenant sem `EmailConfig` configurado não deve conseguir enviar campanhas; tentativa deve exibir instrução de configuração de SMTP.
- **API Hub — Zapier:** webhook de saída com endpoint inacessível deve registrar falha e não bloquear o fluxo principal do CRM.
- **Multi-tenancy:** qualquer query que não filtre por `tenantId` deve ser considerada falha de segurança e bloqueada em code review antes do merge.
- **Testes/build:** falha em `npx vitest run` ou `npm run build` bloqueia o commit; não há exceção.

## Definição de Concluído

- [ ] Import Pro (EPIC-IMPORT-PRO): todas as 4 stories (IMP-1.1, IMP-1.2, IMP-2.1, IMP-2.2) com status Done no arquivo de épico.
- [ ] AI Sales Assistant (EPIC-AI-SALES): todas as 4 stories (AI-1.1, AI-1.2, AI-2.1, AI-2.2) com status Done no arquivo de épico.
- [ ] Email Campaigns (EPIC-EMAIL-CAMPAIGNS): todas as 4 stories (EC-1.1, EC-1.2, EC-2.1, EC-2.2) com status Done no arquivo de épico.
- [ ] API Hub (EPIC-API-HUB): todas as 4 stories (API-1.1, API-1.2, API-2.1, API-2.2) com status Done no arquivo de épico.
- [ ] Métrica Import Pro: fluxo de onboarding com CSV de teste concluído em menos de 30 minutos em ambiente de staging.
- [ ] Métrica AI Sales: resumo contextual de lead exibido em menos de 10 segundos em ambiente de staging com chave de IA configurada.
- [ ] Métrica Email Campaigns: campanha criada, agendada e enviada para segmento de teste sem uso de ferramenta externa.
- [ ] Métrica API Hub: integração Zapier funcional documentada com pelo menos um Zap de exemplo publicado.
- [ ] Todos os novos models verificados com `tenantId` presente e indexado.
- [ ] Todas as novas rotas autenticadas presentes na whitelist de CSRF.
- [ ] `npx vitest run` e `npm run build` passando no estado final de cada épico.
- [ ] Tabela "Controle de Progresso" no PRD (`docs/prd/prd-growth-roadmap.md`) atualizada com status e commit de conclusão de cada épico.
