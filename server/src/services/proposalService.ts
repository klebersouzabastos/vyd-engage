/**
 * proposalService — modelos de proposta + geração de proposta (Upgrade RD P2,
 * reqs 17 e 18).
 *
 * Modelos (req 17): CRUD com corpo rico (sanitizado no persist), `isDefault`
 * único por tenant (transação desmarca os demais) e status DRAFT/PUBLISHED.
 *
 * Geração (req 18): resolve as variáveis do modelo ({{nome}}, {{empresa}}, ...)
 * + a tabela de itens do deal (Product/DealProduct) → gera o PDF (pdfService)
 * → storageService.put(source=PROPOSAL) → cria Proposal(version = max+1 por
 * deal) → registra uma Interaction (NOTE/PROPOSTA). Regenerar = nova versão.
 *
 * Multi-tenant: toda query filtra por tenantId.
 */
import type { Prisma, ProposalTemplate, Proposal } from '@prisma/client';
import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { storageService } from '../services/storageService.js';
import type { ProposalItemLine } from '../services/pdfService.js';
import { sanitizeHtml } from '../services/campaignService.js';
import { sanitizeFileName } from '../services/attachmentService.js';

// ─── Modelos de proposta (req 17) ────────────────────────────────────────────

export interface CreateTemplateInput {
  name: string;
  bodyHtml: string;
  isDefault?: boolean;
  status?: 'DRAFT' | 'PUBLISHED';
  createdById?: string | null;
}

export type UpdateTemplateInput = Partial<Omit<CreateTemplateInput, 'createdById'>>;

export const proposalService = {
  async listTemplates(tenantId: string): Promise<ProposalTemplate[]> {
    return prisma.proposalTemplate.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  },

  async getTemplate(tenantId: string, id: string): Promise<ProposalTemplate> {
    const tpl = await prisma.proposalTemplate.findFirst({ where: { id, tenantId } });
    if (!tpl) throw createError('Modelo de proposta não encontrado.', 404, 'TEMPLATE_NOT_FOUND');
    return tpl;
  },

  async createTemplate(tenantId: string, input: CreateTemplateInput): Promise<ProposalTemplate> {
    const bodyHtml = sanitizeHtml(input.bodyHtml);
    const isDefault = input.isDefault ?? false;

    return prisma.$transaction(async (tx) => {
      if (isDefault) {
        // Só 1 default por tenant — desmarca os demais.
        await tx.proposalTemplate.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.proposalTemplate.create({
        data: {
          tenantId,
          name: input.name,
          bodyHtml,
          isDefault,
          status: input.status ?? 'PUBLISHED',
          createdById: input.createdById ?? null,
        },
      });
    });
  },

  async updateTemplate(
    tenantId: string,
    id: string,
    input: UpdateTemplateInput
  ): Promise<ProposalTemplate> {
    const existing = await prisma.proposalTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw createError('Modelo de proposta não encontrado.', 404, 'TEMPLATE_NOT_FOUND');

    const data: Prisma.ProposalTemplateUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.bodyHtml !== undefined) data.bodyHtml = sanitizeHtml(input.bodyHtml);
    if (input.status !== undefined) data.status = input.status;
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;

    return prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await tx.proposalTemplate.updateMany({
          where: { tenantId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.proposalTemplate.update({ where: { id }, data });
    });
  },

  async deleteTemplate(tenantId: string, id: string): Promise<void> {
    const existing = await prisma.proposalTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw createError('Modelo de proposta não encontrado.', 404, 'TEMPLATE_NOT_FOUND');
    // Proposal.templateId é SetNull no schema — apagar o modelo não quebra o histórico.
    await prisma.proposalTemplate.delete({ where: { id } });
  },

  // ─── Geração de proposta (req 18) ──────────────────────────────────────────

  /**
   * Gera uma nova proposta (nova versão) para o deal. Resolve variáveis do
   * modelo + itens do deal → PDF → Attachment(source=PROPOSAL) → Proposal →
   * Interaction. Sem modelo informado, usa o default do tenant (se houver).
   */
  async generate(
    tenantId: string,
    dealId: string,
    opts: { templateId?: string; userId?: string | null }
  ): Promise<Proposal> {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId, deletedAt: null },
      include: {
        lead: { select: { name: true, email: true, company: true, phone: true } },
        company: { select: { name: true, domain: true } },
        assignedUser: { select: { name: true } },
        tenant: { select: { name: true } },
      },
    });
    if (!deal) throw createError('Negócio não encontrado.', 404, 'DEAL_NOT_FOUND');

    // Resolve o modelo: explícito → default do tenant → nenhum (proposta simples).
    let template: ProposalTemplate | null;
    if (opts.templateId) {
      template = await prisma.proposalTemplate.findFirst({
        where: { id: opts.templateId, tenantId },
      });
      if (!template) throw createError('Modelo de proposta não encontrado.', 404, 'TEMPLATE_NOT_FOUND');
    } else {
      template = await prisma.proposalTemplate.findFirst({
        where: { tenantId, isDefault: true },
      });
    }

    // Contexto de variáveis (espelha os chips do editor).
    const clientName = deal.lead?.name ?? deal.company?.name ?? 'Cliente';
    const clientCompany = deal.lead?.company ?? deal.company?.name ?? '';
    const clientEmail = deal.lead?.email ?? '';
    const clientPhone = deal.lead?.phone ?? '';

    // Itens do deal (Product/DealProduct): nome/qtd/preço/desconto/subtotal + total.
    const dealProducts = await prisma.dealProduct.findMany({
      where: { dealId },
      include: { product: { select: { name: true } } },
    });
    const items: ProposalItemLine[] = dealProducts.map((dp) => {
      const subtotal =
        Number(dp.quantity) * Number(dp.unitPrice) * (1 - Number(dp.discount) / 100);
      return {
        name: dp.product?.name ?? 'Item',
        quantity: Number(dp.quantity),
        unitPrice: Number(dp.unitPrice),
        discount: Number(dp.discount),
        subtotal: Math.round(subtotal * 100) / 100,
      };
    });
    const total =
      items.length > 0
        ? Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100
        : Number(deal.value);

    // Corpo: modelo interpolado → texto estruturado (sem HTML) para o PDF.
    // O contexto cobre AS DUAS grafias: as chaves camelCase que o editor da UI
    // documenta ({{dealName}}, {{dealValue}}, {{clientName}}...) E as chaves
    // pt-BR históricas ({{nome}}, {{empresa}}, {{valor}}...) — retrocompat.
    // {{dealProducts}} é apenas um MARCADOR: a tabela de itens já é anexada
    // após o corpo pelo PDF, então aqui só limpamos o token (string vazia) para
    // não sair literal nem duplicar a tabela no corpo.
    const salesRepName = deal.assignedUser?.name ?? '';
    const valorBRL = formatBRL(total);
    const rawBody = template
      ? interpolateProposalTags(template.bodyHtml, {
          // pt-BR (histórico)
          nome: clientName,
          empresa: clientCompany,
          email: clientEmail,
          telefone: clientPhone,
          negocio: deal.name,
          valor: valorBRL,
          responsavel: salesRepName,
          // camelCase da UI (chaves documentadas no editor)
          dealname: deal.name,
          dealvalue: valorBRL,
          clientname: clientName,
          clientcompany: clientCompany,
          clientemail: clientEmail,
          salesrepname: salesRepName,
          dealproducts: '', // marcador: tabela anexada após o corpo pelo PDF
        })
      : '';
    const bodyText = htmlToPlainText(rawBody);

    // Próxima versão (incremental por deal).
    const last = await prisma.proposal.findFirst({
      where: { tenantId, dealId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    // Renderiza o PDF. Import dinâmico do pdfService para NÃO carregar
    // `@pdfme/generator` no grafo de módulos ansioso (ele é usado só aqui e no
    // export legado /proposal.pdf) — mantém o boot do app resiliente.
    const { renderProposalPdf } = await import('../services/pdfService.js');
    const pdf = await renderProposalPdf({
      tenantName: deal.tenant.name,
      title: template?.name ?? `Proposta — ${deal.name}`,
      clientName,
      clientCompany,
      clientEmail,
      version,
      bodyText,
      items,
      total,
      generatedBy: deal.assignedUser?.name ?? undefined,
    });

    // Persiste o Attachment (source=PROPOSAL) + Proposal + Interaction.
    const fileName = sanitizeFileName(`proposta-${deal.name}-v${version}.pdf`);
    const attachment = await storageService.put(tenantId, {
      name: fileName,
      mimeType: 'application/pdf',
      buffer: pdf,
      dealId,
      companyId: deal.companyId ?? null,
      source: 'PROPOSAL',
      uploadedById: opts.userId ?? null,
    });

    const proposal = await prisma.proposal.create({
      data: {
        tenantId,
        dealId,
        templateId: template?.id ?? null,
        version,
        attachmentId: attachment.id,
        totalValue: total,
        createdById: opts.userId ?? null,
      },
      include: { attachment: { select: proposalAttachmentSelect } },
    });

    await prisma.interaction.create({
      data: {
        tenantId,
        dealId,
        leadId: deal.leadId ?? null,
        companyId: deal.companyId ?? null,
        userId: opts.userId ?? null,
        type: 'NOTE',
        direction: 'OUTBOUND',
        subject: 'Proposta',
        content: `Proposta v${version} gerada`,
        metadata: { proposalId: proposal.id, attachmentId: attachment.id, version },
      },
    });

    return proposal;
  },

  async listForDeal(tenantId: string, dealId: string): Promise<Proposal[]> {
    return prisma.proposal.findMany({
      where: { tenantId, dealId },
      orderBy: { version: 'desc' },
      include: { attachment: { select: proposalAttachmentSelect } },
    });
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const proposalAttachmentSelect = {
  id: true,
  tenantId: true,
  name: true,
  mimeType: true,
  size: true,
  storageProvider: true,
  dealId: true,
  companyId: true,
  source: true,
  uploadedById: true,
  createdAt: true,
} as const;

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

/**
 * Interpola as variáveis {{chave}} do corpo do modelo. Tags desconhecidas são
 * preservadas. Aceita acentos/underscores/hífen. (Superconjunto pt-BR do
 * mergeTags util.)
 */
export function interpolateProposalTags(
  template: string,
  ctx: Record<string, string>
): string {
  return template.replace(/\{\{\s*([\wçÇãÃáÁàÀâÂéÉêÊíÍóÓôÔõÕúÚ_-]+)\s*\}\}/g, (match, rawKey: string) => {
    const key = String(rawKey).toLowerCase();
    return Object.prototype.hasOwnProperty.call(ctx, key) ? (ctx[key] ?? '') : match;
  });
}

/**
 * Conversão leve de HTML → texto estruturado para o corpo do PDF: blocos viram
 * quebras de linha, <br> vira quebra, tags são removidas e entidades comuns são
 * decodificadas. O corpo já foi sanitizado no persist do modelo.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  let out = html;
  // Blocos → parágrafo (dupla quebra); <br> → quebra simples.
  out = out.replace(/<\s*br\s*\/?>/gi, '\n');
  out = out.replace(/<\/\s*(p|div|h[1-6]|li|tr|blockquote)\s*>/gi, '\n\n');
  out = out.replace(/<\s*li[^>]*>/gi, '• ');
  // Remove as demais tags.
  out = out.replace(/<[^>]+>/g, '');
  // Decodifica entidades comuns.
  out = out
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // Normaliza quebras excessivas.
  out = out.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');
  return out.trim();
}
