// Pure constants and utilities for tags (localStorage removed)

// Paleta padrão de cores de tag → dataviz do vyd-design-system (var(--vyd-*)).
// São refs CSS: renderizam como cor tanto em swatch quanto salvas na tag, e
// acompanham o tema. O DS é uma paleta blueprint sóbria (6 categóricas + 5
// sequenciais); as 10 opções abaixo priorizam as categóricas (mais distintas).
export const TAG_COLORS = [
  'var(--vyd-viz-1)', // azul
  'var(--vyd-viz-4)', // verde
  'var(--vyd-viz-3)', // âmbar
  'var(--vyd-viz-5)', // vermelho
  'var(--vyd-viz-2)', // teal
  'var(--vyd-viz-6)', // neutro
  'var(--vyd-viz-seq-2)', // azul claro
  'var(--vyd-viz-seq-3)', // blueprint
  'var(--vyd-viz-seq-4)', // azul escuro
  'var(--vyd-viz-seq-5)', // azul profundo
];
