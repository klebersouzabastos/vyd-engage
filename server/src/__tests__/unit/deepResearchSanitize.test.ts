import { describe, it, expect } from 'vitest';
import { sanitizeMarkdown } from '../../services/deepResearch/sanitizeMarkdown.js';

/**
 * Limpeza determinística do markdown colado do ChatGPT (Deep Research).
 * Remove os marcadores de citação da UI (forma textual + delimitadores
 * invisíveis da Private Use Area) e captura os tokens como fontes.
 */
describe('sanitizeMarkdown', () => {
  it('remove o token citeturn textual e o captura como fonte', () => {
    const { markdown, sources } = sanitizeMarkdown(
      'do país. citeturn42search2turn42search4turn17search4',
    );
    expect(markdown).toBe('do país.');
    expect(sources).toEqual(['citeturn42search2turn42search4turn17search4']);
  });

  it('remove os delimitadores invisíveis da Private Use Area', () => {
    const pua = String.fromCharCode(0xe200);
    const { markdown } = sanitizeMarkdown(`texto${pua}citeturn3search1${pua} fim`);
    expect(markdown).not.toContain(pua);
    expect(markdown).not.toMatch(/cite/);
    expect(markdown).toBe('texto fim');
  });

  it('remove tokens de navegação soltos (navlist, turn0news2)', () => {
    const { markdown } = sanitizeMarkdown('antes navlist e turn0news2 depois');
    expect(markdown).toBe('antes e depois');
  });

  it('deduplica as fontes capturadas', () => {
    const { sources } = sanitizeMarkdown('a citeturn3search1 b citeturn3search1');
    expect(sources).toEqual(['citeturn3search1']);
  });

  it('preserva texto sem marcadores e placeholders [EMPRESA]', () => {
    const { markdown, sources } = sanitizeMarkdown('Pesquisa sobre [EMPRESA] em 2026.');
    expect(markdown).toBe('Pesquisa sobre [EMPRESA] em 2026.');
    expect(sources).toEqual([]);
  });

  it('preserva tabelas markdown (pipes) ao remover citações na célula', () => {
    const { markdown } = sanitizeMarkdown('| Vale | Muito alta citeturn21search12 |');
    expect(markdown).toBe('| Vale | Muito alta |');
  });

  it('é idempotente', () => {
    const once = sanitizeMarkdown('x citeturn3search1 y').markdown;
    const twice = sanitizeMarkdown(once).markdown;
    expect(twice).toBe(once);
  });

  it('trata entrada vazia/undefined sem lançar', () => {
    expect(sanitizeMarkdown('').markdown).toBe('');
    expect(sanitizeMarkdown(undefined as unknown as string).markdown).toBe('');
  });
});
