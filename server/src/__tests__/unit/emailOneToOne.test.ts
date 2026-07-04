import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractionDirection, InteractionType } from '@prisma/client';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P0 (e-mail 1:1 no deal, spec req 10):
 *  - sem EmailConfig verificada do tenant → 400 claro (EMAIL_CONFIG_MISSING);
 *  - envio resolve variáveis {{nome}}/{{empresa}}/{{negociacao}}/{{valor}}/
 *    {{responsavel}} e registra Interaction EMAIL OUTBOUND no deal.
 */
vi.mock('../../services/emailMessagingService.js', () => ({
  emailMessagingService: { sendEmail: vi.fn(async () => ({ messageId: 'msg-1', status: 'sent' })) },
}));
vi.mock('../../services/interactionService.js', () => ({
  interactionService: { create: vi.fn(async () => ({ id: 'int-1' })) },
}));

import { emailMessagingService } from '../../services/emailMessagingService.js';
import { interactionService } from '../../services/interactionService.js';
import { sendDealEmail } from '../../services/emailOneToOneService.js';

const tenantId = 't1';

const baseDeal = {
  id: 'd1',
  tenantId,
  name: 'Contrato Anual',
  value: 12500.5,
  companyId: 'c1',
  lead: { id: 'l1', name: 'Maria Silva', email: 'maria@acme.com', company: 'ACME' },
  company: { id: 'c1', name: 'ACME Ltda' },
  assignedUser: { id: 'u1', name: 'João Vendedor' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendDealEmail', () => {
  it('retorna 400 claro quando o tenant não tem EmailConfig verificada', async () => {
    prismaMock.deal.findFirst.mockResolvedValue(baseDeal as never);
    prismaMock.emailConfig.findFirst.mockResolvedValue(null as never);

    await expect(
      sendDealEmail(tenantId, 'u1', 'd1', { subject: 'Olá', html: '<p>Oi</p>' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'EMAIL_CONFIG_MISSING' });

    expect(emailMessagingService.sendEmail).not.toHaveBeenCalled();
    expect(interactionService.create).not.toHaveBeenCalled();
  });

  it('envia com variáveis resolvidas e registra Interaction EMAIL OUTBOUND no deal', async () => {
    prismaMock.deal.findFirst.mockResolvedValue(baseDeal as never);
    prismaMock.emailConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      provider: 'RESEND',
    } as never);

    const result = await sendDealEmail(tenantId, 'u1', 'd1', {
      subject: 'Proposta para {{nome}} — {{negociacao}}',
      html: '<p>{{empresa}} | {{responsavel}}</p>',
    });

    expect(result).toEqual({ sent: true, interactionId: 'int-1' });

    const sendArgs = (emailMessagingService.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sendArgs[0]).toBe(tenantId);
    expect(sendArgs[1]).toMatchObject({
      configId: 'cfg-1',
      to: 'maria@acme.com',
      subject: 'Proposta para Maria Silva — Contrato Anual',
      html: '<p>ACME Ltda | João Vendedor</p>',
    });

    const interactionArgs = (interactionService.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(interactionArgs[0]).toBe(tenantId);
    expect(interactionArgs[1]).toMatchObject({
      dealId: 'd1',
      leadId: 'l1',
      type: InteractionType.EMAIL,
      direction: InteractionDirection.OUTBOUND,
      userId: 'u1',
    });
  });

  it('exige modelo OU assunto+corpo (400 VALIDATION_ERROR)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue(baseDeal as never);

    await expect(sendDealEmail(tenantId, 'u1', 'd1', { subject: 'Só assunto' })).rejects.toMatchObject(
      { statusCode: 400 }
    );
    expect(emailMessagingService.sendEmail).not.toHaveBeenCalled();
  });

  it('usa o EmailTemplate do tenant quando templateId é informado', async () => {
    prismaMock.deal.findFirst.mockResolvedValue(baseDeal as never);
    prismaMock.emailTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      subject: 'Sobre {{negociacao}}',
      html: '<p>Olá {{nome}}</p>',
    } as never);
    prismaMock.emailConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      provider: 'SMTP',
    } as never);

    await sendDealEmail(tenantId, 'u1', 'd1', { templateId: 'tpl-1' });

    const sendArgs = (emailMessagingService.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sendArgs[1]).toMatchObject({
      subject: 'Sobre Contrato Anual',
      html: '<p>Olá Maria Silva</p>',
    });
  });

  it('contato sem e-mail → 400 CONTACT_WITHOUT_EMAIL', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      ...baseDeal,
      lead: { id: 'l1', name: 'Sem Email', email: null, company: null },
    } as never);

    await expect(
      sendDealEmail(tenantId, 'u1', 'd1', { subject: 'Olá', html: '<p>Oi</p>' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'CONTACT_WITHOUT_EMAIL' });
  });
});
