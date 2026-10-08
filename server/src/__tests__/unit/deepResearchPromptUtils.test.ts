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

  // Bug real: o apêndice "## Contexto adicional informado" (e qualquer "##" que
  // o usuário cole dentro dele) entrava no outline como capítulo esperado — o
  // detector de completude cobrava uma seção que o modelo nunca escreveria e
  // disparava continuações pagas à toa.
  it('extractOutline: ignora o apêndice de contexto e os títulos colados pelo usuário', () => {
    const tpl =
      'Objetivo: x\n\n## Estrutura da pesquisa\n\n### Capítulo 1 — Panorama\n\n### Capítulo 2 — Investimentos';
    const comContexto = buildPrompt(tpl, {}, 'Foco em lítio.\n\n## Minha observação\ntexto livre');
    expect(extractOutline(comContexto)).toEqual(extractOutline(tpl));
  });

  it('buildPrompt: anexa o bloco de experiências depois do contexto, e o outline o ignora', () => {
    const tpl = '## Estrutura\n\n### Capítulo 1 — Panorama';
    const bloco = '## Experiências da consultoria (TENAX)\n- Vale — Projeto básico (2025)';
    const p = buildPrompt(tpl, {}, 'foco em 2026', bloco);
    expect(p).toContain('## Contexto adicional informado\nfoco em 2026');
    expect(p.endsWith(bloco)).toBe(true);
    expect(p.indexOf('Contexto adicional')).toBeLessThan(p.indexOf('Experiências da consultoria'));
    expect(extractOutline(p)).toEqual(['Panorama']);
  });
});
