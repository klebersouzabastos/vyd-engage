# Technical Debt Assessment - VYD Engage

**Data:** 2026-02-23
**Avaliado por:** @architect (Aria) + @qa
**Versao:** 0.1.0

---

## Resumo Executivo

| Severidade | Frontend | Backend | Total |
|------------|----------|---------|-------|
| CRITICAL   | 3        | 5       | **8** |
| HIGH       | 5        | 7       | **12**|
| MEDIUM     | 7        | 8       | **15**|
| LOW        | 3        | 5       | **8** |
| **Total**  | **18**   | **25**  | **43**|

---

## CRITICAL - Corrigir Imediatamente

### TD-001: Contexts fazem API calls sem verificar autenticacao
- **Tipo:** Frontend / Security
- **Arquivos:** `src/contexts/TagsContext.tsx:30`, `CustomFieldsContext.tsx:49`, `EmailContext.tsx:71`, `WhatsAppContext.tsx:80`, `NotificationContext.tsx:25`, `PaymentContext.tsx:46`
- **Problema:** Todos os context providers disparam `useEffect` com API calls no mount sem verificar se `user` esta autenticado no `AuthContext`. Isso causa avalanche de requests 401 + refresh attempts, resultando em rate limiting que bloqueia o usuario de fazer login/reset de senha.
- **Impacto:** Rate limiting bloqueia funcionalidades legitimas (login, reset senha). Experiencia do usuario degradada com erros em cascata.
- **Correcao:** Envolver API calls em guard `if (!user || loading) return;` em todos os contexts.

### TD-002: Dashboard sem diferenciacao de erro vs dados vazios
- **Tipo:** Frontend / UX
- **Arquivos:** `src/hooks/useDashboard.ts:35-131`
- **Problema:** `Promise.allSettled()` trata falhas silenciosamente, mostrando dashboard vazio sem indicar ao usuario se os dados falharam ao carregar ou se realmente nao existem.
- **Impacto:** Usuario ve dashboard vazio sem feedback.
- **Correcao:** Diferenciar estados: loading, error, empty, loaded.

### TD-003: Webhook Mercado Pago aceita requests sem secret
- **Tipo:** Backend / Security
- **Arquivo:** `server/src/routes/webhooks.ts:11-16`
- **Problema:** `validateMercadoPagoSignature()` retorna `true` silenciosamente quando `MERCADO_PAGO_WEBHOOK_SECRET` nao esta configurado.
- **Impacto:** Em producao, webhooks forjados seriam aceitos se env var estiver ausente.
- **Correcao:** Rejeitar webhooks se secret nao estiver configurado.

### TD-004: console.log em services de producao
- **Tipo:** Backend / Security
- **Arquivos:** `server/src/services/mercadopagoService.ts:9,75`, `paymentService.ts:88`, `subscriptionService.ts:68`
- **Problema:** Chamadas diretas a `console.log/error` que bypassam o logger. Podem vazar dados sensiveis em logs de producao.
- **Impacto:** Stack traces e dados sensiveis expostos; erros nao capturados pelo Sentry.
- **Correcao:** Substituir todos `console.*` por `logger.*`.

### TD-005: Idempotency key hardcoded no Mercado Pago
- **Tipo:** Backend / Data Integrity
- **Arquivo:** `server/src/services/mercadopagoService.ts:16`
- **Problema:** `idempotencyKey: 'abc'` e uma constante hardcoded. Todas as requests usam a mesma key.
- **Impacto:** Mercado Pago trata todas requests como retry da primeira; pagamentos duplicados nao sao prevenidos.
- **Correcao:** Gerar UUID unico por request.

### TD-006: Debug logging de credenciais em auth routes
- **Tipo:** Backend / Security
- **Arquivo:** `server/src/routes/auth.ts:160-170`
- **Problema:** Request body (incluindo senhas) logado em modo development. Se logger enviar para servico externo, credenciais ficam expostas.
- **Impacto:** Vazamento de credenciais em plaintext.
- **Correcao:** Nunca logar request body em endpoints de autenticacao.

### TD-007: Timing attack em webhook signature
- **Tipo:** Backend / Security
- **Arquivo:** `server/src/routes/webhooks.ts:42`
- **Problema:** `crypto.timingSafeEqual()` usado em buffers de tamanho variavel, podendo vazar tamanho da signature.
- **Impacto:** Side-channel attack para adivinhar assinatura do webhook.
- **Correcao:** Validar tamanho dos hex strings antes da comparacao.

### TD-008: Invitation token sem rate limiting
- **Tipo:** Backend / Security
- **Arquivo:** `server/src/routes/invitations.ts:62-70`
- **Problema:** Endpoint publico `/api/invitations/token/:token` sem rate limiting nem protecao contra enumeracao.
- **Impacto:** Brute-force de tokens de convite.
- **Correcao:** Adicionar rate limiting e comparacao constant-time.

---

## HIGH - Corrigir na Proxima Sprint

### TD-009: Race condition no PlanContext
- **Tipo:** Frontend / Performance
- **Arquivo:** `src/contexts/PlanContext.tsx:157-159`
- **Problema:** `useEffect` com `[loadFromApi]` no dependency array pode criar loop infinito de API calls.
- **Impacto:** Vazamento de memoria, chamadas infinitas ao backend.
- **Correcao:** Revisar dependency array; usar ref para controle.

### TD-010: Tipo `any` em componentes criticos
- **Tipo:** Frontend / Type Safety
- **Arquivos:** `src/components/LeadModal.tsx:68`, `src/hooks/useLeads.ts:84,129`, `src/services/api/client.ts:123`
- **Problema:** Props e responses tipados como `any`, perdendo toda seguranca de tipos do TypeScript.
- **Impacto:** Bugs silenciosos; breaking changes do backend nao detectados em compile-time.
- **Correcao:** Criar interfaces TypeScript para todos os modelos.

### TD-011: Operacoes bulk sem disable de UI
- **Tipo:** Frontend / UX
- **Arquivo:** `src/pages/Leads.tsx:162-179`
- **Problema:** Operacoes em massa (delete, etc) nao desabilitam UI durante processamento.
- **Impacto:** Usuario pode triggerar multiplos deletes simultaneos; race conditions.
- **Correcao:** Desabilitar botoes durante operacao; adicionar loading state.

### TD-012: Sem transacoes em operacoes multi-step
- **Tipo:** Backend / Data Integrity
- **Arquivo:** `server/src/services/leadService.ts:27-79`
- **Problema:** Criacao de lead com tags usa `Promise.all` sem `prisma.$transaction()`. Se a segunda operacao falhar, lead existe sem tags.
- **Impacto:** Inconsistencia de dados; leads sem tags associadas.
- **Correcao:** Envolver em `prisma.$transaction()`.

### TD-013: orderBy dinamico sem whitelist
- **Tipo:** Backend / Security
- **Arquivo:** `server/src/services/leadService.ts:165`
- **Problema:** `orderBy: { [sortField]: sortOrder }` usa input do usuario diretamente.
- **Impacto:** Acesso a campos sensiveis via ordenacao; degradacao de performance.
- **Correcao:** Whitelist de campos permitidos para sort.

### TD-014: Webhooks sem idempotency tracking
- **Tipo:** Backend / Data Integrity
- **Arquivo:** `server/src/routes/webhooks.ts:45-69`
- **Problema:** Webhooks do Mercado Pago processados sem verificar duplicatas.
- **Impacto:** Pagamentos duplicados; subscription renovada duas vezes.
- **Correcao:** Armazenar webhook IDs no banco; skip se ja processado.

### TD-015: Async errors em webhooks nao await
- **Tipo:** Backend / Reliability
- **Arquivo:** `server/src/routes/webhooks.ts:120,139,153`
- **Problema:** Processamento async fire-and-forget sem await. Webhook retorna 200 mesmo se processamento falhar.
- **Impacto:** Erros silenciosos; dados perdidos.
- **Correcao:** Await processamento ou track status em banco.

### TD-016: `as any` cast em lead import
- **Tipo:** Backend / Type Safety
- **Arquivo:** `server/src/routes/leads.ts:204`
- **Problema:** `source: leadSource as any` bypassa TypeScript.
- **Impacto:** Valores de enum invalidos no banco.
- **Correcao:** Safe mapping com validacao.

### TD-017: Endpoint de recalculo de scores sem rate limit
- **Tipo:** Backend / Performance
- **Arquivo:** `server/src/routes/scoring.ts:107,118`
- **Problema:** `/recalculate` pode ser chamado por qualquer usuario autenticado sem limitacao.
- **Impacto:** Exaustao de CPU com tenants grandes.
- **Correcao:** Rate limit por tenant; mover para background job.

### TD-018: Public capture sem limites de tamanho
- **Tipo:** Backend / Security
- **Arquivo:** `server/src/index.ts:180-231`
- **Problema:** Schema Zod sem `max()` nos campos de string. Payloads arbitrariamente grandes aceitos.
- **Impacto:** DoS via database bloat; payloads de 10MB.
- **Correcao:** Adicionar `.max()` em todos os campos string.

### TD-019: Missing error boundaries em paginas data-heavy
- **Tipo:** Frontend / UX
- **Arquivos:** `src/pages/Leads.tsx`, `src/pages/Dashboard.tsx`
- **Problema:** Sem error boundaries em tabelas e dashboards complexos.
- **Impacto:** Crash total da pagina em vez de erro graceful.
- **Correcao:** Adicionar error boundaries por secao.

### TD-020: Mensagens de erro inconsistentes (PT/EN mix)
- **Tipo:** Frontend / UX
- **Arquivos:** `src/contexts/TagsContext.tsx:54,66,76`, `CustomFieldsContext.tsx:76`
- **Problema:** Mix de mensagens em portugues e ingles; erros com formatacao inconsistente.
- **Impacto:** UX confusa.
- **Correcao:** Padronizar todas as mensagens em portugues.

---

## MEDIUM - Backlog de Melhorias

### TD-021: Strings hardcoded em multiplos arquivos
- **Arquivos:** `src/pages/Dashboard.tsx:56-70`, `src/pages/Leads.tsx:62-79`
- **Problema:** Labels de status/source duplicados em varios arquivos.
- **Correcao:** Centralizar em enum/constants.

### TD-022: Falta de memoizacao em filtros
- **Arquivo:** `src/pages/Leads.tsx:121-160`
- **Problema:** Logica de filtragem re-executa a cada render.
- **Correcao:** `useMemo` com dependencias corretas.

### TD-023: Error handling inconsistente entre contexts
- **Arquivos:** `src/contexts/EmailContext.tsx:161`, `WhatsAppContext.tsx:166`
- **Problema:** Alguns contexts engolem erros com toast, outros re-throw.
- **Correcao:** Padronizar pattern de error handling.

### TD-024: PaymentContext polling sem cleanup
- **Arquivo:** `src/contexts/PaymentContext.tsx:73-75,192-208`
- **Problema:** Polling acumula sem cleanup guard.
- **Correcao:** Adicionar cleanup no useEffect.

### TD-025: refreshUser sem null check
- **Arquivo:** `src/contexts/CompanyContext.tsx:32`
- **Problema:** `refreshUser` pode ser undefined.
- **Correcao:** Optional chaining.

### TD-026: Refresh token aceito via body e cookie
- **Arquivo:** `server/src/routes/auth.ts:64-84`
- **Problema:** Refresh token aceito de `req.body` e cookie. Padrao misto.
- **Correcao:** Enforcar httpOnly cookie only.

### TD-027: Formato de resposta inconsistente
- **Arquivo:** `server/src/middleware/errorHandler.ts:40-50`
- **Problema:** Public capture retorna `{status, message}`, erros retornam `{error, statusCode}`.
- **Correcao:** Padronizar para `{status, data?, error?, code?}`.

### TD-028: Prisma query logging em producao
- **Arquivo:** `server/src/config/database.ts:5-8`
- **Problema:** Queries SQL podem conter dados sensiveis em logs.
- **Correcao:** Desabilitar query logging em producao.

### TD-029: Bulk email sem validacao de tamanho
- **Arquivo:** `server/src/routes/email.ts:121-140`
- **Problema:** 500 recipients aceitos sem limite de tamanho por campo.
- **Correcao:** Max length em emails e variaveis.

### TD-030: Email homograph attack
- **Arquivo:** `server/src/routes/auth.ts:16`
- **Problema:** Sem normalizacao Unicode em emails.
- **Correcao:** Adicionar normalizacao NFC; bloquear caracteres lookalike.

### TD-031: Reports sem paginacao
- **Arquivo:** `server/src/routes/reports.ts:71-102`
- **Problema:** Metrics endpoint busca TODOS os leads/tasks sem limite.
- **Correcao:** Default 30 dias; implementar paginacao.

### TD-032: Auth failures nao logados
- **Arquivo:** `server/src/middleware/auth.ts:61-63`
- **Problema:** Falhas de autenticacao nao sao logadas.
- **Correcao:** Logar com contexto anonimizado (IP, endpoint).

### TD-033: UUID nao validado em path params
- **Arquivo:** `server/src/routes/leads.ts:65,122`
- **Problema:** `req.params.id` usado sem validacao de formato UUID.
- **Correcao:** Zod validation em path params.

### TD-034: Validacao de PublicForm com typos
- **Arquivo:** `src/pages/PublicForm.tsx:34-45`
- **Problema:** Mensagens com typos ("obrigatorio" sem acento).
- **Correcao:** Corrigir acentuacao.

### TD-035: Null check em interaction.createdAt
- **Arquivo:** `server/src/routes/reports.ts:172`
- **Problema:** `.toISOString()` assume createdAt sempre definido.
- **Correcao:** Optional chaining.

---

## LOW - Melhoria Continua

### TD-036: Import paths inconsistentes (relativo vs alias @/)
- **Tipo:** Frontend / Consistency
- **Correcao:** Padronizar para alias `@/`.

### TD-037: Falta de JSDoc em funcoes complexas
- **Tipo:** Frontend / Maintainability
- **Arquivos:** `src/hooks/useDashboard.ts`, `src/hooks/useLeads.ts`

### TD-038: Codigo morto / duplicado
- **Tipo:** Frontend / Cleanup
- **Arquivo:** `src/components/LeadModal.tsx:31-63` (automations hardcoded)

### TD-039: HTML nao sanitizado em email sending
- **Tipo:** Backend / Security
- **Arquivo:** `server/src/routes/email.ts:125`
- **Correcao:** Usar DOMPurify ou sanitize-html.

### TD-040: Stack traces expostos em error responses (dev)
- **Tipo:** Backend / Security
- **Arquivo:** `server/src/middleware/errorHandler.ts`
- **Correcao:** Garantir que stack so aparece em NODE_ENV=development.

---

## Debitos Ja Corrigidos Nesta Sessao

### [CORRIGIDO] Rate limiting bloqueia funcionalidades em dev
- **Arquivos:** `server/src/middleware/rateLimit.ts`, `server/src/index.ts`
- **Correcao:** Rate limiting desabilitado em desenvolvimento; authLimiter separado do passwordResetLimiter.

### [CORRIGIDO] CORS nao aceita porta 5174
- **Arquivo:** `server/src/index.ts:28`
- **Correcao:** Adicionada porta 5174 a lista de origens permitidas.

### [CORRIGIDO] VITE_API_URL nao configurado
- **Arquivo:** `.env`
- **Correcao:** `VITE_API_URL=http://localhost:3001` adicionado explicitamente.

### [CORRIGIDO] Client.ts tenta refresh em endpoints de auth
- **Arquivo:** `src/services/api/client.ts:81`
- **Correcao:** Skip refresh para endpoints `/api/auth/`.

---

## Recomendacao de Priorizacao

### Sprint Atual (Urgente)
1. TD-001: Guard de autenticacao nos contexts (raiz do problema de rate limiting)
2. TD-003: Webhook signature validation
3. TD-004: Remover console.log dos services
4. TD-005: Idempotency key do Mercado Pago

### Proxima Sprint
5. TD-012: Transacoes no lead service
6. TD-009: Race condition PlanContext
7. TD-014: Webhook idempotency tracking
8. TD-010: Substituir `any` por interfaces

### Backlog
9. TD-021 a TD-035: Melhorias de qualidade
10. TD-036 a TD-040: Polimento

---

*Gerado por @architect (Aria) + @qa - Brownfield Technical Debt Assessment*
