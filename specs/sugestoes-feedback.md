# Spec: Sugestões (caixa de feedback in-app)

## Objetivo
Permitir que qualquer usuário autenticado do VYD Engage envie, de qualquer página, uma **sugestão de melhoria ou relato de bug** — com a rota atual pré-preenchida — e acompanhe o andamento das suas próprias sugestões. O **platform admin** recebe uma notificação in-app a cada nova sugestão e tria todas elas (de todos os tenants) numa página de gestão com workflow de status e resposta ao autor. É um canal de feedback do produto: captura dor/pedidos dos usuários e dá um backlog priorizável ao dono do produto. Esta é uma **re-implementação limpa contra o `main` atual**, fiel ao design da branch de referência `claude/demand-…-implementar-feature-de-sugesto` (commit `ac5b94a`), com três adaptações deliberadas marcadas abaixo.

## Usuários
- **Usuário comum** (qualquer papel autenticado, qualquer tenant): envia sugestões e acompanha as suas. Nível técnico variável (time comercial da K2). Contexto: usa o CRM no dia a dia e quer reportar algo sem sair da página.
- **Platform admin** (`isPlatformAdmin = true`, ex.: `kleber.bastos.1984@gmail.com`): tria e responde sugestões de **todos os tenants** (visão de product owner). É o único que muda status e escreve resposta.

> **Adaptações vs. referência (commit `ac5b94a`)** — a referência usava o papel **ADMIN do tenant** e isolava a gestão por `tenantId`. Nesta versão:
> 1. **Triagem é do platform admin, cross-tenant** (gating por `isPlatformAdmin`, não por `role === 'ADMIN'`); a listagem de gestão atravessa tenants.
> 2. **Notificação in-app** ao platform admin a cada nova sugestão (não existia na referência).
> 3. O resto (modelo, limites, UX, textos, workflow de status) é mantido fiel.

## Requisitos

### Obrigatórios

#### A. Modelo de dados e migration
1. O sistema deve ter um modelo Prisma **`Suggestion`** com os campos: `id` (UUID, PK, `@default(uuid())`), `tenantId` (FK → `Tenant.id`, `onDelete: Cascade`), `userId` (FK → `User.id`, `onDelete: Cascade`, relation `"SuggestionAuthor"`), `title` (String), `description` (String), `route` (String?, nullable), `type` (`SuggestionType`, `@default(IMPROVEMENT)`), `status` (`SuggestionStatus`, `@default(PENDING)`), `adminNotes` (String?, nullable), `createdAt` (DateTime `@default(now())`), `updatedAt` (DateTime `@updatedAt`), `resolvedAt` (DateTime?, nullable).
2. O sistema deve definir o enum **`SuggestionType`** com `IMPROVEMENT` (padrão) e `BUG`.
3. O sistema deve definir o enum **`SuggestionStatus`** com `PENDING` (padrão), `IN_REVIEW`, `IN_PROGRESS`, `DONE`, `REJECTED`.
4. O sistema deve criar os índices `@@index([tenantId])`, `@@index([tenantId, status])`, `@@index([tenantId, userId])`, `@@index([tenantId, createdAt])`.
5. O sistema deve adicionar as relações inversas `User.suggestions[]` (relation `"SuggestionAuthor"`) e `Tenant.suggestions[]`.
6. O sistema deve incluir uma migration aditiva (`prisma migrate`) que cria os dois enums e a tabela com índices e FKs, sem alterar tabelas existentes além de adicionar as relações.

#### B. Backend — serviço e regras de negócio (`suggestionService`)
7. O sistema deve criar uma sugestão atribuindo `tenantId` e `userId` a partir do contexto autenticado (`req.tenantId` / `req.user.userId`) — **nunca** do corpo da requisição —, com `type` default `IMPROVEMENT`, `status` `PENDING`, `route` `null` se ausente.
8. O sistema deve listar sugestões com filtros opcionais `status`, `type` e `scope`, ordenadas por `createdAt` **descendente**, incluindo o autor `{ id, name, email }` (sem campos sensíveis).
9. Para **usuário comum**, a listagem deve retornar **apenas as próprias** sugestões (`userId = req.user.userId`), independentemente de `scope` enviado.
10. Para **platform admin**, a listagem deve retornar **todas as sugestões de todos os tenants** quando `scope = 'all'` (padrão do admin), ou **apenas as próprias** quando `scope = 'mine'`. *(Adaptação: cross-tenant; não filtra por `tenantId`.)*
11. O sistema deve buscar uma sugestão por `id`; usuário comum só acessa a própria (caso contrário **404 mascarado** com code `SUGGESTION_NOT_FOUND`); platform admin acessa qualquer uma.
12. O sistema deve permitir **atualizar `status` e/ou `adminNotes`** somente para **platform admin**; os campos `title`, `description`, `type`, `route` são **imutáveis** após criação.
13. O sistema deve **setar `resolvedAt`** com o timestamp atual ao transicionar o status de um estado não-terminal para `DONE` ou `REJECTED`, e **limpar `resolvedAt`** (null) ao transicionar de um estado terminal (`DONE`/`REJECTED`) para um não-terminal. Permanecer em estado terminal não altera `resolvedAt`.
14. O sistema deve permitir **deletar**: usuário comum apenas a **própria** sugestão **e** apenas se `status === 'PENDING'`; platform admin qualquer sugestão em qualquer status.
15. Ao tentar deletar sugestão de outro usuário (comum), o sistema deve retornar **404 mascarado**; ao tentar deletar a própria sugestão não-`PENDING` (comum), deve retornar **400** com code `SUGGESTION_NOT_DELETABLE` e mensagem `"Only pending suggestions can be deleted by their author"`.

#### C. Backend — rotas REST (`/api/v1/suggestions`)
16. O sistema deve expor: `GET /api/v1/suggestions` (lista, query `status`/`type`/`scope`), `GET /api/v1/suggestions/:id` (detalhe), `POST /api/v1/suggestions` (criar → **201**), `PATCH /api/v1/suggestions/:id` (atualizar status/adminNotes — platform admin), `DELETE /api/v1/suggestions/:id` (deletar). *(A referência usava `PUT`; manter `PUT` ou `PATCH` é aceitável, desde que o frontend acompanhe.)*
17. Todas as rotas devem aplicar, na ordem: `authenticate` → `tenantMiddleware` → `apiLimiter`, e a rota deve ser registrada na **whitelist de CSRF** em `server/src/index.ts` (`v1Router.use('/suggestions', csrfProtection)`), montada em `/api/v1` e no alias `/api`.
18. O `POST` deve validar via **Zod**: `title` string `min(3).max(200)`, `description` string `min(5).max(5000)`, `type` enum `['IMPROVEMENT','BUG']` (obrigatório), `route` string `max(500)` opcional+nullable.
19. O update deve validar via Zod: `status` enum dos 5 valores (opcional), `adminNotes` string `max(5000)` nullable+opcional; e exigir que o solicitante seja **platform admin** (caso contrário **403**).
20. O `GET` (lista) deve validar via Zod a query: `status` enum (opcional), `type` enum (opcional), `scope` enum `['mine','all']` (opcional).
21. As respostas devem seguir o formato do projeto: sucesso `{ status: <http>, data: <obj|array> }`; erro de validação `400` `{ error, code: 'VALIDATION_ERROR', details }`; sem autenticação `401`. `DELETE` deve responder `{ status: 200, data: { deleted: true } }`.

#### D. Notificação in-app (adaptação)
22. Ao criar uma sugestão com sucesso, o sistema deve gerar uma **`Notification` in-app para cada usuário com `isPlatformAdmin = true`**, contendo ao menos: tipo/categoria de "nova sugestão", título da sugestão, tipo (`IMPROVEMENT`/`BUG`), nome do autor e a `route` (se houver), usando o modelo `Notification` e o serviço de notificações já existentes.
23. A falha em gerar a notificação **não** deve impedir a criação da sugestão (a criação é a operação primária; a notificação é best-effort e não derruba o request).

#### E. Frontend — envio (FAB + Dialog)
24. O sistema deve renderizar um **FAB** (botão flutuante) fixo no canto inferior direito, montado **globalmente em `AppLayout`** (dentro de `RequireAuth`, fora do `<main>`), `z-index 40`, ícone `MessageSquarePlus`, texto "Sugestão" (oculto em mobile), `aria-label`/`title` "Enviar sugestão". O clique abre o `SuggestionDialog`.
25. O `SuggestionDialog` deve ter título "Enviar sugestão" e descrição "Descreva uma melhoria ou problema. A equipe revisa todas as sugestões enviadas.", e conter: seletor de **Tipo** com dois botões exclusivos — "Melhoria" (ícone `Lightbulb`, valor `IMPROVEMENT`, padrão) e "Correção" (ícone `Bug`, valor `BUG`); campo **Título** (placeholder "Resumo da sugestão", `maxLength 200`); campo **Rota afetada** (placeholder "/app/leads", help "Pré-preenchida com a página atual. Edite se a sugestão for para outra área.", `maxLength 500`); campo **Descrição** (textarea `rows=5`, placeholder "Detalhe o que gostaria de ver melhorado ou o problema encontrado", `maxLength 5000`).
26. O campo Rota deve ser **pré-preenchido ao abrir o dialog** com `location.pathname + location.search` (via React Router `useLocation`), editável; o valor é um snapshot no momento da abertura (não reativo). Ao fechar sem enviar, os campos resetam (`type=IMPROVEMENT`, demais vazios).
27. O envio deve trimar os campos, validar no cliente **título ≥ 3** (toast "O título precisa ter pelo menos 3 caracteres") e **descrição ≥ 5** (toast "A descrição precisa ter pelo menos 5 caracteres"), enviar `route = null` se vazio após trim, e chamar `POST /api/v1/suggestions`. Durante o envio, mostrar "Enviando…" (ícone `Loader2`) e desabilitar Cancelar/Enviar (previne duplo envio).
28. Em sucesso, exibir toast "Sugestão enviada — obrigado pelo feedback!", fechar o dialog, resetar campos e chamar `onCreated()` se fornecido. Em erro, exibir toast com a mensagem da API (fallback "Erro ao enviar sugestão") **sem** fechar o dialog.

#### F. Frontend — página de listagem/gestão (`/app/suggestions`)
29. O sistema deve registrar a rota `/app/suggestions` (lazy via `lazyNamed`, sob `RequireAuth` + `ErrorBoundary` + `Suspense`) e um item de menu na **Sidebar** ("Sugestões", ícone `MessageSquarePlus`, `tourId` `sidebar-suggestions`), **visível a todos** os usuários autenticados.
30. O cabeçalho deve mostrar título "Sugestões" e subtítulo dependente do papel: platform admin → "Gerencie as sugestões enviadas pelos usuários"; usuário comum → "Acompanhe as sugestões que você enviou".
31. A toolbar deve ter: (apenas platform admin) botões de escopo "Todas" (padrão) e "Minhas"; dropdown "Filtrar por status" (opções: "Todos os status", "Pendentes", "Em análise", "Em andamento", "Concluídas", "Recusadas"); dropdown "Filtrar por tipo" ("Todos os tipos", "Melhoria", "Correção"); botão "Nova sugestão" (ícone `Plus`) que abre o `SuggestionDialog` com `onCreated` = refetch. Filtros com valor "ALL" são enviados como `undefined` à API.
32. **Apenas para platform admin com `scope='all'`**, exibir um grid de contagem por status (5 cards: label + total), responsivo (`grid-cols-2` mobile / `sm:grid-cols-5` desktop).
33. O escopo deve iniciar `all` para platform admin e ser **fixo em `mine`** (e enviado à API) para usuário comum.
34. Cada sugestão deve ser um card exibindo: título; **badge de tipo** ("Melhoria" âmbar com `Lightbulb` / "Correção" vermelho com `Bug`); **badge de status** com label e cor (`Pendente`=cinza, `Em análise`=azul, `Em andamento`=âmbar, `Concluída`=verde, `Recusada`=vermelho); descrição (`whitespace-pre-line`); se `route`: linha "Rota: <code>"; se `adminNotes`: caixa azul "Resposta da equipe:" com o conteúdo (`whitespace-pre-line`); rodapé "Enviada por <nome em bold>" (fallback "Usuário"), data `pt-BR` (`DD/MM/YYYY HH:mm`) e, se `resolvedAt`, " · Resolvida em <data>".
35. Cada card deve mostrar: (platform admin) botão "Gerenciar" (`Pencil`) que abre o dialog de gestão; e botão de excluir (`Trash2`, vermelho) **se `canDelete`** — onde `canDelete = isPlatformAdmin || (suggestion.userId === user.id && suggestion.status === 'PENDING')`.
36. O dialog "Gerenciar sugestão" (platform admin) deve exibir título/autor/data da sugestão, dropdown "Status" (5 valores) iniciado no status atual, textarea "Resposta para o usuário (opcional)" (`maxLength 5000`, placeholder "Comentário visível ao autor da sugestão") iniciado em `adminNotes || ''`, e botões "Cancelar" / "Salvar". Salvar chama `updateSuggestion(id, { status, adminNotes: text.trim() || null })`, toast "Sugestão atualizada", fecha e refaz a busca.
37. O excluir deve abrir um `AlertDialog` (título "Remover sugestão", descrição "Tem certeza que deseja remover esta sugestão? Esta ação não pode ser desfeita.", botões "Cancelar" / "Remover" vermelho); confirmar chama `deleteSuggestion(id)`, toast "Sugestão removida", fecha e refaz a busca.
38. A página deve mostrar `PageSkeleton type='cards'` durante o carregamento, e um `EmptyState` (ícone `MessageSquare`, botão "Nova sugestão") quando vazio — descrição "Ainda não há sugestões nesta organização." (admin+all) ou "Você ainda não enviou nenhuma sugestão. Envie uma agora!" (demais). Erros exibem toast ("Erro ao carregar sugestões" / "Erro ao atualizar sugestão" / "Erro ao remover sugestão").
39. A gestão (botões "Gerenciar", grid de contagem, toggle de escopo, status/adminNotes) deve ser **gated por `user.isPlatformAdmin`** no frontend (não por `role === 'ADMIN'`). *(Adaptação.)*

#### G. Client de API
40. O `ApiClient` deve expor: `getSuggestions(filters?: { status?, type?, scope?: 'mine'|'all' })`, `getSuggestion(id)`, `createSuggestion({ title, description, route?, type })`, `updateSuggestion(id, { status?, adminNotes? })`, `deleteSuggestion(id)` — todos retornando `{ status, data }` e usando o fluxo padrão do client (cookies + token CSRF via header em métodos não-GET, refresh automático em 401).

### Fora do Escopo
- Edição de `title`/`description`/`type`/`route` após criação (imutáveis por design).
- Anexos/screenshots na sugestão; categorias além de `IMPROVEMENT`/`BUG`.
- Notificação por **e-mail** (apenas in-app nesta versão).
- Soft delete (`deletedAt`) — a exclusão é hard delete.
- Gestão por **admin de tenant** (substituída por platform admin global); painel por-tenant para donos de outros tenants.
- Votação/priorização/comentários em thread nas sugestões.
- Re-aproveitar (rebase) os 143 commits da branch de referência — ela serve **apenas como referência de design**.

## Restrições
- **Stack:** Prisma (PostgreSQL) + Express + Zod no backend; React 18 + shadcn/ui + sonner (toasts) + TanStack/`apiClient` no frontend. Seguir os padrões do repo (services em `server/src/services`, rota em `server/src/routes/suggestions.ts`, montagem em `index.ts`).
- **Multi-tenant:** `Suggestion` carrega `tenantId` (origem) e `userId`, sempre derivados do contexto autenticado. A listagem do platform admin é a **única** consulta cross-tenant; todas as demais respeitam o dono.
- **Gating de platform admin:** usar o flag `isPlatformAdmin` do usuário, pelo **mesmo mecanismo já usado** pelas rotas/telas de plataforma existentes (`getPlatformOverview`/`PlatformAdmin.tsx`). Atenção: o `TokenPayload` do JWT (`server/src/utils/jwt.ts`) **não** inclui `isPlatformAdmin` — resolvê-lo como os endpoints de plataforma atuais fazem (lookup no `User`), não assumir que vem no token.
- **CSRF:** rota autenticada → registrar na whitelist de `index.ts` (o projeto aplica CSRF por whitelist, não blacklist). Sem isso, POST/PATCH/DELETE quebram.
- **Tailwind pré-compilado (armadilha conhecida — ver [[tailwind-precompiled-css]]):** o front usa CSS estático sem JIT. Usar **apenas classes já presentes em `src/index.css`**. Antes de usar `grid-cols-2`, `sm:grid-cols-5`, e as cores de badge (`bg-blue-50/amber-50/green-50/red-50/gray-100` + `text-*`/`border-*`), confirmar via Grep que existem; se faltar (como faltava `md:block`), adicionar a regra explícita ao fim do `index.css`. Verificar visualmente com `getComputedStyle`.
- **Determinismo de timestamps:** `resolvedAt` é manipulado no serviço (não no banco); `createdAt`/`updatedAt` pelo Prisma.

## Casos Extremos
- **Sem autenticação** em qualquer endpoint → `401`.
- **Usuário comum acessando/deletando sugestão de outro** → `404` mascarado (`SUGGESTION_NOT_FOUND`), nunca vaza existência.
- **Usuário comum deletando a própria não-`PENDING`** → `400` `SUGGESTION_NOT_DELETABLE`.
- **`route`/`adminNotes` nulos** → não renderizar as respectivas seções no card; `route` vazia após trim vira `null`.
- **Título/descrição só com espaços** → falham a validação (0 chars após trim) tanto no cliente quanto no Zod do servidor.
- **Transições de status:** não-terminal→`DONE`/`REJECTED` seta `resolvedAt`; terminal→não-terminal limpa; terminal→terminal mantém.
- **`suggestion.user` ausente** no card → fallback "Usuário".
- **`formatDate` lança** → retorna a string original (não quebra o card).
- **Mudança de rota com o dialog aberto** → a rota pré-preenchida não atualiza (snapshot na abertura).
- **Duplo clique em Enviar/Salvar/Remover** → bloqueado por estado `disabled` durante a requisição.
- **`maxLength` dos inputs é só UI** (não bloqueia colar) → a validação real é no Zod do backend.
- **Notificação a platform admin falha** (ex.: sem admin cadastrado) → criação da sugestão ainda assim retorna `201`.
- **Banco consolidado em 1 tenant hoje** → cross-tenant do platform admin funciona, apenas exibe 1 organização por enquanto.

## Definição de Concluído
- [ ] `npx prisma migrate` cria `Suggestion` + enums + 4 índices + FKs (cascata); `prisma migrate status` sem drift.
- [ ] `POST /api/v1/suggestions` com `{title,description,type,route?}` válido retorna `201` e a sugestão com `status=PENDING`, `userId`/`tenantId` do contexto; payload inválido retorna `400 VALIDATION_ERROR` com `details`.
- [ ] `GET /api/v1/suggestions` retorna só as próprias para usuário comum; para platform admin retorna todas (cross-tenant) com `scope=all` e só as próprias com `scope=mine`; ordenado por `createdAt desc`; inclui `user {id,name,email}`.
- [ ] `PATCH /api/v1/suggestions/:id` muda `status`/`adminNotes` só para platform admin (senão `403`); transição para `DONE`/`REJECTED` preenche `resolvedAt`, e de volta a não-terminal limpa.
- [ ] `DELETE`: dono apaga a própria só se `PENDING`; não-PENDING própria → `400 SUGGESTION_NOT_DELETABLE`; de outro usuário → `404`; platform admin apaga qualquer uma.
- [ ] Ao criar uma sugestão, cada platform admin recebe uma `Notification` in-app referenciando-a; a criação não falha se a notificação falhar.
- [ ] O FAB aparece em qualquer página `/app/*`, abre o dialog com a rota atual pré-preenchida; envio mostra "Enviando…", toast de sucesso e reset; validações client-side de 3/5 chars disparam os toasts corretos.
- [ ] `/app/suggestions` lista as sugestões em cards com badges de tipo/status corretos (labels e cores pt-BR), seções condicionais de rota/adminNotes/resolvedAt, e datas em `pt-BR`.
- [ ] Platform admin vê toggle de escopo + grid de contagem (scope=all) + botão "Gerenciar" (dialog status/adminNotes) + excluir em qualquer card; usuário comum não vê gestão e só exclui a própria `PENDING`.
- [ ] Item "Sugestões" aparece na sidebar para todos; a página carrega via lazy/Suspense.
- [ ] `cd server && npx vitest run` + `npm run build`; `npm run build`/`typecheck:ci` na raiz — todos verdes. Classes Tailwind usadas confirmadas presentes em `src/index.css` (sem repetir a armadilha do `md:block`).
