import prisma from '../config/database.js';
import { InteractionDirection, InteractionType } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { emailMessagingService } from './emailMessagingService.js';
import { interactionService } from './interactionService.js';
import { escapeHtml, sanitizeHtml } from './campaignService.js';

/**
 * E-mail 1:1 a partir da negociação (Upgrade RD P0, spec req 10) e do lead/
 * contato (spec req 11 — "no deal/lead").
 *
 * Usa um EmailTemplate do tenant (ou assunto/corpo avulsos), resolve as
 * variáveis {{nome}} {{empresa}} {{negociacao}} {{valor}} {{responsavel}},
 * envia pela configuração de e-mail existente (EmailConfig verificada) e
 * registra Interaction EMAIL OUTBOUND na timeline.
 *
 * Segurança (req 13): cada valor de variável é HTML-escapado ANTES de
 * interpolar (o nome do lead/empresa é dado do usuário → vetor de XSS) e o
 * assunto/corpo finais passam por sanitizeHtml (mesmo saneamento das campanhas)
 * ANTES de enviar E de gravar em Interaction.content.
 */

export interface SendDealEmailData {
  templateId?: string;
  subject?: string;
  html?: string;
  /** Destinatário (lead/contato) — padrão: contato principal do deal. */
  leadId?: string;
}

export interface SendLeadEmailData {
  templateId?: string;
  subject?: string;
  html?: string;
}

export interface SendDealEmailResult {
  sent: boolean;
  interactionId?: string;
}

function applyVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Interpola as variáveis no assunto/corpo. O ASSUNTO é um header de texto puro:
 * interpola valores crus (sem escape/sanitização HTML, senão "A & B" viraria
 * "A &amp; B" no header). O CORPO é HTML: escapa cada valor (dado do usuário não
 * deve injetar markup) e sanitiza o resultado final. Compartilhado por deal e lead.
 */
function renderContent(
  subjectRaw: string,
  htmlRaw: string,
  variables: Record<string, string>
): { subject: string; html: string } {
  const escaped: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    escaped[key] = escapeHtml(value);
  }
  return {
    subject: applyVariables(subjectRaw, variables),
    html: sanitizeHtml(applyVariables(htmlRaw, escaped)),
  };
}

/**
 * Resolve o conteúdo do e-mail a partir de um EmailTemplate do tenant ou de
 * assunto/corpo avulsos. Retorna o par bruto (ainda com variáveis).
 */
async function resolveTemplate(
  tenantId: string,
  data: { templateId?: string; subject?: string; html?: string }
): Promise<{ subject: string; html: string }> {
  let subject = data.subject;
  let html = data.html;
  if (data.templateId) {
    const template = await prisma.emailTemplate.findFirst({
      where: { id: data.templateId, tenantId },
    });
    if (!template) {
      throw createError('Modelo de e-mail não encontrado', 404, 'EMAIL_TEMPLATE_NOT_FOUND');
    }
    subject = subject || template.subject;
    html = html || template.html;
  }
  if (!subject || !html) {
    throw createError(
      'Informe um modelo de e-mail ou assunto e corpo da mensagem.',
      400,
      'VALIDATION_ERROR'
    );
  }
  return { subject, html };
}

/** EmailConfig verificada do tenant — obrigatória (400 claro se ausente). */
async function requireEmailConfig(tenantId: string) {
  const emailConfig = await prisma.emailConfig.findFirst({
    where: { tenantId, verified: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, provider: true },
  });
  if (!emailConfig) {
    throw createError(
      'Nenhuma configuração de e-mail verificada. Configure e verifique um e-mail em Configurações antes de enviar.',
      400,
      'EMAIL_CONFIG_MISSING'
    );
  }
  return emailConfig;
}

export async function sendDealEmail(
  tenantId: string,
  userId: string,
  dealId: string,
  data: SendDealEmailData
): Promise<SendDealEmailResult> {
  // 1. Deal do tenant (multi-tenant safety)
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId, deletedAt: null },
    include: {
      lead: { select: { id: true, name: true, email: true, company: true } },
      company: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
    },
  });
  if (!deal) {
    throw createError('Deal not found', 404, 'DEAL_NOT_FOUND');
  }

  // 2. Destinatário: leadId explícito (validado no tenant) ou contato do deal
  let recipient = deal.lead;
  if (data.leadId && data.leadId !== deal.lead?.id) {
    recipient = await prisma.lead.findFirst({
      where: { id: data.leadId, tenantId },
      select: { id: true, name: true, email: true, company: true },
    });
    if (!recipient) {
      throw createError('Contato não encontrado', 404, 'CONTACT_NOT_FOUND');
    }
  }
  if (!recipient) {
    throw createError(
      'A negociação não tem contato vinculado. Informe um destinatário.',
      400,
      'DEAL_WITHOUT_CONTACT'
    );
  }
  if (!recipient.email) {
    throw createError('O contato selecionado não possui e-mail.', 400, 'CONTACT_WITHOUT_EMAIL');
  }

  // 3. Conteúdo: modelo do tenant ou assunto/corpo avulsos
  const { subject: subjectRaw, html: htmlRaw } = await resolveTemplate(tenantId, data);

  // 4. Variáveis do contrato: {{nome}} {{empresa}} {{negociacao}} {{valor}} {{responsavel}}
  const variables: Record<string, string> = {
    nome: recipient.name ?? '',
    empresa: deal.company?.name ?? recipient.company ?? '',
    negociacao: deal.name,
    valor: Number(deal.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    responsavel: deal.assignedUser?.name ?? '',
  };
  // Escapa cada valor, interpola e sanitiza os finais (req 13 — anti-XSS).
  const { subject, html } = renderContent(subjectRaw, htmlRaw, variables);

  // 5. Configuração de e-mail do tenant — obrigatória (400 claro se ausente)
  const emailConfig = await requireEmailConfig(tenantId);

  // 6. Envia pelo serviço existente. NÃO passamos leadId aqui de propósito:
  //    a Interaction é criada abaixo já vinculada ao DEAL (contrato do design),
  //    evitando um registro duplicado só com leadId.
  const sendResult = await emailMessagingService.sendEmail(tenantId, {
    configId: emailConfig.id,
    to: recipient.email,
    subject,
    html,
  });

  // 7. Interaction EMAIL OUTBOUND na timeline do deal (content já sanitizado)
  const interaction = await interactionService.create(tenantId, {
    dealId: deal.id,
    leadId: recipient.id,
    companyId: deal.companyId ?? undefined,
    type: InteractionType.EMAIL,
    direction: InteractionDirection.OUTBOUND,
    subject,
    content: html,
    userId,
    metadata: {
      to: recipient.email,
      templateId: data.templateId ?? null,
      configId: emailConfig.id,
      provider: emailConfig.provider,
      messageId: sendResult.messageId ?? null,
      oneToOne: true,
    },
  });

  return { sent: true, interactionId: interaction.id };
}

/**
 * E-mail 1:1 a partir do lead/contato (spec req 11) — sem deal vinculado.
 * Variáveis: nome=lead.name, empresa=lead.company/company.name, negociacao='',
 * valor='', responsavel=assignedUser do lead. Registra Interaction EMAIL
 * OUTBOUND com leadId e SEM dealId.
 */
export async function sendLeadEmail(
  tenantId: string,
  userId: string,
  leadId: string,
  data: SendLeadEmailData
): Promise<SendDealEmailResult> {
  // 1. Lead do tenant (multi-tenant safety)
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      companyId: true,
      companyRef: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true } },
    },
  });
  if (!lead) {
    throw createError('Contato não encontrado', 404, 'CONTACT_NOT_FOUND');
  }
  if (!lead.email) {
    throw createError('O contato selecionado não possui e-mail.', 400, 'CONTACT_WITHOUT_EMAIL');
  }

  // 2. Conteúdo: modelo do tenant ou assunto/corpo avulsos
  const { subject: subjectRaw, html: htmlRaw } = await resolveTemplate(tenantId, data);

  // 3. Variáveis: sem deal → negociacao/valor vazios
  const variables: Record<string, string> = {
    nome: lead.name ?? '',
    empresa: lead.companyRef?.name ?? lead.company ?? '',
    negociacao: '',
    valor: '',
    responsavel: lead.assignedUser?.name ?? '',
  };
  const { subject, html } = renderContent(subjectRaw, htmlRaw, variables);

  // 4. Configuração de e-mail verificada do tenant — obrigatória
  const emailConfig = await requireEmailConfig(tenantId);

  // 5. Envia
  const sendResult = await emailMessagingService.sendEmail(tenantId, {
    configId: emailConfig.id,
    to: lead.email,
    subject,
    html,
  });

  // 6. Interaction EMAIL OUTBOUND com leadId, SEM dealId
  const interaction = await interactionService.create(tenantId, {
    leadId: lead.id,
    companyId: lead.companyId ?? undefined,
    type: InteractionType.EMAIL,
    direction: InteractionDirection.OUTBOUND,
    subject,
    content: html,
    userId,
    metadata: {
      to: lead.email,
      templateId: data.templateId ?? null,
      configId: emailConfig.id,
      provider: emailConfig.provider,
      messageId: sendResult.messageId ?? null,
      oneToOne: true,
    },
  });

  return { sent: true, interactionId: interaction.id };
}
