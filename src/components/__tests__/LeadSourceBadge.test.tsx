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
});
