#!/usr/bin/env node
/**
 * Build da extensão VYD Engage (req 24) — standalone, NÃO depende do build do app.
 *
 * Empacota os 3 bundles (content-script, service-worker, popup) com esbuild e
 * copia os assets estáticos (manifest.json, popup.html, icons/) para extension/dist/.
 * O resultado em dist/ é a extensão descompactada pronta p/ "Carregar sem
 * compactação" no Chrome (chrome://extensions) e p/ empacotar (zip) na Web Store.
 *
 * Uso:
 *   node build.mjs           # build único
 *   node build.mjs --watch   # rebuild ao salvar
 *   node build.mjs --zip     # build + gera vyd-engage-extension.zip
 *
 * esbuild é resolvido do node_modules do repositório (dependência transitiva do
 * Vite). Se rodar isolado, faça `npm i -D esbuild` dentro de extension/.
 */
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const SRC = join(ROOT, 'src');

const args = new Set(process.argv.slice(2));
const WATCH = args.has('--watch');
const ZIP = args.has('--zip');

const ENTRIES = {
  'content-script': join(SRC, 'content-script.ts'),
  'service-worker': join(SRC, 'service-worker.ts'),
  popup: join(SRC, 'popup.ts'),
};

const buildOptions = {
  entryPoints: ENTRIES,
  outdir: DIST,
  bundle: true,
  format: 'esm',
  target: ['chrome110'],
  platform: 'browser',
  sourcemap: WATCH ? 'inline' : false,
  minify: !WATCH,
  logLevel: 'info',
};

function copyStatic() {
  mkdirSync(DIST, { recursive: true });
  cpSync(join(ROOT, 'manifest.json'), join(DIST, 'manifest.json'));
  cpSync(join(ROOT, 'popup.html'), join(DIST, 'popup.html'));
  const icons = join(ROOT, 'icons');
  if (existsSync(icons)) cpSync(icons, join(DIST, 'icons'), { recursive: true });
}

function zipDist() {
  const out = join(ROOT, 'vyd-engage-extension.zip');
  if (existsSync(out)) rmSync(out);
  try {
    // PowerShell Compress-Archive (Windows) — sem deps externas.
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${join(DIST, '*')}' -DestinationPath '${out}' -Force`,
      ],
      { stdio: 'inherit' }
    );
    console.log(`\n✓ Pacote gerado: ${out}`);
  } catch {
    console.warn(
      '\n! Não foi possível zipar automaticamente. Compacte o conteúdo de dist/ manualmente.'
    );
  }
}

async function run() {
  if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  copyStatic();

  if (WATCH) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log('\n👀 Watch ativo — editando src/ recompila. Ctrl+C para sair.');
    return;
  }

  await build(buildOptions);
  console.log('\n✓ Extensão compilada em dist/ (carregue sem compactação no Chrome).');
  if (ZIP) zipDist();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
