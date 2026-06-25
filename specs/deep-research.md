# Spec: Pesquisa Profunda (Deep Research)

## Objetivo

Trazer para dentro do VYD Engage o fluxo de "Pesquisa Profunda" que a área
comercial usa hoje no ChatGPT (Deep Research da OpenAI). O recurso permite
editar um prompt-modelo com campos preenchíveis (ex.: `[EMPRESA]`), copiar o
prompt para rodar no ChatGPT manualmente, colar de volta o relatório em markdown
e visualizá-lo como um **website** navegável e estilizado — em vez de markdown
cru — pronto para apresentar ao time comercial. Nesta primeira versão a
integração é **paste-in manual**; o modelo de dados já nasce preparado para uma
futura integração assíncrona com a API de Deep Research.

## Usuários

Equipe comercial e de pré-vendas do tenant (usuários autenticados do app, papéis
`ADMIN`/`USER`). Perfil não técnico: precisam de uma tela simples para escolher
um template, preencher variáveis, copiar/colar texto e ler um relatório bem
formatado. O isolamento é multi-tenant — cada tenant vê apenas suas pesquisas e
templates.

## Requisitos

### Obrigatórios

**Modelo de dados e backend**

1. O sistema deve persistir dois models Prisma tenant-scoped: `DeepResearchTemplate`
   (biblioteca de prompts-modelo) e `DeepResearch` (cada pesquisa), além do enum
   `DeepResearchStatus` com os valores `DRAFT`, `RESEARCHING`, `COMPLETED`, `FAILED`.
2. `DeepResearchTemplate` deve conter, no mínimo: `tenantId`, `name`, `description?`,
   `promptBody`, `isBuiltin` (default `false`), `createdById?`, `createdAt`, `updatedAt`.
3. `DeepResearch` deve conter, no mínimo: `tenantId`, `createdById?`, `title`,
   `templateId?` (FK com `ON DELETE SET NULL`), `promptUsed` (default `""`),
   `variables` (JSON, default `{}`), `status` (default `DRAFT`), `reportMarkdown?`,
   `reportMeta?` (JSON), `createdAt`, `updatedAt`.
4. O sistema deve aplicar uma migration que cria as tabelas `deep_research_templates`
   e `deep_research` com FK `tenantId → Tenant` (`ON DELETE CASCADE`) e índices em
   `tenantId`, `(tenantId, status)`, `(tenantId, createdAt)` e `(tenantId, isBuiltin)`.
5. O sistema deve expor, sob `/api/v1/deep-research` (montado também no alias `/api`),
   endpoints autenticados e tenant-scoped: `GET /` (lista com filtros `status`,
   `search`, `page`, `limit`), `POST /` (cria em `DRAFT`), `GET /:id`, `PUT /:id`,
   `DELETE /:id`.
6. O sistema deve expor sub-rotas de templates registradas **antes** de `/:id`:
   `GET /templates`, `POST /templates`, `GET /templates/:id`, `PUT /templates/:id`,
   `DELETE /templates/:id`.
7. Toda query Prisma do recurso deve filtrar por `tenantId`; acessar um id de outro
   tenant deve resultar em 404 (`DEEP_RESEARCH_NOT_FOUND` / `DEEP_RESEARCH_TEMPLATE_NOT_FOUND`).
8. `GET /templates` deve auto-provisionar (idempotentemente) os templates builtin do
   tenant antes de listar (`ensureBuiltins`), de modo que todo tenant — inclusive em
   produção, sem seed de demo — tenha o template "Empresa" disponível.
9. O sistema deve trazer o template builtin "Empresa" pré-carregado, com o conteúdo
   transcrito do PDF de referência (10 capítulos) e a seção de saída adaptada para
   pedir **markdown estruturado** (títulos `##` por capítulo e tabelas GFM), contendo
   o placeholder `[EMPRESA]`.
10. `DELETE /templates/:id` deve recusar (403, `BUILTIN_TEMPLATE_PROTECTED`) a exclusão
    de qualquer template com `isBuiltin = true`.
11. No `PUT /:id`, quando o campo `reportMarkdown` for enviado, o backend deve limpar
    os marcadores de citação da UI do ChatGPT, gravar o markdown limpo, salvar as
    fontes extraídas e metadados em `reportMeta` (`{ sources, charCount, generatedAt }`)
    e, se o markdown não for vazio e nenhum `status` explícito vier no payload, marcar
    a pesquisa como `COMPLETED`.
12. A limpeza do markdown (server e frontend) deve remover, de forma determinística:
    os delimitadores invisíveis da Private Use Area, os tokens textuais
    `citeturn…` (ex.: `citeturn42search2turn42search4`) e tokens de
    navegação soltos (`navlist`, `filecite`, `turn0search0`), capturando os tokens
    `cite…` encontrados como lista de fontes deduplicada.
13. A validação de entrada deve usar Zod; `reportMarkdown` deve ter limite máximo de
    500.000 caracteres; respostas de lista devem ter o formato
    `{ items, pagination: { page, limit, total, totalPages } }`.
14. A rota `/deep-research` deve estar protegida por CSRF (registrada na whitelist do
    `index.ts`), como as demais rotas autenticadas.

**Frontend — telas e fluxo**

15. O sistema deve adicionar um item "Pesquisa Profunda" no menu lateral (`Sidebar`)
    apontando para `/app/deep-research`, e registrar as rotas protegidas
    `/app/deep-research` (lista) e `/app/deep-research/:id` (visualização).
16. A página de lista (`/app/deep-research`) deve ter duas abas: "Minhas Pesquisas"
    (cada item com título, selo de status e data; ação de abrir, editar e excluir) e
    "Templates" (lista de templates; builtin com selo "Padrão"; criar, editar e excluir
    — excluir indisponível para builtin).
17. O editor de pesquisa deve permitir: escolher um template, detectar os placeholders
    `[TEXTO]` do `promptBody` e gerar um campo de entrada por placeholder, montar o
    `promptUsed` substituindo os valores em tempo real, e permitir editar o prompt final
    livremente.
18. O editor deve ter um botão "Copiar prompt" que copia o `promptUsed` para a área de
    transferência, e uma área para colar o markdown do ChatGPT com um botão que salva o
    relatório (resultando em status `COMPLETED`).
19. A tela de visualização (`/app/deep-research/:id`) deve renderizar o relatório como um
    **website**: o markdown convertido em HTML estilizado (tipografia profissional, paleta
    neutra cinza/branco/azul), com tabelas, listas, citações e títulos estilizados, e um
    **sumário/menu de navegação** com âncoras geradas a partir dos títulos (`H1`–`H3`).
20. O sumário deve permitir navegação por âncora com rolagem suave e destacar a seção
    ativa conforme o usuário rola o relatório.
21. O layout da visualização deve ser responsivo: sumário lateral fixo no desktop e em
    drawer (gaveta) no mobile; o conteúdo deve ocupar a largura total no mobile.
22. A renderização do markdown deve ser determinística no frontend (sem geração de HTML
    por LLM) usando `react-markdown` + `remark-gfm`, com cada elemento estilizado via
    componentes mapeados (sem depender da classe `prose`).

## Fora do Escopo

- Integração automática com a OpenAI Deep Research API (disparo/recebimento via
  `o3-deep-research`, jobs em background). O modelo de dados apenas a prepara.
- Geração do relatório como HTML por LLM (segundo passo de IA).
- Exportação do relatório para PDF.
- Geração automática de gráficos/infográficos a partir das tabelas do relatório.
- Limites de plano (plan limits) específicos para o recurso.

## Restrições

- Backend: Node + Express + Prisma + PostgreSQL; rotas em `/api/v1` (+ alias `/api`),
  padrão de `automations.ts`/`automationService.ts`; `authenticate` + `tenantScope`;
  erros via `createError` + `next(error)`. Migration sem RLS inline (isolamento na
  aplicação), seguindo o padrão de `20260624000200_email_campaigns`.
- Frontend: React 18 + TypeScript + Vite + Tailwind v4 (sem `tailwind.config` e **sem**
  `@tailwindcss/typography` — `prose` é no-op) + shadcn/ui. Estado de servidor via
  TanStack Query; cliente HTTP singleton `src/services/api/client.ts` (cookie httpOnly
  + header CSRF). Componentes shadcn reutilizados: `tabs`, `card`, `badge`, `drawer`,
  `dialog`, `breadcrumb`, `scroll-area`, `textarea`, `input`, `select`.
- Segurança: o markdown vem de fonte externa (colado pelo usuário). A renderização deve
  sanitizar o HTML resultante via `rehype-sanitize` (allowlist), sem `script`/`style`/
  `iframe`/`on*`, com `href` restrito a `http`/`https`/`mailto`, e **sem**
  `dangerouslySetInnerHTML`. Persistir o markdown já limpo de marcadores no save.
- Multi-tenant: nenhum acesso cruzado entre tenants; FKs `ON DELETE CASCADE` por tenant.
- Conteúdo e mensagens em português do Brasil; identificadores de código em inglês.

## Casos Extremos

- **Conteúdo externo malicioso (XSS):** scripts, handlers `on*` e iframes no markdown
  colado não devem sobreviver à renderização nem ser executados.
- **Marcadores `citeturn…`:** devem desaparecer do corpo do relatório (formas invisível
  e textual) e ser preservados como fontes em `reportMeta.sources`.
- **Tabelas largas no mobile:** cada tabela deve rolar horizontalmente sem quebrar o
  layout da página.
- **Markdown malformado:** a renderização não deve quebrar a aplicação (tolerância do
  parser + ErrorBoundary por rota); títulos malformados apenas não entram no sumário.
- **Âncoras do sumário:** os `id` do sumário e os `id` dos títulos no DOM devem coincidir
  (mesmo algoritmo de slug), inclusive em títulos duplicados.
- **Placeholders não preenchidos:** o editor deve sinalizar os `[X]` ainda não preenchidos,
  mas não bloquear copiar o prompt.
- **Markdown muito grande:** entrada acima de 500.000 caracteres deve ser rejeitada pela
  validação (e o payload cabe no limite de 10mb do Express).
- **Template referenciado excluído:** excluir um template não deve apagar pesquisas que o
  usaram (`templateId` vira `null`; o `promptUsed` permanece como snapshot).
- **Pesquisa ainda sem relatório (`status != COMPLETED`):** a tela de visualização deve
  mostrar um estado vazio com acesso ao editor, em vez de erro.

## Definição de Concluído

- [ ] Migration `20260624000400_deep_research` cria `deep_research` e
      `deep_research_templates` com índices e FKs; `npx prisma generate` e o build do
      servidor passam.
- [ ] `GET /api/v1/deep-research/templates` retorna o template builtin "Empresa" para um
      tenant novo (auto-provision), e o builtin não pode ser excluído (403).
- [ ] CRUD de pesquisas e de templates funciona com isolamento por tenant (acesso a id de
      outro tenant retorna 404).
- [ ] `PUT /:id` com `reportMarkdown` salva o texto limpo (sem `citeturn…`), popula
      `reportMeta.sources` e marca a pesquisa como `COMPLETED`.
- [ ] O item "Pesquisa Profunda" aparece no menu e as rotas `/app/deep-research` e
      `/app/deep-research/:id` carregam.
- [ ] No editor é possível escolher o template "Empresa", preencher `[EMPRESA]`, ver o
      prompt final montado e copiá-lo para a área de transferência.
- [ ] Ao colar o markdown de exemplo (`deep-research-report.md`) e salvar, a visualização
      mostra um site navegável: sumário com âncoras, rolagem suave, seção ativa destacada,
      tabelas estilizadas com rolagem horizontal no mobile, sem marcadores `citeturn` no
      corpo e sem execução de scripts.
- [ ] Testes unitários cobrem a limpeza do markdown (citeturn + XSS) e a extração do
      sumário; `npx vitest run` (server e frontend) e os builds (`npm run build` em ambos)
      passam.
