# Spec: API Hub (Integrações e API Pública)

## Objetivo

Tornar a API REST do VYD Engage visível e utilizável por desenvolvedores e times não-técnicos, completando três capacidades: documentação interativa gerada automaticamente, webhooks de saída configuráveis pelo usuário com retry e log, e API keys com escopos granulares de permissão. Uma quarta capacidade de Fase 2 adiciona um app nativo no Zapier usando os endpoints já existentes e um endpoint de polling dedicado.

## Usuários

- **Dev Integrador:** desenvolvedor interno ou parceiro que precisa integrar sistemas externos (ERP, e-commerce, suporte) com o VYD via API REST. Perfil técnico, espera documentação interativa com exemplos e try-it-out.
- **Admin Técnico:** administrador do tenant que configura webhooks de saída para notificar sistemas externos quando eventos ocorrem no CRM (ex.: deal fechado, novo lead). Perfil semi-técnico, opera pela UI de configurações.
- **Ops/RevOps:** usuário não-técnico que usa Zapier para conectar ferramentas sem escrever código. Não conhece a API diretamente; espera encontrar o VYD no Zapier e configurar via interface da plataforma.

## Requisitos

### Obrigatórios

**API-1.1 — Documentação Interativa da API**

1. O sistema deve servir uma interface Redoc no endpoint `GET /api/docs` com a spec OpenAPI 3.0 completa da API.
2. O sistema deve gerar a spec OpenAPI automaticamente a partir de anotações JSDoc nas rotas existentes, sem etapa manual de atualização.
3. A spec deve documentar autenticação por Bearer JWT e por API Key via header `X-API-Key`.
4. A spec deve cobrir todos os 28 grupos de rotas com exemplos de request e response.
5. O endpoint `GET /api/docs` deve suportar try-it-out funcional (requer CORS habilitado para essa rota).
6. A spec deve identificar a versão da API como `info.version: 1.0.0`.
7. O endpoint `/api/docs` deve estar desabilitado por padrão quando `NODE_ENV=production`; deve ser habilitado quando a variável de ambiente `ENABLE_API_DOCS=true` estiver definida.

**API-1.2 — Webhooks de Saída Configuráveis por Evento**

8. O sistema deve exibir a página `/app/settings/webhooks` com a lista de webhooks configurados, mostrando status ativo/inativo e resumo dos últimos disparos de cada um.
9. O sistema deve permitir ao usuário criar um webhook informando: URL de destino, lista de eventos a escutar e secret para assinatura HMAC.
10. Os eventos disponíveis para seleção na criação de webhook devem ser: `lead.created`, `lead.updated`, `lead.deleted`, `deal.created`, `deal.updated`, `deal.won`, `deal.lost`, `task.completed`, `automation.triggered`.
11. O payload enviado a cada webhook deve seguir o formato `{ event: string, tenantId: string, timestamp: string, data: {...} }`.
12. O sistema deve assinar cada requisição de webhook com HMAC-SHA256 e enviar a assinatura no header `X-VYD-Signature`.
13. O sistema deve realizar até 3 tentativas de entrega por disparo com backoff exponencial (1s → 5s → 25s) quando o destino não responder ou retornar erro.
14. O sistema deve registrar os últimos 100 disparos por webhook com: evento disparado, timestamp, código HTTP de resposta, duração em ms e indicador de sucesso/falha.
15. O sistema deve limitar cada tenant a no máximo 10 webhooks configurados (controle baseado em plan).
16. A falha na entrega de um webhook não deve bloquear nem atrasar o fluxo principal que disparou o evento (fire-and-forget via BullMQ).

**API-2.1 — Scopes e Permissões por API Key**

17. O sistema deve exibir seletor de scopes (checkboxes agrupados por recurso) ao criar uma nova API key.
18. Os scopes disponíveis devem ser: `leads:read`, `leads:write`, `deals:read`, `deals:write`, `tasks:read`, `tasks:write`, `contacts:read`, `reports:read`, `webhooks:manage`.
19. O sistema deve verificar o scope da API key em middleware antes de executar qualquer handler de rota autenticado por API key, bloqueando requisições sem o scope necessário.
20. API keys existentes criadas sem scope explícito devem manter acesso total para preservar compatibilidade retroativa.
21. A página `/app/settings/api-keys` deve exibir os scopes atribuídos a cada key existente.

**API-2.2 — Zapier App Nativo**

22. O sistema deve expor os seguintes triggers no Zapier: `New Lead`, `Lead Updated`, `Deal Won`, `Deal Lost`, `Task Completed`.
23. O sistema deve expor as seguintes actions no Zapier: `Create Lead`, `Update Lead`, `Create Deal`, `Create Task`, `Add Tag to Lead`.
24. A autenticação no Zapier deve usar API Key via header `X-API-Key`, sem OAuth no MVP.
25. O sistema deve disponibilizar o endpoint `GET /api/v1/zapier/triggers/lead-created` para suporte a polling mode do Zapier.
26. O projeto deve incluir documentação em `docs/integrations/zapier.md` explicando como conectar o VYD Engage ao Zapier.

### Fora do Escopo

- OAuth 2.0 para autenticação do Zapier (previsto para versão futura).
- Publicação do app Zapier como app pública na galeria oficial (pode ser publicado como app privada inicialmente).
- Suporte a outros conectores de automação (Make, n8n, etc.).
- Webhooks de entrada (já existem; não são modificados por este épico).
- Criação de novos endpoints de API além do endpoint de polling do Zapier.
- Retenção de logs de webhook além de 100 entradas por webhook / 30 dias.

## Restrições

- **Bibliotecas:** usar `swagger-jsdoc` e `redoc-express` (ambos licença MIT) para documentação.
- **Modelo de dados:** adicionar models `OutgoingWebhook` e `OutgoingWebhookLog` no schema Prisma conforme definido no PRD; adicionar campo `scopes String[]` no model `ApiKey`.
- **BullMQ:** o dispatch de webhooks deve usar BullMQ para enfileiramento e retry; requer Redis configurado (`REDIS_URL`) e `ENABLE_AUTOMATION_ENGINE=true`.
- **Rate limit:** API keys devem respeitar limite de 1000 req/min, configurável por plan.
- **Segurança de scopes:** checagem de scope deve ocorrer em middleware, antes de qualquer lógica de handler.
- **Retenção de logs:** logs de webhook devem ser paginados e retidos por no máximo 30 dias.
- **Atualização da spec:** a spec OpenAPI deve ser gerada a partir do código; atualizações nas rotas devem refletir automaticamente na documentação sem etapa manual.

## Casos Extremos

- **Destino de webhook offline:** o sistema deve tentar 3 vezes com backoff; após a terceira falha, registrar o erro no log e não tentar novamente até o próximo evento.
- **Secret de webhook vazio:** o sistema deve exigir que o campo `secret` seja preenchido na criação; não deve permitir webhook sem assinatura HMAC.
- **Scope inexistente enviado:** o middleware deve retornar erro 400 se a API key apresentar um scope não reconhecido no sistema.
- **Tenant atingiu limite de 10 webhooks:** o sistema deve retornar erro 422 ao tentar criar o 11º webhook, informando o limite atingido.
- **API key sem scope acessando rota protegida por scope:** deve ser permitido para keys legadas (backward compat); deve ser bloqueado apenas se a key tiver escopo definido e o escopo não cobrir a rota.
- **`ENABLE_API_DOCS` não configurado em produção:** `/api/docs` deve retornar 404; não deve expor a spec em produção por omissão.
- **Payload de evento com dados parciais:** o campo `data` deve enviar o objeto disponível; o sistema não deve bloquear o disparo por campos opcionais ausentes.
- **Redis indisponível com `ENABLE_AUTOMATION_ENGINE=true`:** o sistema deve logar o erro e falhar graciosamente; o fluxo principal (criar lead, atualizar deal) não deve ser interrompido.

## Definição de Concluído

- [ ] `GET /api/docs` retorna a interface Redoc com a spec OpenAPI 3.0 em ambientes de desenvolvimento e quando `ENABLE_API_DOCS=true`.
- [ ] `GET /api/docs` retorna 404 em `NODE_ENV=production` sem `ENABLE_API_DOCS=true`.
- [ ] A spec OpenAPI documenta os 28 grupos de rotas com exemplos visíveis na interface.
- [ ] Try-it-out na interface Redoc executa uma requisição real e exibe a resposta.
- [ ] A página `/app/settings/webhooks` lista webhooks do tenant com status e últimos disparos.
- [ ] É possível criar um webhook escolhendo URL, eventos e secret pela UI; o webhook aparece na lista após criação.
- [ ] Ao ocorrer um dos 9 eventos configurados, o sistema envia POST ao webhook com payload padrão e header `X-VYD-Signature`.
- [ ] Se o destino retornar erro, o sistema realiza até 3 tentativas com intervalos 1s, 5s, 25s.
- [ ] O log de disparos exibe código HTTP, duração e status de sucesso/falha para cada entrega.
- [ ] A tentativa de criar o 11º webhook retorna erro informando o limite do plano.
- [ ] A página `/app/settings/api-keys` exibe o campo de seleção de scopes ao criar nova key e lista os scopes das keys existentes.
- [ ] Uma requisição feita com API key com scope `leads:read` para um endpoint de escrita de leads retorna 403.
- [ ] API keys criadas antes da implementação de scopes continuam funcionando com acesso total.
- [ ] `GET /api/v1/zapier/triggers/lead-created` retorna lista de leads no formato esperado pelo Zapier.
- [ ] O arquivo `docs/integrations/zapier.md` existe e descreve o processo de conexão com o Zapier.
- [ ] Migrations Prisma para `OutgoingWebhook`, `OutgoingWebhookLog` e campo `scopes` em `ApiKey` estão aplicadas sem erros.
