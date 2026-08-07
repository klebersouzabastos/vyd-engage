import { describe, it, expect } from 'vitest';
import { avaliarCompletude } from '../../services/deepResearch/completeness.js';

/**
 * Detecção de relatório incompleto QUANDO O PROVEDOR DIZ QUE ESTÁ COMPLETO.
 *
 * Caso real (07/08/2026): template "Empresa" pede 10 capítulos; o relatório
 * gerado parou no capítulo 8, cortado em "…segurança e integridade," — e o
 * OpenRouter reportou `finish_reason: "stop"`. Confiar só no provedor deixaria
 * o usuário com 2 capítulos e a seção de Fontes faltando, sem aviso nenhum.
 */

const PROMPT_10_CAPS = `Objetivo: pesquisa sobre [EMPRESA].

## Estrutura da pesquisa solicitada
### Capítulo 1 — Panorama Geral da Empresa
### Capítulo 2 — Investimentos em Curso e Planejados
### Capítulo 3 — Distribuição de Investimentos por Fase de Projeto
### Capítulo 4 — Maturidade dos Projetos
### Capítulo 5 — Modelo de Contratação e Preferências da Empresa
### Capítulo 6 — Concorrência e Parcerias Estratégicas
### Capítulo 7 — Organograma e Tomadores de Decisão
### Capítulo 8 — Conteúdo Local e Política de Contratação Regional
### Capítulo 9 — Pipeline de Projetos e Oportunidades Futuras
### Capítulo 10 — Estratégias Comerciais Recomendadas
`;

/** Relatório com os N primeiros capítulos, terminando bem ou cortado. */
function relatorio(ateCapitulo: number, cortado = false): string {
  const titulos = [
    'Panorama Geral da Empresa',
    'Investimentos em Curso e Planejados',
    'Distribuição de Investimentos por Fase de Projeto',
    'Maturidade dos Projetos e Janelas de Entrada', // reescrito pelo modelo
    'Modelo de Contratação e Preferências da Empresa',
    'Concorrência e Parcerias Estratégicas',
    'Organograma e Tomadores de Decisão (Situação em 2026)',
    'Conteúdo Local e Política de Contratação Regional',
    'Pipeline de Projetos e Oportunidades Futuras',
    'Estratégias Comerciais Recomendadas',
  ];
  const corpo = titulos
    .slice(0, ateCapitulo)
    .map((t, i) => `## Capítulo ${i + 1} — ${t}\n\nTexto do capítulo.`)
    .join('\n\n');
  return cortado ? `${corpo}\n\nE é fundamental demonstrar aderência a padrões de segurança e integridade,` : corpo;
}

describe('avaliarCompletude', () => {
  it('detecta o caso real: 8 de 10 capítulos e frase cortada', () => {
    const r = avaliarCompletude(PROMPT_10_CAPS, relatorio(8, true));
    expect(r.incompleto).toBe(true);
    expect(r.fraseIncompleta).toBe(true);
    expect(r.faltando).toHaveLength(2);
    expect(r.faltando.join(' ')).toContain('Pipeline');
    expect(r.faltando.join(' ')).toContain('Estratégias Comerciais');
  });

  it('relatório com os 10 capítulos e fecho correto é considerado completo', () => {
    const r = avaliarCompletude(PROMPT_10_CAPS, relatorio(10));
    expect(r.incompleto).toBe(false);
    expect(r.faltando).toEqual([]);
  });

  it('tolera título REESCRITO pelo modelo (não exige texto idêntico)', () => {
    // "Maturidade dos Projetos" virou "…e Janelas de Entrada" no relatório real.
    const r = avaliarCompletude(PROMPT_10_CAPS, relatorio(10));
    expect(r.faltando.join(' ')).not.toContain('Maturidade');
  });

  it('frase cortada sozinha já marca incompleto, mesmo com todos os capítulos', () => {
    const r = avaliarCompletude(PROMPT_10_CAPS, relatorio(10, true));
    expect(r.incompleto).toBe(true);
    expect(r.faltando).toEqual([]);
    expect(r.fraseIncompleta).toBe(true);
  });

  it('fecho em tabela, lista ou negrito conta como término válido', () => {
    for (const fim of ['| a | b |', '- item final.', 'texto em **negrito**', 'citação "assim"']) {
      const r = avaliarCompletude(PROMPT_10_CAPS, `${relatorio(10)}\n\n${fim}`);
      expect(r.fraseIncompleta).toBe(false);
    }
  });

  it('prompt sem outline não acusa nada (não inventa exigência)', () => {
    const r = avaliarCompletude('Escreva um resumo livre sobre a empresa.', 'Um resumo qualquer.');
    expect(r.esperados).toBe(0);
    expect(r.incompleto).toBe(false);
  });
});
