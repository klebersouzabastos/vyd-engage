# Spec: Filtro Avançado de Leads

## Objetivo

Painel de filtros avançados na listagem de leads do VYD Engage que permite combinar filtros por tags, por status e por data de criação. Resolve o problema atual em que o time de vendas precisa rolar manualmente a lista inteira para encontrar leads de uma campanha ou etapa específica — hoje só existe busca por nome. O valor central é combinar os três filtros simultaneamente (ex.: tag "campanha-junho" + status "Em Negociação" + criados nos últimos 30 dias) de forma rápida e sem necessidade de treinamento.

## Usuários

SDRs e closers que usam o CRM diariamente. Não são técnicos — precisam de uma interface intuitiva que funcione sem treinamento. Gestores de vendas são usuários secundários com frequência de uso menor.

## Requisitos

### Obrigatórios

1. O sistema deve exibir um painel de filtros acessível a partir da listagem de leads, contendo as seções Tags, Status e Data de Criação.
2. O sistema deve permitir que o usuário selecione múltiplas tags ao mesmo tempo; a lógica de combinação entre as tags selecionadas é OR (leads que possuem qualquer uma das tags escolhidas).
3. O sistema deve permitir que o usuário selecione múltiplos status ao mesmo tempo; a lógica de combinação entre os status selecionados é OR.
4. Os status disponíveis para seleção são: Novo, Contatado, Em Negociação, Qualificado, Descartado, Convertido.
5. O sistema deve oferecer atalhos de período pré-definidos para o filtro de data de criação: Hoje, Últimos 7 dias, Últimos 30 dias, Este mês.
6. O sistema deve oferecer um seletor de intervalo personalizado (data início + data fim) para o filtro de data de criação, além dos atalhos pré-definidos.
7. Quando múltiplos filtros estiverem ativos ao mesmo tempo (ex.: tags + status + data), o sistema deve aplicar AND entre eles — o lead deve satisfazer todos os filtros ativos simultaneamente.
8. O sistema deve exibir um contador em tempo real (ex.: "Exibindo 47 leads") que se atualiza à medida que o usuário seleciona ou desseleciona filtros.
9. O sistema deve retornar os resultados filtrados em no máximo 2 segundos para tenants com até 5.000 leads.
10. O sistema deve exibir um estado vazio com a mensagem "Nenhum lead encontrado para esses filtros" e um botão "Limpar filtros" quando nenhum lead corresponder aos filtros aplicados.
11. O sistema deve exibir o dropdown de tags desabilitado com um tooltip "Nenhuma tag cadastrada" quando o tenant não possuir tags.
12. O sistema deve restaurar a listagem completa de leads quando o usuário clicar em "Limpar filtros".

### Fora do Escopo

- Filtrar por campos customizados.
- Filtrar por responsável/dono do lead.
- Filtrar por score do lead.
- Salvar filtros como views favoritas/persistentes.
- Exportar a lista de resultados filtrados.
- Lógica AND entre tags selecionadas (toggle OR/AND) — fica para versão futura.

## Restrições

- **Multi-tenancy:** Todos os filtros devem operar exclusivamente sobre os leads do `tenantId` autenticado — nenhuma query pode vazar dados entre tenants.
- **Performance:** A query de filtragem deve retornar em ≤ 2s para tenants com até 5.000 leads em condições normais de uso. Índices de banco de dados devem cobrir os campos `tenantId`, `status`, `createdAt` e a relação com tags.
- **Stack:** React 18 + TypeScript no frontend; Node.js + Express + Prisma no backend. Filtros enviados como query params via `GET /api/v1/leads`.
- **Sem redesign:** O componente deve se integrar à listagem de leads existente sem alterar a estrutura geral da página.

## Casos Extremos

- **Nenhum resultado:** Exibir estado vazio com mensagem e botão de reset — não exibir erro.
- **Tenant sem tags:** Dropdown de tags desabilitado com tooltip explicativo; os demais filtros continuam funcionando normalmente.
- **Intervalo de datas inválido:** Se o usuário definir data fim anterior à data início, o sistema deve exibir uma mensagem de validação inline e impedir a consulta.
- **Filtro sem seleção ativa:** Se nenhum filtro estiver ativo, o sistema exibe a lista completa de leads sem nenhuma query de filtragem extra.
- **Lentidão de rede:** Se a requisição demorar mais de 2s, o sistema deve exibir um indicador de carregamento (spinner/skeleton) e não travar a interface. Caso ocorra timeout, exibir mensagem de erro com opção de tentar novamente.
- **Muitas tags:** O dropdown de tags deve ser pesquisável (input de busca interno) quando o tenant possuir mais de 20 tags.

## Definição de Concluído

- [ ] O usuário consegue selecionar 2 ou mais tags e a lista exibe apenas leads que possuem qualquer uma dessas tags (OR).
- [ ] O usuário consegue selecionar 2 ou mais status e a lista exibe leads em qualquer um desses status (OR).
- [ ] O usuário consegue escolher "Últimos 30 dias" e ver apenas leads criados nesse período.
- [ ] O usuário consegue definir uma data início e data fim personalizadas e ver apenas leads criados nesse intervalo.
- [ ] Com os três filtros ativos simultaneamente, a lista exibe apenas leads que satisfazem as três condições (AND entre filtros).
- [ ] O contador "Exibindo N leads" atualiza em tempo real a cada mudança de filtro.
- [ ] Com um tenant contendo 5.000 leads, a lista filtrada aparece em menos de 2 segundos.
- [ ] Ao clicar em "Limpar filtros", a lista retorna ao estado original com todos os leads.
- [ ] Quando nenhum lead corresponde, o estado vazio é exibido com mensagem e botão de reset — sem mensagem de erro.
- [ ] Quando o tenant não possui tags, o dropdown de tags aparece desabilitado com tooltip "Nenhuma tag cadastrada".
- [ ] A filtragem nunca retorna leads de outro tenant.
