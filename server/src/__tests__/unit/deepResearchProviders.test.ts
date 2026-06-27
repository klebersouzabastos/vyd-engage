import { describe, it, expect } from 'vitest';
import { parsePerplexity } from '../../services/deepResearch/providers/perplexity.js';
import { applyChunk } from '../../services/deepResearch/providers/openrouter.js';

describe('parsePerplexity', () => {
  it('extrai markdown, fontes e search_results (título/url/data)', () => {
    const data = {
      choices: [{ message: { content: '# Relatório\n\n## Panorama\nTexto [1].' } }],
      citations: ['https://a.com', 'https://b.com'],
      search_results: [
        { title: 'A', url: 'https://a.com', date: '2026-01-01' },
        { title: 'B', url: 'https://b.com' },
      ],
    };
    const { markdown, sources, searchResults } = parsePerplexity(data);
    expect(markdown).toContain('# Relatório');
    expect(sources).toEqual(['https://a.com', 'https://b.com']);
    expect(searchResults).toHaveLength(2);
    expect(searchResults[0]).toEqual({ title: 'A', url: 'https://a.com', date: '2026-01-01' });
  });

  it('usa citations quando não há search_results', () => {
    const { sources, searchResults } = parsePerplexity({
      choices: [{ message: { content: 'x' } }],
      citations: ['https://c.com'],
    });
    expect(sources).toEqual(['https://c.com']);
    expect(searchResults).toEqual([]);
  });

  it('lê também de response aninhado', () => {
    const { markdown } = parsePerplexity({
      response: { choices: [{ message: { content: 'aninhado' } }] },
    });
    expect(markdown).toBe('aninhado');
  });
});

describe('applyChunk (stream OpenRouter)', () => {
  it('acumula content e captura search_results', () => {
    const acc = { markdown: '', citations: [] as string[], searchResults: [] as any[] };
    applyChunk({ choices: [{ delta: { content: 'Olá ' } }] }, acc);
    applyChunk({ choices: [{ delta: { content: 'mundo' } }] }, acc);
    applyChunk({ search_results: [{ title: 'X', url: 'https://x.com', date: '2026' }] }, acc);
    expect(acc.markdown).toBe('Olá mundo');
    expect(acc.searchResults).toEqual([{ title: 'X', url: 'https://x.com', date: '2026' }]);
  });

  it('captura citations e ignora delta sem content', () => {
    const acc = { markdown: '', citations: [] as string[], searchResults: [] as any[] };
    applyChunk({ choices: [{ delta: {} }], citations: ['https://y.com'] }, acc);
    expect(acc.markdown).toBe('');
    expect(acc.citations).toEqual(['https://y.com']);
  });

  it('acumula annotations url_citation incrementais e deduplica (formato real do stream)', () => {
    const acc = { markdown: '', citations: [] as string[], searchResults: [] as any[] };
    const chunk = (url: string, title: string) => ({
      choices: [
        { delta: { annotations: [{ type: 'url_citation', url_citation: { url, title } }] } },
      ],
    });
    applyChunk(chunk('https://a.com', 'A'), acc);
    applyChunk(chunk('https://b.com', 'B'), acc);
    applyChunk(chunk('https://a.com', 'A'), acc); // duplicada → ignorada
    expect(acc.searchResults).toEqual([
      { title: 'A', url: 'https://a.com', date: undefined },
      { title: 'B', url: 'https://b.com', date: undefined },
    ]);
  });
});
