import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportViewer } from './ReportViewer';

vi.mock('../../contexts/CompanyContext', () => ({
  useCompany: () => ({ companyName: 'K2+ Engenharia', logo: null }),
}));

beforeAll(() => {
  // jsdom não implementa scrollIntoView; o viewer o chama ao trocar de página.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const MD = [
  '# Vale S.A.',
  '',
  'Resumo executivo aqui.',
  '',
  '## Panorama',
  '',
  'Texto do panorama.',
  '',
  '## Investimentos',
  '',
  'Texto de investimentos.',
].join('\n');

const renderViewer = () =>
  render(
    <ReportViewer
      markdown={MD}
      title="Vale S.A."
      templateName="Empresa"
      updatedAt="2026-06-26T00:00:00.000Z"
      searchResults={[]}
      sourceCount={0}
    />,
  );

describe('ReportViewer', () => {
  beforeEach(() => localStorage.clear());

  it('abre na capa (Apresentação) com identidade do tenant e CTA', () => {
    const { container } = renderViewer();
    expect(container.querySelector('.report-cover__company')?.textContent).toContain(
      'K2+ Engenharia',
    );
    expect(screen.getByText('O que este relatório aborda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Começar a leitura/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apresentação/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Leitura/ })).toBeInTheDocument();
    // Na capa, "Anterior" está desabilitado.
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled();
  });

  it('pagina com Próximo: capa → visão geral → seção (com rótulo)', () => {
    renderViewer();
    const next = () => fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
    next();
    expect(screen.getByText('Resumo executivo aqui.')).toBeInTheDocument();
    next();
    expect(screen.getByText('Texto do panorama.')).toBeInTheDocument();
    expect(screen.getAllByText('Seção 1 de 2').length).toBeGreaterThan(0);
  });

  it('progressbar avança ao navegar', () => {
    renderViewer();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  });

  it('alterna para Leitura, persiste e mostra todas as seções no scroll', () => {
    renderViewer();
    fireEvent.click(screen.getByRole('button', { name: /Leitura/ }));
    expect(localStorage.getItem('vyd.reportViewer.mode')).toBe('leitura');
    expect(screen.getByText('Texto do panorama.')).toBeInTheDocument();
    expect(screen.getByText('Texto de investimentos.')).toBeInTheDocument();
  });
});
