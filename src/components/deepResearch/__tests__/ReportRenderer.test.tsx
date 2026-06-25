import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ReportRenderer } from '../ReportRenderer';
import { extractToc } from '../extractToc';

/**
 * Smoke da renderização markdown -> site: tabelas GFM viram <table>, títulos
 * ganham id de âncora e nenhum conteúdo perigoso (script/href javascript:)
 * sobrevive à sanitização (rehype-sanitize).
 */
describe('ReportRenderer', () => {
  it('renderiza tabela GFM como <table> com células', () => {
    const md = '| Empresa | Score |\n|---|---|\n| ACME | Alto |';
    const { container } = render(<ReportRenderer markdown={md} />);
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('td').length).toBe(2);
  });

  it('adiciona id de âncora aos títulos (para o sumário)', () => {
    const { container } = render(<ReportRenderer markdown={'## Capítulo Um'} />);
    expect(container.querySelector('h2')?.id).toBeTruthy();
  });

  it('gera ids sem prefixo user-content- e em sincronia com o sumário', () => {
    // Regressão: o defaultSchema do rehype-sanitize prefixa ids com
    // "user-content-"; sem clobberPrefix:'' as âncoras do sumário quebram.
    const md = '## Panorama do Segmento\n\n## Panorama do Segmento\n\ntexto';
    const { container } = render(<ReportRenderer markdown={md} />);
    const domIds = Array.from(container.querySelectorAll('h2')).map((h) => h.id);
    const tocIds = extractToc(md).map((t) => t.id);
    expect(domIds).toEqual(tocIds);
    expect(domIds.every((id) => !id.startsWith('user-content-'))).toBe(true);
  });

  it('não cria elemento <script> a partir de HTML inline (XSS)', () => {
    const { container } = render(
      <ReportRenderer markdown={'Texto seguro.\n\n<script>alert(1)</script>'} />,
    );
    expect(container.querySelector('script')).toBeNull();
  });

  it('não mantém href javascript: em links', () => {
    const { container } = render(
      <ReportRenderer markdown={'[clique](javascript:alert(1))'} />,
    );
    const href = container.querySelector('a')?.getAttribute('href') ?? '';
    expect(href).not.toContain('javascript:');
  });

  it('abre links externos com rel de segurança', () => {
    const { container } = render(
      <ReportRenderer markdown={'[site](https://exemplo.com)'} />,
    );
    const a = container.querySelector('a');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel') ?? '').toContain('noopener');
  });
});
