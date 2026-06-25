import { describe, it, expect } from 'vitest';
import {
  extractPlaceholders,
  applyPlaceholders,
  extractOutline,
  buildPrompt,
} from '../../services/deepResearch/promptUtils.js';

describe('promptUtils', () => {
  it('extractPlaceholders: únicos, na ordem, ignora links', () => {
    expect(extractPlaceholders('sobre [EMPRESA] no [SETOR] e [EMPRESA] veja [x](y)')).toEqual([
      'EMPRESA',
      'SETOR',
    ]);
  });

  it('applyPlaceholders: substitui preenchidos e mantém vazios', () => {
    expect(applyPlaceholders('[EMPRESA] em [ANO]', { EMPRESA: 'ACME' })).toBe('ACME em [ANO]');
  });

  it('extractOutline: pega capítulos e remove prefixo, pula seções estruturais', () => {
    const md =
      'Objetivo: x\n\n## Estrutura da pesquisa solicitada\n\n### Capítulo 1 — Panorama Geral\n\n### Capítulo 2 — Investimentos\n\n## Instruções de formatação da saída';
    expect(extractOutline(md)).toEqual(['Panorama Geral', 'Investimentos']);
  });

  it('buildPrompt: aplica valores e anexa contexto adicional', () => {
    const p = buildPrompt('Pesquise [EMPRESA]', { EMPRESA: 'ACME' }, 'foco em 2026');
    expect(p).toContain('ACME');
    expect(p).toContain('Contexto adicional');
    expect(p).toContain('foco em 2026');
  });

  it('buildPrompt: sem contexto não adiciona seção', () => {
    expect(buildPrompt('[EMPRESA]', { EMPRESA: 'X' })).toBe('X');
  });
});
