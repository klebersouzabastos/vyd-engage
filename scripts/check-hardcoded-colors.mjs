#!/usr/bin/env node
/**
 * check-hardcoded-colors.mjs — Gate de 0 cor codificada (spec design-system-migration, Fase 8).
 *
 * Proíbe cores hardcoded em src/**\/*.{ts,tsx,css}:
 *   - hex 3/4/6/8 dígitos (#fff, #ffff, #ffffff, #ffffffff)
 *   - rgb()/rgba()/hsl()/hsla() com literais (var(...) é permitido; color-mix é permitido)
 *
 * Toda cor deve ser token do DS: var(--vyd-*) / classe .vyd-* / utilitário do preset.
 *
 * Escapes (cada um exige justificativa):
 *   - ALLOWLIST_FILES: arquivos self-contained (PDF/Excel/e-mail), seletores internos
 *     de libs, dados do usuário e mocks de teste — não podem usar var(--vyd-*).
 *   - Comentário `gate-allow` na MESMA linha: escape pontual (ex.: color-picker do tenant).
 *
 * Uso: node scripts/check-hardcoded-colors.mjs  → exit(1) se achar violação fora dos escapes.
 * Cross-platform (Node puro, sem deps).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

// Allowlist central de ARQUIVOS (caminho relativo com "/") + justificativa obrigatória.
const ALLOWLIST_FILES = {
  'src/utils/reportExport.ts':
    'Documento self-contained (PDF via print + Excel via ExcelJS ARGB); não carrega theme.css, usa REPORT_PALETTE (hex resolvidos do DS).',
  'src/components/email/GrapesEmailBuilder.tsx':
    'E-mail HTML exige cor inline literal (clientes de e-mail não suportam var()); usa EMAIL_PALETTE (hex resolvidos do DS).',
  'src/components/ui/chart.tsx':
    "Os hex (#ccc/#fff) são SELETORES de atributo que casam com a saída interna do Recharts ([stroke='#ccc']); não são cores aplicadas.",
  'src/test/handlers.ts': 'Mock de teste (MSW); não é UI de produção.',
};

// Extensões escaneadas.
const EXTS = new Set(['.ts', '.tsx', '.css']);
// Arquivos ignorados (artefato pré-compilado descontinuado).
const IGNORE_FILES = new Set(['src/index.css']);

// hex 3/4/6/8 dígitos. (?<!&) exclui entidades HTML numéricas (&#123; = "{").
const HEX = /(?<!&)#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;
// rgb()/rgba()/hsl()/hsla() NÃO seguidos de var( — literais proibidos (color-mix é permitido).
const FUNC = /\b(?:rgba?|hsla?)\(\s*(?!var\()/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'build' || name === 'dist') continue;
      out.push(...walk(full));
    } else {
      const ext = name.slice(name.lastIndexOf('.'));
      if (EXTS.has(ext)) out.push(full);
    }
  }
  return out;
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (IGNORE_FILES.has(rel)) continue;
  if (ALLOWLIST_FILES[rel]) continue;

  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('gate-allow')) return; // escape pontual por linha
    if (HEX.test(line) || FUNC.test(line)) {
      const m = line.match(HEX) || line.match(FUNC);
      violations.push({ rel, line: i + 1, text: line.trim().slice(0, 100), match: m[0] });
    }
  });
}

if (violations.length > 0) {
  console.error(`\n✗ Cores codificadas encontradas (${violations.length}) fora da allowlist:\n`);
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  →  ${v.match}   | ${v.text}`);
  }
  console.error(
    '\nUse tokens do DS (var(--vyd-*) / classe .vyd-*). Para casos legítimos ' +
      '(documento self-contained, dado do usuário), adicione à ALLOWLIST_FILES com ' +
      'justificativa ou um comentário `gate-allow` na linha.\n'
  );
  process.exit(1);
}

console.log('✓ check:colors — 0 cor codificada fora da allowlist.');

// Imprime a allowlist para auditoria/transparência.
const n = Object.keys(ALLOWLIST_FILES).length;
console.log(`  (allowlist: ${n} arquivo(s) justificado(s) + escapes \`gate-allow\` por linha)`);
