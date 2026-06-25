import { describe, it, expect } from 'vitest';
import { extractOutput } from '../../services/deepResearch/deepResearchProvider.js';

describe('extractOutput (Deep Research Responses API)', () => {
  it('extrai o markdown da mensagem e deduplica as fontes (url_citation)', () => {
    const response = {
      status: 'completed',
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'web_search_call' },
        {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: '# Relatório\n\n## Panorama\nTexto.',
              annotations: [
                { type: 'url_citation', url: 'https://exemplo.com/a' },
                { type: 'url_citation', url: 'https://exemplo.com/a' },
                { type: 'url_citation', url: 'https://exemplo.com/b' },
              ],
            },
          ],
        },
      ],
    };
    const { markdown, sources } = extractOutput(response);
    expect(markdown).toContain('# Relatório');
    expect(markdown).toContain('## Panorama');
    expect(sources).toEqual(['https://exemplo.com/a', 'https://exemplo.com/b']);
  });

  it('retorna vazio quando não há mensagem no output', () => {
    expect(extractOutput({ output: [{ type: 'reasoning' }] })).toEqual({
      markdown: '',
      sources: [],
    });
  });

  it('tolera response sem output', () => {
    expect(extractOutput({})).toEqual({ markdown: '', sources: [] });
  });
});
