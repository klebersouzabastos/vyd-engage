/**
 * Setup global do Vitest — executa antes de cada arquivo de teste.
 *
 * Proteção absoluta: a suíte jamais alcança o banco de PRODUÇÃO (incidente de
 * 03/07/2026 — afterEach de teste de integração apagou dados reais). URLs de
 * produção são neutralizadas antes de qualquer import de código de app; não há
 * override para testes.
 */
import { neutralizeProdDatabaseUrlForTests } from './src/config/dbSafety.js';

neutralizeProdDatabaseUrlForTests();
