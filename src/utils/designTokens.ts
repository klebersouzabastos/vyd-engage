/**
 * Design Token Constants
 *
 * Maps semantic concepts (status, priority, score, stage, chart colors) to
 * CSS custom-property references defined in `src/styles/globals.css`.
 *
 * Usage in JS/TS (e.g. Recharts `fill` / `stroke` props):
 *   import { CHART_COLORS, SOURCE_COLORS } from "@/utils/designTokens";
 *   <Cell fill={SOURCE_COLORS.meta} />
 *
 * For className-based styling prefer the `.badge-*` utility classes
 * defined in globals.css.
 */

// ── Chart palette (for Recharts / inline style props) ──
export const CHART_COLORS = {
  blue: 'var(--color-chart-blue)',
  red: 'var(--color-chart-red)',
  green: 'var(--color-chart-green)',
  yellow: 'var(--color-chart-yellow)',
  orange: 'var(--color-chart-orange)',
  purple: 'var(--color-chart-purple)',
  pink: 'var(--color-chart-pink)',
  indigo: 'var(--color-chart-indigo)',
  gray: 'var(--color-chart-gray)',
} as const;

/** Ordered palette array for pie/bar charts that need N colors */
export const CHART_PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.yellow,
  CHART_COLORS.green,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
  CHART_COLORS.indigo,
] as const;

// ── Lead source → chart color ──
export const SOURCE_COLORS: Record<string, string> = {
  meta: CHART_COLORS.blue,
  google: CHART_COLORS.red,
  organico: CHART_COLORS.green,
  manual: CHART_COLORS.gray,
};

// ── Automation type → chart color ──
export const AUTOMATION_TYPE_COLORS: Record<string, string> = {
  whatsapp: CHART_COLORS.green,
  email: CHART_COLORS.blue,
};

// ── Task priority → chart color ──
export const PRIORITY_CHART_COLORS: Record<string, string> = {
  LOW: CHART_COLORS.green,
  MEDIUM: CHART_COLORS.yellow,
  HIGH: CHART_COLORS.red,
  URGENT: CHART_COLORS.purple,
};

// ── Deal stage accent (inline style usage, e.g. header bars) ──
export const STAGE_ACCENT_COLORS: Record<string, string> = {
  QUALIFICATION: 'var(--color-stage-qualification-accent)',
  PROPOSAL: 'var(--color-stage-proposal-accent)',
  NEGOTIATION: 'var(--color-stage-negotiation-accent)',
  CLOSING: 'var(--color-stage-closing-accent)',
  WON: 'var(--color-stage-won-accent)',
  LOST: 'var(--color-stage-lost-accent)',
};

// ── Primary color token (for line/area charts) ──
export const PRIMARY_COLOR = 'var(--color-primary)';
