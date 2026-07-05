import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P2 (B2): proposalService.
 *
 * Prova:
 *  - generate: cria Attachment(source=PROPOSAL) + Proposal(version incremental)
 *    + Interaction e resolve as variáveis do modelo + a tabela de itens do deal.
 *  - templates: só 1 default por tenant (desmarca os demais na transação).
 *  - htmlToPlainText / interpolateProposalTags: contratos de resolução.
 */
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

const { putMock, renderProposalPdfMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
  renderProposalPdfMock: vi.fn(),
}));

// storageService.put → devolve um Attachment sintético (não persiste bytes aqui).
vi.mock('../../services/storageService.js', () => ({
  storageService: { put: putMock },
}));

// PDF: determinístico e sem rede no teste.
vi.mock('../../services/pdfService.js', () => ({
  renderProposalPdf: renderProposalPdfMock,
}));

// sanitizeHtml: identidade (o endurecimento é testado no campaignService).
vi.mock('../../services/campaignService.js', () => ({
  sanitizeHtml: (h: string) => h,
}));

import prisma from '../../config/database.js';
import {
  proposalService,
  interpolateProposalTags,
  htmlToPlainText,
} from '../../services/proposalService.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const tenantId = 'tenant-1';

// Primeiro argumento da primeira chamada de um mock (idioma do repo p/ mockDeep).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arg0 = (fn: any) => fn.mock.calls[0][0];

function wireTransaction() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prismaMock.$transaction as any).mockImplementation(async (cb: any) => cb(prismaMock));
}

beforeEach(() => {
  mockReset(prismaMock);
  putMock.mockReset();
  renderProposalPdfMock.mockReset();
  renderProposalPdfMock.mockResolvedValue(Buffer.from('%PDF-fake'));
});

describe('proposalService.generate — geração de proposta (req 18)', () => {
  it('cria Attachment(PROPOSAL) + Proposal(v1) + Interaction e resolve variáveis + itens', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'deal-1',
      name: 'Projeto X',
      value: 1000,
      companyId: 'comp-1',
      leadId: 'lead-1',
      lead: { name: 'Fulano', email: 'f@ex.com', company: 'ACME', phone: '11999' },
      company: { name: 'ACME LTDA', domain: 'acme.com' },
      assignedUser: { name: 'Vendedor' },
      tenant: { name: 'Tenax' },
    } as never);

    // Modelo padrão do tenant (nenhum templateId informado).
    prismaMock.proposalTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      tenantId,
      name: 'Modelo Padrão',
      bodyHtml: '<p>Olá {{nome}} da {{empresa}}. Valor: {{valor}}.</p>',
      isDefault: true,
      status: 'PUBLISHED',
    } as never);

    // Itens do deal.
    prismaMock.dealProduct.findMany.mockResolvedValue([
      { quantity: 2, unitPrice: 100, discount: 10, product: { name: 'Serviço A' } },
      { quantity: 1, unitPrice: 500, discount: 0, product: { name: 'Serviço B' } },
    ] as never);

    // Nenhuma proposta anterior → version = 1.
    prismaMock.proposal.findFirst.mockResolvedValue(null as never);

    putMock.mockResolvedValue({ id: 'att-1', source: 'PROPOSAL' });
    prismaMock.proposal.create.mockResolvedValue({
      id: 'prop-1',
      version: 1,
      attachmentId: 'att-1',
    } as never);
    prismaMock.interaction.create.mockResolvedValue({ id: 'int-1' } as never);

    const proposal = await proposalService.generate(tenantId, 'deal-1', { userId: 'user-1' });

    // Attachment gerado como PROPOSAL.
    expect(putMock).toHaveBeenCalledTimes(1);
    const putArg = putMock.mock.calls[0][1];
    expect(putArg).toMatchObject({
      mimeType: 'application/pdf',
      source: 'PROPOSAL',
      dealId: 'deal-1',
      companyId: 'comp-1',
    });

    // Variáveis resolvidas no corpo passado ao PDF.
    const pdfArg = renderProposalPdfMock.mock.calls[0][0];
    expect(pdfArg.bodyText).toContain('Fulano');
    expect(pdfArg.bodyText).toContain('ACME');
    // Total = 2*100*0.9 + 500 = 680.
    expect(pdfArg.total).toBe(680);
    expect(pdfArg.items).toHaveLength(2);
    expect(pdfArg.items[0]).toMatchObject({ name: 'Serviço A', subtotal: 180 });
    expect(pdfArg.version).toBe(1);

    // Proposal criada com version=1 e totalValue.
    const propArg = arg0(prismaMock.proposal.create).data as Record<string, unknown>;
    expect(propArg).toMatchObject({
      tenantId,
      dealId: 'deal-1',
      templateId: 'tpl-1',
      version: 1,
      attachmentId: 'att-1',
      totalValue: 680,
    });

    // Interaction registrada.
    const intArg = arg0(prismaMock.interaction.create).data as Record<string, unknown>;
    expect(intArg).toMatchObject({
      tenantId,
      dealId: 'deal-1',
      type: 'NOTE',
      direction: 'OUTBOUND',
      content: 'Proposta v1 gerada',
    });
    expect((intArg.metadata as Record<string, unknown>).proposalId).toBe('prop-1');

    expect(proposal.id).toBe('prop-1');
  });

  it('incrementa a versão a partir da última proposta do deal', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'deal-1',
      name: 'D',
      value: 0,
      companyId: null,
      leadId: null,
      lead: null,
      company: null,
      assignedUser: null,
      tenant: { name: 'T' },
    } as never);
    prismaMock.proposalTemplate.findFirst.mockResolvedValue(null as never);
    prismaMock.dealProduct.findMany.mockResolvedValue([] as never);
    prismaMock.proposal.findFirst.mockResolvedValue({ version: 4 } as never);
    putMock.mockResolvedValue({ id: 'att-9' });
    prismaMock.proposal.create.mockResolvedValue({ id: 'prop-9', version: 5 } as never);
    prismaMock.interaction.create.mockResolvedValue({ id: 'int-9' } as never);

    await proposalService.generate(tenantId, 'deal-1', {});

    const propArg = arg0(prismaMock.proposal.create).data as Record<string, unknown>;
    expect(propArg.version).toBe(5);
    expect(renderProposalPdfMock.mock.calls[0][0].version).toBe(5);
  });

  it('lança 404 quando o deal não pertence ao tenant', async () => {
    prismaMock.deal.findFirst.mockResolvedValue(null as never);
    await expect(proposalService.generate(tenantId, 'x', {})).rejects.toMatchObject({
      statusCode: 404,
      code: 'DEAL_NOT_FOUND',
    });
    expect(putMock).not.toHaveBeenCalled();
  });

  it('resolve os tokens camelCase da UI + limpa {{dealProducts}} (req 17)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'deal-1',
      name: 'Projeto X',
      value: 1000,
      companyId: 'comp-1',
      leadId: 'lead-1',
      lead: { name: 'Fulano', email: 'f@ex.com', company: 'ACME', phone: '11999' },
      company: { name: 'ACME LTDA', domain: 'acme.com' },
      assignedUser: { name: 'Vendedor João' },
      tenant: { name: 'Tenax' },
    } as never);

    // Modelo criado pela UI: usa EXCLUSIVAMENTE os tokens camelCase documentados.
    prismaMock.proposalTemplate.findFirst.mockResolvedValue({
      id: 'tpl-ui',
      tenantId,
      name: 'Modelo UI',
      bodyHtml:
        '<p>Negócio {{dealName}} de {{clientName}} ({{clientCompany}}, {{clientEmail}}) — valor {{dealValue}}, resp. {{salesRepName}}.</p><p>Itens: {{dealProducts}}</p>',
      isDefault: true,
      status: 'PUBLISHED',
    } as never);

    prismaMock.dealProduct.findMany.mockResolvedValue([
      { quantity: 1, unitPrice: 200, discount: 0, product: { name: 'Serviço A' } },
    ] as never);
    prismaMock.proposal.findFirst.mockResolvedValue(null as never);
    putMock.mockResolvedValue({ id: 'att-ui', source: 'PROPOSAL' });
    prismaMock.proposal.create.mockResolvedValue({ id: 'prop-ui', version: 1 } as never);
    prismaMock.interaction.create.mockResolvedValue({ id: 'int-ui' } as never);

    await proposalService.generate(tenantId, 'deal-1', { userId: 'u1' });

    const bodyText: string = renderProposalPdfMock.mock.calls[0][0].bodyText;
    // Nenhum token literal remanescente.
    expect(bodyText).not.toMatch(/\{\{.*?\}\}/);
    // Chaves camelCase resolvidas.
    expect(bodyText).toContain('Projeto X'); // dealName
    expect(bodyText).toContain('Fulano'); // clientName
    expect(bodyText).toContain('ACME'); // clientCompany
    expect(bodyText).toContain('f@ex.com'); // clientEmail
    expect(bodyText).toContain('Vendedor João'); // salesRepName
    expect(bodyText).toMatch(/R\$\s?200,00/); // dealValue em BRL
    // {{dealProducts}} → marcador removido (não sai literal nem duplica tabela).
    expect(bodyText).not.toContain('dealProducts');
    // A tabela de itens segue anexada separadamente pelo PDF.
    expect(renderProposalPdfMock.mock.calls[0][0].items).toHaveLength(1);
  });

  it('resolve também os tokens pt-BR históricos (retrocompat, req 17)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'deal-1',
      name: 'Projeto Y',
      value: 300,
      companyId: null,
      leadId: null,
      lead: { name: 'Beltrano', email: 'b@ex.com', company: 'BETA', phone: '' },
      company: null,
      assignedUser: { name: 'Maria' },
      tenant: { name: 'T' },
    } as never);
    prismaMock.proposalTemplate.findFirst.mockResolvedValue({
      id: 'tpl-ptbr',
      tenantId,
      name: 'Modelo pt-BR',
      bodyHtml: '<p>{{nome}} — {{empresa}} — {{valor}} — {{responsavel}} — {{negocio}}</p>',
      isDefault: true,
      status: 'PUBLISHED',
    } as never);
    prismaMock.dealProduct.findMany.mockResolvedValue([] as never);
    prismaMock.proposal.findFirst.mockResolvedValue(null as never);
    putMock.mockResolvedValue({ id: 'att-p', source: 'PROPOSAL' });
    prismaMock.proposal.create.mockResolvedValue({ id: 'prop-p', version: 1 } as never);
    prismaMock.interaction.create.mockResolvedValue({ id: 'int-p' } as never);

    await proposalService.generate(tenantId, 'deal-1', {});

    const bodyText: string = renderProposalPdfMock.mock.calls[0][0].bodyText;
    expect(bodyText).not.toMatch(/\{\{.*?\}\}/);
    expect(bodyText).toContain('Beltrano');
    expect(bodyText).toContain('BETA');
    expect(bodyText).toContain('Maria');
    expect(bodyText).toContain('Projeto Y');
  });

  it('lança 404 quando o templateId informado não existe no tenant', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      id: 'deal-1',
      name: 'D',
      value: 0,
      companyId: null,
      leadId: null,
      lead: null,
      company: null,
      assignedUser: null,
      tenant: { name: 'T' },
    } as never);
    prismaMock.proposalTemplate.findFirst.mockResolvedValue(null as never);

    await expect(
      proposalService.generate(tenantId, 'deal-1', { templateId: 'nope' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'TEMPLATE_NOT_FOUND' });
  });
});

describe('proposalService.createTemplate — isDefault único (req 17)', () => {
  it('desmarca os demais defaults do tenant ao criar um novo default', async () => {
    wireTransaction();
    prismaMock.proposalTemplate.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.proposalTemplate.create.mockResolvedValue({ id: 'tpl-new', isDefault: true } as never);

    await proposalService.createTemplate(tenantId, {
      name: 'Novo',
      bodyHtml: '<p>corpo</p>',
      isDefault: true,
    });

    expect(prismaMock.proposalTemplate.updateMany).toHaveBeenCalledWith({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
    expect(prismaMock.proposalTemplate.create).toHaveBeenCalledTimes(1);
  });

  it('NÃO desmarca ninguém quando o novo modelo não é default', async () => {
    wireTransaction();
    prismaMock.proposalTemplate.create.mockResolvedValue({ id: 'tpl-x', isDefault: false } as never);

    await proposalService.createTemplate(tenantId, { name: 'N', bodyHtml: '<p>c</p>' });

    expect(prismaMock.proposalTemplate.updateMany).not.toHaveBeenCalled();
  });

  it('updateTemplate marca este como default e desmarca os outros (exceto ele)', async () => {
    wireTransaction();
    prismaMock.proposalTemplate.findFirst.mockResolvedValue({ id: 'tpl-1', tenantId } as never);
    prismaMock.proposalTemplate.updateMany.mockResolvedValue({ count: 2 } as never);
    prismaMock.proposalTemplate.update.mockResolvedValue({ id: 'tpl-1', isDefault: true } as never);

    await proposalService.updateTemplate(tenantId, 'tpl-1', { isDefault: true });

    expect(prismaMock.proposalTemplate.updateMany).toHaveBeenCalledWith({
      where: { tenantId, isDefault: true, NOT: { id: 'tpl-1' } },
      data: { isDefault: false },
    });
  });
});

describe('helpers de resolução', () => {
  it('interpolateProposalTags substitui conhecidas e preserva desconhecidas', () => {
    const out = interpolateProposalTags('Olá {{nome}}, {{desconhecida}}', {
      nome: 'Ana',
    });
    expect(out).toBe('Olá Ana, {{desconhecida}}');
  });

  it('htmlToPlainText converte blocos em quebras e remove tags', () => {
    const out = htmlToPlainText('<h1>Título</h1><p>Linha 1</p><p>Linha 2</p><br>fim');
    expect(out).toContain('Título');
    expect(out).toContain('Linha 1');
    expect(out).not.toContain('<');
  });
});
