import { describe, it, expect } from 'vitest';
import {
  applyMergeTags,
  applyMergeTagsHtml,
  type MergeTagContext,
} from '../../services/campaignService.js';

/**
 * Campaign merge-tag substitution (EC epic): {{lead.name}}, {{lead.company}},
 * {{lead.email}}. applyMergeTags is used for the plain-text subject (no escaping);
 * applyMergeTagsHtml is used inside HTML bodies (substituted values are escaped).
 * Note: distinct from utils/mergeTags (the pt-BR {{nome}} interpolation).
 */

const ctx: MergeTagContext = { name: 'Maria Silva', company: 'Acme', email: 'maria@acme.com' };

describe('applyMergeTags (subject / plain text)', () => {
  it('substitutes lead.name / lead.company / lead.email', () => {
    expect(applyMergeTags('Oi {{lead.name}} da {{lead.company}}', ctx)).toBe(
      'Oi Maria Silva da Acme'
    );
    expect(applyMergeTags('{{lead.email}}', ctx)).toBe('maria@acme.com');
  });

  it('tolerates surrounding whitespace and is case-insensitive on the key', () => {
    expect(applyMergeTags('{{ lead.name }}', ctx)).toBe('Maria Silva');
    expect(applyMergeTags('{{LEAD.COMPANY}}', ctx)).toBe('Acme');
  });

  it('a missing field becomes an empty string (not the literal tag)', () => {
    expect(applyMergeTags('[{{lead.company}}]', { name: 'X' })).toBe('[]');
    expect(applyMergeTags('[{{lead.email}}]', { name: 'X', company: null, email: '' })).toBe('[]');
  });

  it('leaves unknown tags untouched', () => {
    expect(applyMergeTags('{{lead.name}} {{lead.phone}}', ctx)).toBe('Maria Silva {{lead.phone}}');
  });

  it('returns empty string for null/empty templates', () => {
    expect(applyMergeTags('', ctx)).toBe('');
    expect(applyMergeTags(null, ctx)).toBe('');
    expect(applyMergeTags(undefined, ctx)).toBe('');
  });

  it('does NOT HTML-escape (plain text path)', () => {
    expect(applyMergeTags('{{lead.name}}', { name: 'A & B <co>' })).toBe('A & B <co>');
  });
});

describe('applyMergeTagsHtml (HTML body)', () => {
  it('substitutes the same tags', () => {
    expect(applyMergeTagsHtml('Oi {{lead.name}}', ctx)).toBe('Oi Maria Silva');
  });

  it('a missing field becomes an empty string', () => {
    expect(applyMergeTagsHtml('[{{lead.company}}]', { name: 'X' })).toBe('[]');
  });

  it('HTML-escapes the substituted value (prevents stored-XSS via lead name)', () => {
    const out = applyMergeTagsHtml('{{lead.name}}', { name: '<script>alert(1)</script>' });
    expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('preserves unknown tags', () => {
    expect(applyMergeTagsHtml('{{lead.unknown}}', ctx)).toBe('{{lead.unknown}}');
  });
});
