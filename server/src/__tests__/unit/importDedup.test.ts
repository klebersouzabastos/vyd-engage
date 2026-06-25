import { describe, it, expect, beforeEach } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';
import { analyzeLeads, type ParsedFile, type ColumnMapping } from '../../services/importService.js';

/**
 * Per-row "new vs duplicate" classification in the leads importer (Growth import
 * epic). Dedup keys: email (primary), phone (secondary). Tests run against a
 * mocked Prisma — analyzeLeads only reads customField + existing leads.
 */

const tenantId = 'tenant-1';
const mapping: ColumnMapping = { name: 'name', email: 'email', phone: 'phone' };

function file(rows: Array<Record<string, string>>): ParsedFile {
  return { headers: ['name', 'email', 'phone'], rows };
}

describe('analyzeLeads — dedup decision (unit, mocked Prisma)', () => {
  beforeEach(() => {
    prismaMock.customField.findMany.mockResolvedValue([]);
  });

  it('classifies a row matching an existing lead email as duplicate', async () => {
    prismaMock.lead.findMany.mockResolvedValue([
      { id: 'existing-1', email: 'maria@acme.com', phone: null } as any,
    ]);

    const { analysis } = await analyzeLeads(
      tenantId,
      file([{ name: 'Maria', email: 'MARIA@acme.com', phone: '' }]), // case-insensitive match
      mapping,
    );

    expect(analysis.duplicateCount).toBe(1);
    expect(analysis.newCount).toBe(0);
    expect(analysis.duplicates[0]).toMatchObject({ row: 1, matchedBy: 'email', value: 'maria@acme.com' });
  });

  it('classifies a row matching an existing phone (no email match) as duplicate via phone', async () => {
    prismaMock.lead.findMany.mockResolvedValue([
      { id: 'existing-1', email: 'someone@else.com', phone: '(11) 99999-0000' } as any,
    ]);

    const { analysis } = await analyzeLeads(
      tenantId,
      // Same digits (11999990000) after stripping non-digits, different formatting.
      file([{ name: 'Bob', email: 'bob@new.com', phone: '11 99999 0000' }]),
      mapping,
    );

    expect(analysis.duplicateCount).toBe(1);
    expect(analysis.duplicates[0]).toMatchObject({ row: 1, matchedBy: 'phone' });
  });

  it('classifies a brand-new row as new', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);

    const { analysis } = await analyzeLeads(
      tenantId,
      file([{ name: 'New Guy', email: 'new@guy.com', phone: '11888887777' }]),
      mapping,
    );

    expect(analysis.newCount).toBe(1);
    expect(analysis.duplicateCount).toBe(0);
  });

  it('treats the second of two identical in-file emails as a duplicate', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);

    const { analysis } = await analyzeLeads(
      tenantId,
      file([
        { name: 'A', email: 'dup@x.com', phone: '' },
        { name: 'B', email: 'dup@x.com', phone: '' },
      ]),
      mapping,
    );

    expect(analysis.newCount).toBe(1);
    expect(analysis.duplicateCount).toBe(1);
    expect(analysis.duplicates[0].row).toBe(2);
  });

  it('flags missing/invalid email as an error (not new, not duplicate)', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);

    const { analysis } = await analyzeLeads(
      tenantId,
      file([
        { name: 'No Email', email: '', phone: '' },
        { name: 'Bad Email', email: 'not-an-email', phone: '' },
      ]),
      mapping,
    );

    expect(analysis.errorCount).toBe(2);
    expect(analysis.newCount).toBe(0);
    expect(analysis.duplicateCount).toBe(0);
    expect(analysis.errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('flags a missing name as an error', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);

    const { analysis } = await analyzeLeads(
      tenantId,
      file([{ name: '', email: 'x@y.com', phone: '' }]),
      mapping,
    );

    expect(analysis.errorCount).toBe(1);
    expect(analysis.errors[0]).toMatchObject({ row: 1, field: 'name' });
  });
});
