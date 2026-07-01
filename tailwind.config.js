// Tailwind v4 lê este config via `@config` em src/styles/globals.css.
// Opção A da spec design-system-migration: carrega o preset do vyd-design-system
// (cores + tipografia + espaçamento + radius — decisão do arquiteto: visual completo do DS).
// O preset é v3-style (theme.extend com refs var(--vyd-*)); o app TAMBÉM importa
// vyd-design-system/theme.css (em globals.css) para essas vars resolverem.
const vyd = require('vyd-design-system/tailwind');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [vyd],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx,html}'],
};
