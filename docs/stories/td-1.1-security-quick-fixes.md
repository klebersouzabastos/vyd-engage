# Story: Security Quick Fixes

**Story ID:** TD-1.1
**Epic:** EPIC-TD (Technical Debt Remediation)
**Tipo:** Security Fix
**Prioridade:** P0 (Production Blocker)
**Pontos:** 3
**Sprint:** 1 — Production Blockers
**Fase:** 1 (Paralelo com TD-1.2)
**Dependencias:** Nenhuma
**Desbloqueia:** TD-1.4 (Payment Security)
**Status:** Draft
**Debitos:** SEC-01 (CORS), SEC-02 (Rate Limit order), TD-18 (Webhook auth)
**Agente:** @sm (River) — draft

---

## Descricao

Corrigir 3 vulnerabilidades de seguranca que sao production blockers:

1. **SEC-01 (CORS):** Em producao, o CORS depende de `ALLOWED_ORIGINS` env var mas o fallback e `FRONTEND_URL || 'http://localhost:5173'` — se nenhuma env var for configurada, qualquer origin pode acessar a API em producao. Precisa rejeitar por padrao (falhar fechado).
2. **SEC-02 (Rate Limit order):** Os rate limiters sao aplicados DEPOIS dos imports de rotas (linha 128-137 em index.ts), mas ANTES dos `app.use('/api/...', routes)` (linhas 169-190). Na pratica, a ordem esta correta porque Express aplica middleware na ordem de registro. Porem, o rate limiting so roda em producao (`NODE_ENV === 'production'`), e o bloco esta isolado — precisamos garantir que rate limiting se aplica antes de CSRF e rotas, e adicionar um limiter basico para dev tambem.
3. **TD-18 (Webhook auth):** As rotas de incoming webhooks (`/api/webhooks/*`) ja possuem validacao de assinatura (Mercado Pago HMAC, WhatsApp signature, API key para capture). As rotas de email webhook (`/email/sendgrid`, `/email/resend`) NAO possuem validacao de assinatura — precisam de validacao.

---

## Acceptance Criteria

### AC-1: CORS Fail-Closed em Producao
- [ ] Em producao, se `ALLOWED_ORIGINS` e `FRONTEND_URL` nao estiverem definidos, CORS rejeita TODAS as origins (nao usa fallback localhost)
- [ ] Em producao, CORS usa apenas `ALLOWED_ORIGINS.split(',')` como lista de origins permitidos
- [ ] Em desenvolvimento, mantem comportamento atual (localhost:5173, 3000, 5174)
- [ ] `ALLOWED_ORIGINS` documentado em `server/.env.example`
- [ ] Teste manual: request de origin nao listado retorna header sem `Access-Control-Allow-Origin`

### AC-2: Rate Limiting Robusto
- [ ] Rate limiters aplicados ANTES de CSRF middleware e route handlers
- [ ] Em desenvolvimento, rate limit existe mas com limites altos (1000 req/15min) em vez de desabilitado (`max: 0`)
- [ ] Log de warning quando rate limit e atingido (ja existe via `message` do express-rate-limit)
- [ ] Rate limit headers presentes em TODAS as respostas (`standardHeaders: true` ja esta configurado)

### AC-3: Webhook Email Signature Validation
- [ ] Endpoint `/api/webhooks/email/sendgrid` valida assinatura SendGrid (Event Webhook Verification Key)
- [ ] Endpoint `/api/webhooks/email/resend` valida assinatura Resend (webhook signing secret via `svix` ou HMAC)
- [ ] Requests sem assinatura valida retornam 401
- [ ] Env vars `SENDGRID_WEBHOOK_VERIFICATION_KEY` e `RESEND_WEBHOOK_SECRET` documentadas em `.env.example`

### AC-4: Testes
- [ ] Teste: request de origin `https://evil.com` em mode producao retorna sem CORS headers
- [ ] Teste: request de origin configurado em `ALLOWED_ORIGINS` retorna com CORS headers corretos
- [ ] Teste: rate limiter bloqueia apos exceder limite (retorna 429)

---

## Dev Notes

### SEC-01: CORS — Estado Atual vs Desejado

**Arquivo:** `server/src/index.ts`, linhas 28-41

**Estado atual (producao):**
```typescript
origin: process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS?.split(',') || [process.env.FRONTEND_URL || 'http://localhost:5173'])
  : [...]
```

**Problema:** Se `ALLOWED_ORIGINS` e `FRONTEND_URL` nao estao definidos, o fallback `'http://localhost:5173'` permite qualquer localhost. E o operador `||` com `FRONTEND_URL` significa que se FRONTEND_URL existir mas ALLOWED_ORIGINS nao, usa FRONTEND_URL como unico origin — ok, mas se NENHUM existir, fallback inseguro.

**Estado desejado:**
```typescript
// Helper para calcular origins
function getAllowedOrigins(): string[] | false {
  if (process.env.NODE_ENV !== 'production') {
    return [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
    ];
  }

  const origins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
  if (origins && origins.length > 0) return origins;

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) return [frontendUrl];

  // Fail closed: no origins configured = reject all
  return false;
}

const corsOrigins = getAllowedOrigins();
```

**Tambem atualizar o `corsOrigins` usado para Socket.IO (linha 30-31) para usar a mesma funcao.**

### SEC-02: Rate Limiting — Estado Atual vs Desejado

**Arquivo:** `server/src/index.ts`, linhas 128-137

**Estado atual:**
```typescript
if (process.env.NODE_ENV === 'production') {
  app.use('/api/auth/password', passwordResetLimiter);
  // ...
  app.use('/api', apiLimiter);
}
```

**Arquivo:** `server/src/middleware/rateLimit.ts`

**Estado atual:** `max: isDevelopment ? 0 : MAX_REQUESTS` — em dev, `max: 0` = sem limite.

**Estado desejado em `rateLimit.ts`:**
```typescript
// Dev: high but not infinite (catches infinite loops, prevents accidental DoS)
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: isDevelopment ? 1000 : MAX_REQUESTS,
  // ...
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 200 : 30,
  // ...
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDevelopment ? 50 : 10,
  // ...
});
```

**Estado desejado em `index.ts`:** Remover o `if (production)` wrapper — aplicar rate limiters sempre, movendo-os para ANTES do bloco de CSRF:

```typescript
// Rate limiting (always active, limits vary by env)
app.use('/api/auth/password', passwordResetLimiter);
app.use('/api/auth', (req, res, next) => {
  if (req.path.startsWith('/password')) return next();
  return authLimiter(req, res, next);
});
app.use('/api/webhooks', apiLimiter);
app.use('/api', apiLimiter);

// CSRF protection (after rate limiting)
app.use('/api/leads', csrfProtection);
// ...
```

### TD-18: Webhook Email Auth — Estado Atual vs Desejado

**Arquivo:** `server/src/routes/webhooks.ts`, linhas 138-164

**Estado atual:** Endpoints `/email/sendgrid` e `/email/resend` NAO validam assinatura:
```typescript
router.post('/email/sendgrid', async (req, res) => {
  // No signature validation!
  emailMessagingService.processWebhook('sendgrid', req.body)...
});
```

**Estado desejado:** Adicionar validacao de assinatura para ambos:

```typescript
// SendGrid: Event Webhook uses ECDSA signature verification
// https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
function validateSendGridSignature(req: Request): boolean {
  const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  if (!verificationKey) {
    logger.warn('SENDGRID_WEBHOOK_VERIFICATION_KEY not configured');
    return false; // Fail closed
  }
  // Implement ECDSA verification per SendGrid docs
  // ...
}

// Resend: uses Svix for webhook signing
// https://resend.com/docs/dashboard/webhooks/introduction
function validateResendSignature(req: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('RESEND_WEBHOOK_SECRET not configured');
    return false; // Fail closed
  }
  // Implement svix-based verification
  // ...
}
```

**Nota:** Os endpoints de Mercado Pago e WhatsApp JA possuem validacao (linhas 11-46 e 98-117) — servem como referencia.

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `server/src/index.ts` | CORS fail-closed, reorder rate limiters, update Socket.IO origins |
| `server/src/middleware/rateLimit.ts` | Dev limits: 0 -> 1000/200/50 |
| `server/src/routes/webhooks.ts` | Add signature validation for SendGrid and Resend |
| `server/.env.example` | Add `ALLOWED_ORIGINS`, `SENDGRID_WEBHOOK_VERIFICATION_KEY`, `RESEND_WEBHOOK_SECRET` |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| CORS quebra frontend em producao | Media | Alto | Documentar ALLOWED_ORIGINS obrigatorio no deploy checklist |
| Rate limit em dev atrapalha testes de carga local | Baixa | Baixo | Limites altos (1000 req) suficientes para dev normal |
| SendGrid/Resend signature libs adicionam dependencias | Media | Baixo | SendGrid usa crypto nativo (ECDSA); Resend pode precisar `svix` package |
| Webhooks existentes param de funcionar se env vars nao configuradas | Media | Alto | Fail-closed com log.warn — operador sabe que precisa configurar |

---

## Estimativa de Esforco

| Tarefa | Estimativa |
|--------|-----------|
| CORS refactor + testes | 1h |
| Rate limit reorder + dev limits | 30min |
| Webhook email signature validation | 1.5h |
| .env.example updates | 15min |
| Testes manuais end-to-end | 30min |
| **Total** | **~3.5h** |

---

*— River, drafting stories for Sprint 1 Phase 1*
*— Data: 2026-03-18*
