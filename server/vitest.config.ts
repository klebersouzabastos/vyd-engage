import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

// Guarda anti-prod (incidente de 03/07/2026): quando a DATABASE_URL do
// ambiente aponta para o Postgres de produção (Railway), os testes de
// integração (src/__tests__/*.test.ts, que criam/apagam registros reais)
// são EXCLUÍDOS da suíte. Os unitários (mockados) rodam normalmente.
// Complementa o vitest.setup.ts, que neutraliza a URL para todo o resto.
loadEnv();
const dbIsProd = /\brlwy\.net\b|\brailway\.internal\b|\brailway\.app\b/i.test(
  process.env.DATABASE_URL ?? ''
);
if (dbIsProd) {
  // eslint-disable-next-line no-console
  console.warn(
    '[dbSafety] DATABASE_URL de PRODUÇÃO — testes de integração (src/__tests__/*.test.ts) excluídos da suíte. ' +
      'Aponte para um Postgres local/descartável para rodá-los.'
  );
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Guarda anti-prod: neutraliza DATABASE_URL de produção antes dos testes.
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      ...(dbIsProd ? ['src/__tests__/*.test.ts'] : []),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
