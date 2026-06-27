import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeadSourceBadge } from '../LeadSourceBadge';

describe('LeadSourceBadge', () => {
  it('should render "Meta Ads" for source "meta"', () => {
    render(<LeadSourceBadge source="meta" />);
    expect(screen.getByText('Meta Ads')).toBeInTheDocument();
  });

  it('should render "Google Ads" for source "google"', () => {
    render(<LeadSourceBadge source="google" />);
    expect(screen.getByText('Google Ads')).toBeInTheDocument();
  });

  it('should render "Orgânico" for source "organico"', () => {
    render(<LeadSourceBadge source="organico" />);
    expect(screen.getByText('Orgânico')).toBeInTheDocument();
  });

  it('should render "Manual" for source "manual"', () => {
    render(<LeadSourceBadge source="manual" />);
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('should render an icon alongside the label', () => {
    const { container } = render(<LeadSourceBadge source="meta" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should apply correct CSS classes for meta source', () => {
    const { container } = render(<LeadSourceBadge source="meta" />);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-blue-50');
    expect(badge?.className).toContain('text-blue-600');
  });

  // Regressão: valores do enum LeadSource (backend) chegam crus/lowercase no
  // Dashboard e nas listas. Antes do fix, 'other' não estava no mapa e o
  // componente quebrava com "Cannot read properties of undefined (reading 'icon')".
  it('should render backend source "other" without crashing', () => {
    expect(() => render(<LeadSourceBadge source="other" />)).not.toThrow();
    expect(screen.getByText('Outro')).toBeInTheDocument();
  });

  it('should render backend source "website" as "Website"', () => {
    render(<LeadSourceBadge source="website" />);
    expect(screen.getByText('Website')).toBeInTheDocument();
  });

  it('should render backend source "social_media" as "Redes Sociais"', () => {
    render(<LeadSourceBadge source="social_media" />);
    expect(screen.getByText('Redes Sociais')).toBeInTheDocument();
  });

  it('should normalize uppercase backend values (e.g. "OTHER")', () => {
    render(<LeadSourceBadge source="OTHER" />);
    expect(screen.getByText('Outro')).toBeInTheDocument();
  });

  it('should fall back to a generic badge for unknown sources', () => {
    expect(() => render(<LeadSourceBadge source="qualquer_coisa" />)).not.toThrow();
    const { container } = render(<LeadSourceBadge source="qualquer_coisa" />);
    const badge = container.querySelector('span');
    expect(badge).toBeInTheDocument();
  });
});
