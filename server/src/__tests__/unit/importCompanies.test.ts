import { describe, it, expect, beforeEach } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';
import {
  analyzeCompanies,
  analyzeLeads,
  parseBrDate,
  parseBrNumber,
  type ParsedFile,
  type ColumnMapping,
} from '../../services/importService.js';

/**
 * Companies importer + contacts-mode leads importer (BD legacy migration, spec
 * importacao-empresas-contatos). Dedup keys: companies externalId → cnpj → name;
 * contacts name+email / name+company. Tests run against a mocked Prisma.
 */

const tenantId = 'tenant-1';

const companyMapping: ColumnMapping = { name: 'name', externalId: 'externalId', cnpj: 'cnpj' };
function companyFile(rows: Array<Record<string, string>>): ParsedFile {
  return { headers: ['name', 'externalId', 'cnpj'], rows };
}

describe('parseBrNumber — Brazilian decimal/thousands', () => {
  it('parses a comma decimal (CSV/text form)', () => {
    expect(parseBrNumber('25350,29')).toBe(25350.29);
  });
  it('parses a dot decimal (SheetJS .xls numeric form)', () => {
    expect(parseBrNumber('25350.29')).toBe(25350.29);
  });
  it('parses thousands dot + comma decimal', () => {
    expect(parseBrNumber('1.234.567,89')).toBe(1234567.89);
  });
  it('parses a plain integer', () => {
    expect(parseBrNumber('6')).toBe(6);
  });
  it('returns undefined for empty input', () => {
    expect(parseBrNumber('')).toBeUndefined();
  });
});

describe('parseBrDate — Brazilian DD/MM/YYYY', () => {
  it('parses a date without time', () => {
    const d = parseBrDate('23/08/2024');
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(7); // August (0-based)
    expect(d?.getDate()).toBe(23);
  });
  it('combines a separate date and time column', () => {
    const d = parseBrDate('23/08/2024', '10:28');
    expect(d?.getHours()).toBe(10);
    expect(d?.getMinutes()).toBe(28);
  });
  it('returns undefined for empty input', () => {
    expect(parseBrDate('')).toBeUndefined();
  });
});

describe('analyzeCompanies — dedup decision (unit, mocked Prisma)', () => {
  beforeEach(() => {
    prismaMock.customField.findMany.mockResolvedValue([]);
  });

  it('flags a missing name as an error', async () => {
    prismaMock.company.findMany.mockResolvedValue([]);
    const { analysis } = await analyzeCompanies(
      tenantId,
      companyFile([{ name: '', externalId: 'X1', cnpj: '' }]),
      companyMapping
    );
    expect(analysis.errorCount).toBe(1);
    expect(analysis.errors[0]).toMatchObject({ row: 1, field: 'name' });
  });

  it('classifies a row matching an existing externalId as duplicate (will upsert)', async () => {
    prismaMock.company.findMany.mockResolvedValue([
      { id: 'c1', name: 'Acme', cnpj: null, externalId: 'EXT1' } as any,
    ]);
    const { analysis } = await analyzeCompanies(
      tenantId,
      companyFile([{ name: 'Acme Renamed', externalId: 'EXT1', cnpj: '' }]),
      companyMapping
    );
    expect(analysis.duplicateCount).toBe(1);
    expect(analysis.newCount).toBe(0);
    expect(analysis.duplicates[0]).toMatchObject({
      row: 1,
      matchedBy: 'externalId',
      value: 'EXT1',
    });
  });

  it('classifies a brand-new company as new', async () => {
    prismaMock.company.findMany.mockResolvedValue([]);
    const { analysis } = await analyzeCompanies(
      tenantId,
      companyFile([{ name: 'New Co', externalId: 'NEW1', cnpj: '' }]),
      companyMapping
    );
    expect(analysis.newCount).toBe(1);
    expect(analysis.duplicateCount).toBe(0);
  });

  it('treats the second of two identical in-file externalIds as a duplicate', async () => {
    prismaMock.company.findMany.mockResolvedValue([]);
    const { analysis } = await analyzeCompanies(
      tenantId,
      companyFile([
        { name: 'A', externalId: 'DUP', cnpj: '' },
        { name: 'B', externalId: 'DUP', cnpj: '' },
      ]),
      companyMapping
    );
    expect(analysis.newCount).toBe(1);
    expect(analysis.duplicateCount).toBe(1);
    expect(analysis.duplicates[0].row).toBe(2);
  });

  it('dedups by normalized name when there is no externalId/cnpj', async () => {
    prismaMock.company.findMany.mockResolvedValue([
      { id: 'c1', name: 'Lundin Mining', cnpj: null, externalId: null } as any,
    ]);
    const { analysis } = await analyzeCompanies(
      tenantId,
      { headers: ['name'], rows: [{ name: '  lundin mining  ' }] },
      { name: 'name' }
    );
    expect(analysis.duplicateCount).toBe(1);
    expect(analysis.duplicates[0].matchedBy).toBe('name');
  });

  it('coerces NUMBER custom fields to numbers using BR format', async () => {
    prismaMock.customField.findMany.mockResolvedValue([
      { name: 'Valor único vendido', type: 'NUMBER' } as any,
    ]);
    prismaMock.company.findMany.mockResolvedValue([]);
    const { mappedRows } = await analyzeCompanies(
      tenantId,
      {
        headers: ['name', 'Valor único vendido'],
        rows: [{ name: 'Acme', 'Valor único vendido': '25350,29' }],
      },
      { name: 'name', 'Valor único vendido': 'Valor único vendido' }
    );
    expect(mappedRows[0].customFields['Valor único vendido']).toBe(25350.29);
  });
});

describe('analyzeLeads — contacts mode (unit, mocked Prisma)', () => {
  beforeEach(() => {
    prismaMock.customField.findMany.mockResolvedValue([]);
  });

  const contactMapping: ColumnMapping = { name: 'name', email: 'email', company: 'company' };
  function contactFile(rows: Array<Record<string, string>>): ParsedFile {
    return { headers: ['name', 'email', 'company'], rows };
  }

  it('does NOT treat a missing email as an error (email optional, req 15)', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    const { analysis } = await analyzeLeads(
      tenantId,
      contactFile([{ name: 'No Email', email: '', company: 'Acme' }]),
      contactMapping,
      { contactsMode: true }
    );
    expect(analysis.errorCount).toBe(0);
    expect(analysis.newCount).toBe(1);
  });

  it('keeps two different names that share one email as distinct (req 26)', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    const { analysis } = await analyzeLeads(
      tenantId,
      contactFile([
        { name: 'Alice', email: 'shared@corp.com', company: 'Acme' },
        { name: 'Bob', email: 'shared@corp.com', company: 'Acme' },
      ]),
      contactMapping,
      { contactsMode: true }
    );
    expect(analysis.newCount).toBe(2);
    expect(analysis.duplicateCount).toBe(0);
  });

  it('treats the same name+email as a duplicate (idempotent re-import, req 27)', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    const { analysis } = await analyzeLeads(
      tenantId,
      contactFile([
        { name: 'Alice', email: 'alice@corp.com', company: 'Acme' },
        { name: 'Alice', email: 'alice@corp.com', company: 'Acme' },
      ]),
      contactMapping,
      { contactsMode: true }
    );
    expect(analysis.duplicateCount).toBe(1);
    expect(analysis.duplicates[0].row).toBe(2);
  });

  it('dedups email-less contacts by name+company', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    const { analysis } = await analyzeLeads(
      tenantId,
      contactFile([
        { name: 'Carlos', email: '', company: 'Acme' },
        { name: 'Carlos', email: '', company: 'Acme' },
      ]),
      contactMapping,
      { contactsMode: true }
    );
    expect(analysis.duplicateCount).toBe(1);
  });
});
