import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const isDevelopment = process.env.NODE_ENV === 'development';
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

/**
 * IP real do usuário, nesta topologia específica.
 *
 * O frontend fala com `engage.vydhub.com` e a Vercel proxia `/api` até aqui
 * (rewrite no `vercel.json`). Nesse caminho o `req.ip` do Express é o IP da
 * INFRAESTRUTURA, não o do usuário — e `app.set('trust proxy', N)` NÃO resolve,
 * seja qual for o N, porque a Vercel não coloca o cliente no `X-Forwarded-For`.
 * Medido num request real: `x-forwarded-for: "56.125.190.173, 152.233.47.68"`
 * (dois IPs de infra) enquanto o cliente, `186.248.207.190`, aparece só em
 * `x-vercel-forwarded-for`.
 *
 * Consequência de não corrigir: o balde de 100 req/15min é UM SÓ para o app
 * inteiro, compartilhado por todos os usuários. Não estava estourando quando
 * medimos (98/100 livres), mas o tempo real religado aumenta as invalidações
 * de cache e, portanto, as chamadas REST.
 */
export function ipDoCliente(req: Request): string {
  const daVercel = req.get('x-vercel-forwarded-for');
  if (daVercel) return daVercel.split(',')[0].trim();
  return req.ip || 'anonymous';
}

// Dev: high limits to avoid blocking during testing (catches infinite loops / accidental DoS)
// Production: strict limits enforced normally
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: isDevelopment ? 1000 : MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipDoCliente,
});

/**
 * ATENÇÃO — assimetria deliberada: os dois limiters abaixo NÃO usam
 * `ipDoCliente`, e isso não é esquecimento.
 *
 * `x-vercel-forwarded-for` é confiável no caminho normal, mas o domínio do
 * Railway é publicamente alcançável, então quem for direto nele forja o header
 * à vontade. Para o `apiLimiter` a troca compensa: ele protege DISPONIBILIDADE,
 * e um balde único para o app inteiro machuca usuário legítimo todo dia,
 * enquanto o atacante já contorna qualquer limite por IP só trocando de IP.
 *
 * Aqui é o oposto. Estes protegem CONTRA FORÇA BRUTA de senha, e chave
 * falsificável significaria tentativas ilimitadas — pior que o balde
 * compartilhado de hoje, que no máximo é rígido demais. Só passe estes para
 * `ipDoCliente` depois de restringir a entrada do Railway a vir só da Vercel.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 200 : 30,
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 50 : 10,
  message: 'Too many password reset requests, please try again later.',
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});

// Dedicated limiter for data imports: 5 imports per hour PER TENANT.
// Keyed by tenantId (not IP) — must run after `authenticate`/`tenantScope`.
export const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 100 : 5,
  message: 'Too many imports, please try again later. Limit is 5 per hour.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.tenantId || req.ip || 'anonymous',
  // Only count actual import submissions, not history/status reads.
  skip: (req) => req.method === 'GET',
});

// Dedicated limiter for AI Sales Assistant calls: 30 calls per minute PER TENANT
// (cost control, spec req 32). Keyed by tenantId — must run after
// `authenticate`/`tenantScope`. On limit, express-rate-limit returns HTTP 429.
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? 1000 : 30,
  message: {
    status: 429,
    error: 'Limite de chamadas de IA atingido (30/min). Tente novamente em instantes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.tenantId || req.ip || 'anonymous',
});
