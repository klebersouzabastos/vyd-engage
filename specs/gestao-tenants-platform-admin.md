# Spec: Gestão de Tenants no Platform Admin + Fechar Registro Público

## Objetivo

Transformar a ferramenta de gestão da plataforma (rota `/app/admin`, restrita a usuários com
`isPlatformAdmin = true`) de um painel **somente-leitura** em uma ferramenta completa de gestão de
tenants — permitindo **suspender** (reversível), **excluir** (definitivo), **editar nome**, **trocar
plano/status da assinatura**, **resetar a senha do admin** e ver o **detalhe** de cada tenant. Em
paralelo, **remover o registro público** de novos tenants, de modo que tenants passem a nascer
**exclusivamente** pela ferramenta de gestão. O problema que resolve: a base acumulou muitos tenants de
teste (criados pelo cadastro aberto) que precisam ser limpos, e não há controle sobre quem cria novos
tenants.

## Usuários

**Platform admin** (super-admin da plataforma, `User.isPlatformAdmin = true`) — usuário técnico
responsável por operar e manter a base de tenants do SaaS. Acessa a ferramenta em `/app/admin`. É o
único papel autorizado a gerir e criar tenants.

## Requisitos

### Obrigatórios

**Status e suspensão de tenant**

1. O sistema deve ter um campo `status` no Tenant com os valores `ACTIVE` e `SUSPENDED`, com padrão
   `ACTIVE`. Tenants já existentes devem permanecer `ACTIVE` após a migração.
2. Um platform admin deve poder **suspender** um tenant `ACTIVE` e **reativar** um tenant `SUSPENDED`
   pela ferramenta de gestão.
3. Quando um tenant está `SUSPENDED`, qualquer usuário desse tenant deve ser impedido de fazer login e
   de acessar rotas autenticadas, recebendo erro `403` com código `TENANT_SUSPENDED` — tanto no login
   quanto nas requisições subsequentes (middleware de autenticação).
4. Usuários com `isPlatformAdmin = true` **não** devem ser bloqueados pelo status do próprio tenant
   (para não perderem acesso à ferramenta de gestão caso o tenant deles seja suspenso por engano).
5. Suspender um tenant já suspenso ou reativar um já ativo deve ser idempotente (sem erro).

**Exclusão de tenant**

6. Um platform admin deve poder **excluir** um tenant definitivamente (hard delete), removendo em
   cascata todos os dados associados (usuários, leads, deals, empresas, automações, assinatura, etc.).
7. A exclusão deve exigir confirmação digitando o **slug exato** do tenant; se o valor digitado não
   corresponder ao slug, a exclusão deve ser recusada (`400`).
8. O sistema deve **recusar** a exclusão (`409`) quando: (a) o tenant contém o próprio platform admin
   que está solicitando a exclusão; (b) o tenant contém algum usuário com `isPlatformAdmin = true`;
   (c) a assinatura do tenant está com status `ACTIVE`.
9. Para excluir um tenant cuja assinatura está `ACTIVE`, o admin deve primeiro **suspender** o tenant
   ou **alterar** o plano/status da assinatura para um estado não-`ACTIVE`.
10. O sistema deve permitir **exclusão em lote**: selecionar vários tenants e excluí-los de uma vez.
    Cada tenant passa pelas mesmas proteções do requisito 8; o processo **não** deve abortar no primeiro
    erro e deve retornar um relatório de **sucessos** e **falhas** (com motivo) por tenant.

**Edição e plano**

11. Um platform admin deve poder **editar o nome** de um tenant. O **slug permanece imutável**.
12. Um platform admin deve poder **alterar o plano** (`STARTER` / `PRO` / `ENTERPRISE`) e/ou o **status
    da assinatura** de um tenant pela ferramenta.

**Reset de senha do admin do tenant**

13. Um platform admin deve poder **resetar a senha** do admin de um tenant. O sistema deve: gerar uma
    nova senha, **invalidar as sessões ativas** (refresh tokens) do usuário, **exibir a nova senha uma
    única vez** na tela (toast) **e enviá-la por email** ao admin do tenant (reusando a infra de email
    transacional existente).
14. Se o envio de email falhar ou estiver indisponível, a operação de reset deve **concluir mesmo
    assim** e exibir a senha no toast (o email é best-effort, não bloqueia o reset).

**Detalhe e listagem**

15. Um platform admin deve poder abrir o **detalhe** de um tenant e ver: dados do tenant, seu `status`,
    plano e status da assinatura, contadores (usuários, leads, deals, automações) e a lista de usuários
    (com nome, email, role e status).
16. A listagem de tenants deve exibir o **status do tenant** (`ACTIVE` / `SUSPENDED`) como coluna,
    visualmente distinta do status da assinatura já mostrado.

**Criação restrita / remoção do registro público**

17. O registro público de novos tenants deve ser **removido**: a rota `/register` e a página de
    cadastro (frontend), o endpoint `POST /auth/register` e a função de registro (backend) deixam de
    existir.
18. Após a remoção, acessar `/register` no frontend e chamar `POST /api/v1/auth/register` no backend
    devem retornar "não encontrado" (404).
19. Novos tenants devem ser criados **exclusivamente** pela ferramenta de gestão (platform admin),
    pelo fluxo de provisionamento já existente.
20. Os **botões de cadastro** da Landing ("Criar Conta Gratuita", "Começar Grátis") e o **link de
    cadastro** do Login devem ser **removidos**. O botão "Entrar" (→ `/login`) do topo permanece.
21. Convites para tenants existentes (`Invitation` / `/accept-invitation`) devem **continuar
    funcionando** normalmente.

**Autorização (transversal)**

22. Todas as ações de gestão (suspender, reativar, excluir, exclusão em lote, editar nome, trocar
    plano/status, reset de senha, ver detalhe) devem ser restritas a platform admins
    (`isPlatformAdmin = true`) e protegidas por autenticação + CSRF.

### Fora do Escopo

- **Soft-delete / lixeira / restauração** do tenant — a exclusão é definitiva (hard delete). A
  suspensão é o mecanismo reversível.
- Fluxo "Fale com vendas" / contato comercial na Landing.
- Self-service signup, trial automático ou qualquer caminho de criação de tenant fora da ferramenta de
  gestão.
- Edição do **slug** do tenant.
- Auditoria estruturada de ações de tenant no `auditLogger` (registro via `logger` é suficiente).
- A página `/onboarding` (que rodava após o cadastro) permanece como está — fica órfã, mas inofensiva.
- Gestão granular de usuários do tenant (criar/editar/remover usuários individuais) além do reset de
  senha do admin.

## Restrições

- **Stack:** backend Node + Express + TypeScript + Prisma (`server/`); frontend React + TypeScript +
  Vite (`src/`).
- A mudança de schema deve ser uma **migration SQL versionada** em `server/prisma/migrations/`,
  **aditiva** e segura (campo `status` com `DEFAULT 'ACTIVE'`).
- **Reusar infra existente**, sem reinventar: `provisionTenant` (`server/src/services/platformService.ts`)
  como único caminho de criação; `emailService` (`server/src/services/emailService.ts`) e templates em
  `server/src/emails/` para o email de reset; componentes shadcn já presentes em `src/components/ui/`
  (`dropdown-menu`, `checkbox`, `alert-dialog`, `sheet`).
- O frontend usa **Tailwind v4 pré-compilado** (`src/index.css`, sem JIT): reutilizar classes já
  presentes na base; evitar utilitárias inéditas ou valores arbitrários novos que não gerariam CSS.
- As rotas `/admin` já estão protegidas por `authenticate` + `requirePlatformAdmin` + CSRF — manter
  esse padrão para as novas rotas.
- **Segredos:** a senha em texto plano só pode aparecer na resposta da API, no toast e no email — nunca
  em logs.

## Casos Extremos

- Excluir tenant inexistente → `404`.
- `confirmSlug` não corresponde ao slug → `400`, sem excluir.
- Excluir o próprio tenant, tenant com platform admin, ou tenant com assinatura `ACTIVE` → `409` com
  código específico (`CANNOT_DELETE_OWN_TENANT`, `TENANT_HAS_PLATFORM_ADMIN`,
  `TENANT_HAS_ACTIVE_SUBSCRIPTION`).
- Exclusão em lote com mistura de tenants válidos e protegidos → exclui os válidos e **relata** os
  recusados (com motivo), sem abortar.
- Tenant **sem assinatura** → detalhe, edição e suspensão funcionam; a exclusão não é bloqueada pela
  regra de assinatura ativa.
- Usuário com sessão ativa cujo tenant é suspenso durante a sessão → a próxima requisição autenticada é
  barrada (`403 TENANT_SUSPENDED`) pelo middleware.
- Platform admin cujo próprio tenant está suspenso → continua acessando a ferramenta normalmente
  (isenção do requisito 4).
- Reset de senha com email indisponível/falho → reset conclui, senha exibida no toast, aviso registrado
  no log.

## Definição de Concluído

- [ ] Migration aplicada: `Tenant.status` existe com enum `TenantStatus (ACTIVE, SUSPENDED)` e padrão
      `ACTIVE`; tenants existentes ficam `ACTIVE`.
- [ ] Login e middleware de autenticação barram usuário de tenant `SUSPENDED` com `403 TENANT_SUSPENDED`;
      platform admins permanecem isentos.
- [ ] Suspender e reativar um tenant funciona pela ferramenta e reflete na listagem (coluna de status).
- [ ] Excluir um tenant digitando o slug correto remove o tenant e seus dados em cascata; slug
      incorreto recusa a exclusão.
- [ ] As três proteções de exclusão retornam `409`: próprio tenant, tenant com platform admin,
      assinatura `ACTIVE`.
- [ ] Exclusão em lote remove os válidos e retorna relatório de sucessos/falhas.
- [ ] Editar o nome e trocar plano/status da assinatura refletem na ferramenta (nome muda, slug não).
- [ ] Reset de senha do admin: nova senha exibida no toast **e** enviada por email; sessões ativas do
      usuário invalidadas; login antigo deixa de funcionar e o novo funciona.
- [ ] Detalhe do tenant exibe usuários, contadores e plano/assinatura.
- [ ] `/register` (frontend) e `POST /api/v1/auth/register` (backend) retornam `404`; Landing e Login
      sem botões/links de cadastro (apenas "Entrar"); convites (`/accept-invitation`) continuam
      funcionando.
- [ ] `cd server && npx vitest run` verde (incluindo testes novos de suspensão/exclusão/reset);
      `npm run build` no backend e na raiz sem erros de tipo.
