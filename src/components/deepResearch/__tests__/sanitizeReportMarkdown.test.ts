import { describe, it, expect } from 'vitest';
import { sanitizeReportMarkdown } from '../sanitizeReportMarkdown';

/**
 * Espelho frontend da limpeza de marcadores citeturn (defesa em profundidade
 * na renderização). Deve ter o mesmo comportamento do equivalente no servidor.
 */
describe('sanitizeReportMarkdown', () => {
  it('remove o token citeturn textual e o captura como fonte', () => {
    const { markdown, sources } = sanitizeReportMarkdown(
      'do país. citeturn42search2turn42search4',
    );
    expect(markdown).toBe('do país.');
    expect(sources).toEqual(['citeturn42search2turn42search4']);
  });

  it('remove os delimitadores invisíveis (Private Use Area)', () => {
    const pua = String.fromCharCode(0xe200);
    const { markdown } = sanitizeReportMarkdown(`texto${pua}citeturn3search1${pua} fim`);
    expect(markdown).toBe('texto fim');
  });

  it('remove tokens de navegação soltos', () => {
    const { markdown } = sanitizeReportMarkdown('antes navlist e turn0news2 depois');
    expect(markdown).toBe('antes e depois');
  });

  it('preserva texto e placeholders sem marcadores', () => {
    const { markdown, sources } = sanitizeReportMarkdown('Sobre [EMPRESA] em 2026.');
    expect(markdown).toBe('Sobre [EMPRESA] em 2026.');
    expect(sources).toEqual([]);
  });
});
