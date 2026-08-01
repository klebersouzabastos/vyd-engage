/**
 * Wrapper da CLI do Prisma com a guarda anti-prod (dbSafety).
 *
 * A CLI (`prisma migrate dev`, `migrate reset`, `db push`) não executa código
 * do projeto antes de conectar — com server/.env apontando para PRODUÇÃO, um
 * `npm run prisma:migrate` distraído rodaria `migrate dev` contra prod (que em
 * divergência de histórico propõe RESET do banco). Este wrapper aplica
 * assertNotProdDatabase() antes de delegar; ALLOW_PROD_DB=true libera.
 *
 * Uso: tsx scripts/prisma-guarded.ts <args da CLI>  (ex.: migrate dev)
 */
import { spawnSync } from 'child_process';
import { assertNotProdDatabase } from '../src/config/dbSafety.js';

const args = process.argv.slice(2);
assertNotProdDatabase(`prisma ${args.join(' ')}`);

const result = spawnSync('npx', ['prisma', ...args], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
