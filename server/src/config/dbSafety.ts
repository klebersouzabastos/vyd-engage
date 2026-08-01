/**
 * Guarda de segurança contra escrita acidental no banco de PRODUÇÃO.
 *
 * Contexto: o server/.env local aponta para o Postgres de produção no Railway
 * (incidente de 03/07/2026 — testes de integração rodados localmente apagaram
 * dados de produção). Este módulo é a rede de segurança em código:
 *
 *  - Testes (vitest.setup.ts): SEMPRE bloqueados contra URL de produção, sem
 *    override — teste de integração contra prod nunca é legítimo.
 *  - Seed demo (prisma/seed.ts): SEED_DEMO bloqueado contra prod, sem override
 *    (criaria usuários demo com senha fraca em produção).
 *  - Scripts mutadores (server/scripts/*): exigem opt-in explícito via
 *    ALLOW_PROD_DB=true quando a URL é de produção.
 *
 * O servidor da aplicação NÃO passa por esta guarda (em produção ele conecta
 * no banco de produção por definição); database.ts apenas loga um aviso quando
 * NODE_ENV=development com URL de produção.
 */
import dotenv from 'dotenv';

// Idempotente e não sobrescreve variáveis já definidas — garante que a guarda
// enxergue o mesmo DATABASE_URL que o Prisma vai usar, independente da ordem
// de imports do chamador.
dotenv.config();

/** Padrões de host que identificam o Postgres de produção (Railway). */
const PROD_URL_PATTERNS = [/\brlwy\.net\b/i, /\brailway\.internal\b/i, /\brailway\.app\b/i];

export function isProductionDatabaseUrl(url: string = process.env.DATABASE_URL ?? ''): boolean {
  return PROD_URL_PATTERNS.some((p) => p.test(url));
}

/**
 * Bloqueia scripts/operações mutadoras contra produção, a menos que o operador
 * declare intenção explícita com ALLOW_PROD_DB=true no ambiente.
 */
export function assertNotProdDatabase(context: string): void {
  if (!isProductionDatabaseUrl()) return;
  if (process.env.ALLOW_PROD_DB === 'true') {
    // eslint-disable-next-line no-console
    console.warn(
      `[dbSafety] ${context}: DATABASE_URL aponta para PRODUÇÃO e ALLOW_PROD_DB=true — prosseguindo sob responsabilidade do operador.`
    );
    return;
  }
  throw new Error(
    `[dbSafety] ${context} bloqueado: DATABASE_URL aponta para o banco de PRODUÇÃO (Railway). ` +
      `Se a intenção é realmente atingir produção, re-execute com ALLOW_PROD_DB=true no ambiente. ` +
      `Para trabalhar localmente, aponte DATABASE_URL para um Postgres local no server/.env.`
  );
}

/**
 * Proteção absoluta dos testes (sem override): se DATABASE_URL aponta para
 * produção, a URL é SUBSTITUÍDA por um endereço inerte antes de qualquer
 * import de código de app. Os testes unitários (mockados) continuam rodando;
 * qualquer conexão real acidental falha em localhost morto em vez de tocar
 * produção (incidente de 03/07/2026).
 */
export function neutralizeProdDatabaseUrlForTests(): void {
  if (isProductionDatabaseUrl()) {
    // eslint-disable-next-line no-console
    console.warn(
      '[dbSafety] DATABASE_URL de PRODUÇÃO detectada na suíte de testes — substituída por URL inerte. ' +
        'Testes que precisarem de banco real devem apontar para um Postgres local/descartável.'
    );
    process.env.DATABASE_URL = 'postgresql://blocked:blocked@127.0.0.1:9/tests_blocked_by_prod_guard';
  }
}
