import prisma from '../config/database.js';
import { InteractionDirection, InteractionType } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { emailMessagingService } from './emailMessagingService.js';
import { interactionService } from './interactionService.js';

/**
 * E-mail 1:1 a partir da negociação (Upgrade RD P0, spec req 10).
 *
 * Usa um EmailTemplate do tenant (ou assunto/corpo avulsos), resolve as
 * variáveis {{nome}} {{empresa}} {{negociacao}} {{valor}} {{responsavel}},
 * envia pela configuração de e-mail existente (EmailConfig verificada) e
 * registra Interaction EMAIL OUTBOUND na timeline do deal.
 */

export interface SendDealEmailData {
  templateId?: string;
  subject?: string;
  html?: string;
  /** Destinatário (lead/contato) — padrão: contato principal do deal. */
  leadId?: string;
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

  // 4. Variáveis do contrato: {{nome}} {{empresa}} {{negociacao}} {{valor}} {{responsavel}}
  const variables: Record<string, string> = {
    nome: recipient.name ?? '',
    empresa: deal.company?.name ?? recipient.company ?? '',
    negociacao: deal.name,
    valor: Number(deal.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    responsavel: deal.assignedUser?.name ?? '',
  };
  subject = applyVariables(subject, variables);
  html = applyVariables(html, variables);

  // 5. Configuração de e-mail do tenant — obrigatória (400 claro se ausente)
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

  // 6. Envia pelo serviço existente. NÃO passamos leadId aqui de propósito:
  //    a Interaction é criada abaixo já vinculada ao DEAL (contrato do design),
  //    evitando um registro duplicado só com leadId.
  const sendResult = await emailMessagingService.sendEmail(tenantId, {
    configId: emailConfig.id,
    to: recipient.email,
    subject,
    html,
  });

  // 7. Interaction EMAIL OUTBOUND na timeline do deal
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
