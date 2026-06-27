import { describe, it, expect } from 'vitest';
import { extractPlaceholders, applyPlaceholders, unfilledPlaceholders } from '../placeholders';

describe('extractPlaceholders', () => {
  it('extrai placeholders únicos na ordem de aparição', () => {
    expect(extractPlaceholders('Sobre [EMPRESA] e [SEGMENTO] e [EMPRESA].')).toEqual([
      'EMPRESA',
      'SEGMENTO',
    ]);
  });

  it('ignora links markdown [texto](url)', () => {
    expect(extractPlaceholders('veja [aqui](http://x) e [EMPRESA]')).toEqual(['EMPRESA']);
  });

  it('exige ao menos uma letra (ignora [123])', () => {
    expect(extractPlaceholders('[123] e [A1]')).toEqual(['A1']);
  });

  it('aceita acentos e espaços', () => {
    expect(extractPlaceholders('[MINERAIS CRÍTICOS]')).toEqual(['MINERAIS CRÍTICOS']);
  });
});

describe('applyPlaceholders', () => {
  it('substitui os valores preenchidos e mantém os vazios', () => {
    expect(applyPlaceholders('Sobre [EMPRESA] em [ANO]', { EMPRESA: 'ACME' })).toBe(
      'Sobre ACME em [ANO]'
    );
  });

  it('não altera texto sem placeholders', () => {
    expect(applyPlaceholders('texto puro', { X: 'y' })).toBe('texto puro');
  });
});

describe('unfilledPlaceholders', () => {
  it('lista apenas os placeholders ainda sem valor', () => {
    expect(unfilledPlaceholders('[A] e [B]', { A: 'x' })).toEqual(['B']);
  });

  it('retorna vazio quando todos preenchidos', () => {
    expect(unfilledPlaceholders('[A]', { A: 'x' })).toEqual([]);
  });
});
