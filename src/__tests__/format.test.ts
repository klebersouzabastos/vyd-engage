import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../utils/format';

describe('formatCurrency', () => {
  it('formats BRL currency', () => {
    expect(formatCurrency(1234.56)).toContain('1.234,56');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('0,00');
  });

  it('formats negative values', () => {
    expect(formatCurrency(-99.9)).toContain('99,90');
  });

  it('formats large numbers', () => {
    expect(formatCurrency(1000000)).toContain('1.000.000,00');
  });
});
