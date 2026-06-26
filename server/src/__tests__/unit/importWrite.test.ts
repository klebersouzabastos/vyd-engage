import { describe, it, expect, beforeEach } from 'vitest';
import { ImportType } from '@prisma/client';
import { prismaMock } from '../helpers/prismaMock.js';
import { executeBatch, type RunImportInput } from '../../services/importService.js';

/**
 * Write-path coverage for the BD legacy migration: companies upsert (create vs
 * update by externalId) and contacts mode (company linking + isContact + upsert
 * by name+email). Exercised through executeBatch with precomputed rows so the
 * writers run against a mocked Prisma.
 */

const tenantId = 'tenant-1';

// Extract the first argument of the first call to a (deep-mocked) Prisma method.
// Typed as `any` to sidestep the deep mock's complex per-model call signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const firstArg = (mockFn: any): any => mockFn.mock.calls[0][0];

beforeEach(() => {
  prismaMock.importBatch.update.mockResolvedValue({} as never);
});

function companyInput(): RunImportInput {
  return {
    tenantId,
    userId: 'u1',
    type: ImportType.COMPANIES,
    parsed: { headers: [], rows: [{}] },
    mapping: {},
    duplicateStrategy: 'update',
  };
}

function contactInput(): RunImportInput {
  return {
    tenantId,
    userId: 'u1',
    type: ImportType.LEADS,
    parsed: { headers: [], rows: [{}] },
    mapping: {},
    duplicateStrategy: 'update',
    options: { contactsMode: true },
  };
}

describe('writeCompanies (via executeBatch) — upsert', () => {
  it('creates a new company with native + custom fields and the batch id', async () => {
    prismaMock.company.findMany.mockResolvedValue([]);
    prismaMock.company.create.mockResolvedValue({ id: 'new-1' } as never);

    const rows = [
      {
        row: 1,
        name: 'Acme',
        externalId: 'E1',
        cnpj: '12345678000190',
        fantasyName: 'Acme Co',
        website: 'https://acme.com',
        industry: 'Mineração',
        notes: 'resumo',
        customFields: { Total: 5, 'Valor único vendido': 25350.29 },
      },
    ];

    await executeBatch('batch-1', companyInput(), { type: 'COMPANIES', rows } as never);

    expect(prismaMock.company.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.company.update).not.toHaveBeenCalled();
    const data = firstArg(prismaMock.company.create).data;
    expect(data).toMatchObject({
      tenantId,
      name: 'Acme',
      externalId: 'E1',
      cnpj: '12345678000190',
      fantasyName: 'Acme Co',
      website: 'https://acme.com',
      industry: 'Mineração',
      importBatchId: 'batch-1',
      customFields: { Total: 5, 'Valor único vendido': 25350.29 },
    });
  });

  it('updates an existing company matched by externalId instead of duplicating', async () => {
    prismaMock.company.findMany.mockResolvedValue([
      { id: 'c1', name: 'Old Name', cnpj: null, externalId: 'E1' } as never,
    ]);
    prismaMock.company.update.mockResolvedValue({ id: 'c1' } as never);

    const rows = [{ row: 1, name: 'New Name', externalId: 'E1', customFields: {} }];
    await executeBatch('batch-1', companyInput(), { type: 'COMPANIES', rows } as never);

    expect(prismaMock.company.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.company.create).not.toHaveBeenCalled();
    const call = firstArg(prismaMock.company.update);
    expect(call.where).toEqual({ id: 'c1' });
    expect(call.data).toMatchObject({ name: 'New Name', importBatchId: 'batch-1' });
  });
});

describe('writeLeads contacts mode (via executeBatch)', () => {
  it('creates a contact, links companyId by name and flags isContact', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    prismaMock.company.findMany.mockResolvedValue([{ id: 'co1', name: 'Acme' } as never]);
    prismaMock.lead.create.mockResolvedValue({ id: 'l1' } as never);

    const rows = [
      { row: 1, name: 'Alice', email: 'alice@acme.com', company: 'Acme', customFields: {} },
    ];
    await executeBatch('batch-1', contactInput(), { type: 'LEADS', rows } as never);

    expect(prismaMock.lead.create).toHaveBeenCalledTimes(1);
    const data = firstArg(prismaMock.lead.create).data;
    expect(data).toMatchObject({
      name: 'Alice',
      email: 'alice@acme.com',
      company: 'Acme',
      companyId: 'co1',
      isContact: true,
      importBatchId: 'batch-1',
    });
  });

  it('imports an email-less contact (no error) and preserves the company text', async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    prismaMock.company.findMany.mockResolvedValue([]);
    prismaMock.lead.create.mockResolvedValue({ id: 'l2' } as never);

    const rows = [{ row: 1, name: 'No Email', email: undefined, company: 'Ghost Co', customFields: {} }];
    await executeBatch('batch-1', contactInput(), { type: 'LEADS', rows } as never);

    expect(prismaMock.lead.create).toHaveBeenCalledTimes(1);
    const data = firstArg(prismaMock.lead.create).data;
    expect(data).toMatchObject({ name: 'No Email', email: null, company: 'Ghost Co', isContact: true });
  });

  it('updates an existing contact matched by name+email (idempotent re-import)', async () => {
    prismaMock.lead.findMany.mockResolvedValue([
      { id: 'l1', email: 'alice@acme.com', phone: null, name: 'Alice', company: 'Acme' } as never,
    ]);
    prismaMock.company.findMany.mockResolvedValue([]);
    prismaMock.lead.update.mockResolvedValue({ id: 'l1' } as never);

    const rows = [
      { row: 1, name: 'Alice', email: 'alice@acme.com', company: 'Acme', customFields: {} },
    ];
    await executeBatch('batch-1', contactInput(), { type: 'LEADS', rows } as never);

    expect(prismaMock.lead.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    const call = firstArg(prismaMock.lead.update);
    expect(call.where).toEqual({ id: 'l1' });
    expect(call.data).toMatchObject({ isContact: true });
  });
});
