# Spec: Bulk Delete de Leads

## Objetivo

Endpoint dedicado para deleção em lote de leads por array de IDs. Permite que administradores do tenant removam até 100 leads em uma única operação HTTP, sem necessidade de chamadas individuais. A deleção é permanente (hard delete) e silenciosa para IDs inexistentes ou de outros tenants.

## Usuários

Usuários com `role: ADMIN` dentro do próprio tenant. Não se aplica a usuários com `role: USER` ou `role: VIEWER`, e não é necessário `isPlatformAdmin`. Contexto de uso: limpeza de base, remoção de leads importados erroneamente, operações administrativas de manutenção.

## Requisitos

### Obrigatórios

1. O sistema deve aceitar requisições `POST /api/v1/leads/bulk-delete` com corpo JSON contendo um campo `ids` (array de strings UUID).
2. O sistema deve rejeitar a requisição com `401` se o usuário não estiver autenticado.
3. O sistema deve rejeitar a requisição com `403` se o usuário autenticado não tiver `role: ADMIN` no tenant.
4. O sistema deve rejeitar a requisição com `400` (erro de validação Zod) se `ids` estiver ausente, vazio, ou contiver mais de 100 itens.
5. O sistema deve rejeitar a requisição com `400` se qualquer elemento de `ids` não for um UUID válido.
6. O sistema deve deletar permanentemente (hard delete — `prisma.lead.deleteMany`) apenas os leads cujo `id` está em `ids` E cujo `tenantId` corresponde ao tenant do usuário autenticado.
7. O sistema deve ignorar silenciosamente IDs que não existam no banco ou que pertençam a outro tenant — sem retornar erro.
8. Antes de deletar cada lead, o sistema deve cancelar todos os `AutomationLog` com `status: 'WAITING'` associados aos IDs a deletar (mesmo comportamento do `DELETE /leads/:id` individual), em uma única operação `updateMany`.
9. O sistema deve retornar `200` com corpo `{ status: 200, data: { deleted: N } }`, onde `N` é o número de leads efetivamente deletados (excluindo IDs ignorados).
10. O sistema deve invocar `planLimitsService.invalidateUsage(tenantId)` de forma assíncrona (`.catch(() => {})`) após a deleção, para atualizar o cache de uso do plano.
11. O endpoint deve seguir o padrão de middleware da aplicação: `authenticate`, `tenantScope`, validação Zod no corpo da requisição, `try/catch` com `next(error)`.

### Fora do Escopo

- Soft delete (campo `deletedAt`) — não aplicável; usar `deleteMany` direto.
- Rollback ou desfazer a operação após confirmação.
- Retornar quais IDs foram deletados e quais foram ignorados — apenas o total.
- Notificações para usuários sobre leads deletados em lote.
- Checagem de plano ou limite antes de deletar (só invalida cache depois).
- Acesso por usuários com `role: USER` ou `role: VIEWER`.
- Acesso cross-tenant por `isPlatformAdmin`.

## Restrições

- Stack: Node.js + Express + TypeScript + Prisma, seguindo padrões existentes em `server/src/routes/leads.ts`.
- Validação via Zod: `z.array(z.string().uuid()).min(1).max(100)`.
- Autorização via `requireRole('ADMIN')` de `server/src/middleware/auth.ts`.
- A deleção de leads com cascade no banco já remove `LeadTag` entries automaticamente via Prisma schema; verificar se há outras relações sem cascade que precisem de tratamento explícito (e.g., `Interaction`, `Task` — o merge já as move, mas o delete individual não; alinhar comportamento).
- Resposta no formato padrão da API: `{ status: 200, data: { ... } }`.
- A rota deve ser registrada em `server/src/routes/leads.ts` **antes** dos handlers de `/:id` para evitar conflito de rotas parametrizadas.

## Casos Extremos

- **Array com 0 IDs:** Zod rejeita com `400` (`.min(1)`).
- **Array com 101+ IDs:** Zod rejeita com `400` (`.max(100)`).
- **Todos os IDs inexistentes ou de outro tenant:** `deleteMany` retorna count 0; resposta `{ deleted: 0 }` com status `200`.
- **Mistura de IDs válidos e inválidos (cross-tenant ou inexistentes):** apenas os válidos do tenant são deletados; `deleted` reflete só os efetivamente removidos.
- **UUID mal formatado:** Zod rejeita o array inteiro com `400` antes de chegar ao banco.
- **Array com IDs duplicados:** Prisma `deleteMany` com `id: { in: ids }` deduplica naturalmente; `deleted` reflete registros únicos removidos.
- **Deleção parcial por erro de banco:** se `deleteMany` falhar após o `updateMany` de AutomationLogs, o erro propaga via `next(error)` e retorna `500`; não há rollback automático a menos que se use `prisma.$transaction`.
- **Leads com AutomationLogs em outros status:** somente `WAITING` é cancelado; outros status (`COMPLETED`, `FAILED`, etc.) não são afetados.

## Definição de Concluído

- [ ] `POST /api/v1/leads/bulk-delete` com body `{ ids: ["<uuid>"] }` retorna `200` para usuário com `role: ADMIN`.
- [ ] Requisição sem token retorna `401`.
- [ ] Requisição com usuário `role: USER` ou `role: VIEWER` retorna `403`.
- [ ] Body sem `ids` retorna `400` com `VALIDATION_ERROR`.
- [ ] Body com `ids: []` retorna `400` com `VALIDATION_ERROR`.
- [ ] Body com 101 IDs retorna `400` com `VALIDATION_ERROR`.
- [ ] Body com UUID mal formatado retorna `400` com `VALIDATION_ERROR`.
- [ ] IDs de outro tenant são ignorados silenciosamente; `deleted` não os conta.
- [ ] IDs inexistentes são ignorados silenciosamente; `deleted` não os conta.
- [ ] Leads efetivamente deletados somem do banco (`prisma.lead.findMany` não os retorna).
- [ ] `AutomationLog` com `status: WAITING` associados aos leads deletados têm status alterado para `CANCELLED` antes da deleção.
- [ ] `planLimitsService.invalidateUsage` é chamado após a deleção (verificável via mock em teste unitário).
- [ ] Resposta de sucesso tem formato `{ status: 200, data: { deleted: N } }`.
- [ ] O endpoint não interfere nas rotas existentes de `/:id` (verificar order of routes).
