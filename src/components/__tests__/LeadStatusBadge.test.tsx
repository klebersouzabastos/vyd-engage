import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeadStatusBadge } from '../LeadStatusBadge';

describe('LeadStatusBadge', () => {
  it('should render "Novo" for status "novo"', () => {
    render(<LeadStatusBadge status="novo" />);
    expect(screen.getByText('Novo')).toBeInTheDocument();
  });

  it('should render "Em Contato" for status "contato"', () => {
    render(<LeadStatusBadge status="contato" />);
    expect(screen.getByText('Em Contato')).toBeInTheDocument();
  });

  it('should render "Fechado" for status "fechado"', () => {
    render(<LeadStatusBadge status="fechado" />);
    expect(screen.getByText('Fechado')).toBeInTheDocument();
  });

  it('should render "Perdido" for status "perdido"', () => {
    render(<LeadStatusBadge status="perdido" />);
    expect(screen.getByText('Perdido')).toBeInTheDocument();
  });

  it('should normalize "em contato" to "Em Contato"', () => {
    render(<LeadStatusBadge status="em contato" />);
    expect(screen.getByText('Em Contato')).toBeInTheDocument();
  });

  it('should normalize "em_contato" to "Em Contato"', () => {
    render(<LeadStatusBadge status="em_contato" />);
    expect(screen.getByText('Em Contato')).toBeInTheDocument();
  });

  it('should fallback to raw status for unknown values', () => {
    render(<LeadStatusBadge status="CustomStatus" />);
    expect(screen.getByText('CustomStatus')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for known statuses', () => {
    const { container } = render(<LeadStatusBadge status="novo" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-blue-100');
    expect(badge?.className).toContain('text-blue-700');
  });

  it('should apply gray classes for unknown statuses', () => {
    const { container } = render(<LeadStatusBadge status="unknown" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-gray-100');
    expect(badge?.className).toContain('text-gray-700');
  });
});
