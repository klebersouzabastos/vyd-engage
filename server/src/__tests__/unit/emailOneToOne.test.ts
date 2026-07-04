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
import { sendDealEmail, sendLeadEmail } from '../../services/emailOneToOneService.js';

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

  it('escapa variáveis e sanitiza HTML final antes de enviar/gravar (#13, anti-XSS)', async () => {
    // Nome do lead com payload de XSS; corpo com <script>.
    prismaMock.deal.findFirst.mockResolvedValue({
      ...baseDeal,
      lead: {
        id: 'l1',
        name: '<img src=x onerror=alert(1)>',
        email: 'maria@acme.com',
        company: 'ACME',
      },
    } as never);
    prismaMock.emailConfig.findFirst.mockResolvedValue({ id: 'cfg-1', provider: 'RESEND' } as never);

    await sendDealEmail(tenantId, 'u1', 'd1', {
      subject: 'Olá {{nome}}',
      html: '<p>Oi {{nome}}</p><script>alert(2)</script>',
    });

    const sendArgs = (emailMessagingService.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentHtml = sendArgs[1].html as string;
    const sentSubject = sendArgs[1].subject as string;
    // Variável escapada: nada de onerror/tag ativa vindo do nome.
    expect(sentHtml).not.toContain('onerror=');
    expect(sentHtml).not.toContain('<img');
    expect(sentHtml).toContain('&lt;img');
    // sanitizeHtml removeu o <script> do corpo.
    expect(sentHtml).not.toMatch(/<script/i);
    // Assunto é header de TEXTO PURO (não é contexto HTML): a variável entra crua,
    // sem escape (senão "A & B" viraria "A &amp; B" no header do e-mail). A proteção
    // XSS aplica-se ao CORPO (acima), que é o único conteúdo renderizado como HTML.
    expect(sentSubject).toBe('Olá <img src=x onerror=alert(1)>');

    // O content gravado na Interaction é o MESMO html sanitizado.
    const interactionArgs = (interactionService.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(interactionArgs[1].content).toBe(sentHtml);
    expect(interactionArgs[1].content).not.toMatch(/<script/i);
  });
});

describe('sendLeadEmail (#11 — e-mail 1:1 pelo lead, sem deal)', () => {
  const baseLead = {
    id: 'l9',
    tenantId,
    name: 'Carla Prospect',
    email: 'carla@lead.com',
    company: 'Lead Corp',
    companyId: 'c9',
    companyRef: { id: 'c9', name: 'Lead Corp Ltda' },
    assignedUser: { id: 'u2', name: 'Pedro Vendedor' },
  };

  it('lead sem e-mail → 400 CONTACT_WITHOUT_EMAIL (não envia nem grava)', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ ...baseLead, email: null } as never);

    await expect(
      sendLeadEmail(tenantId, 'u2', 'l9', { subject: 'Olá', html: '<p>Oi</p>' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'CONTACT_WITHOUT_EMAIL' });

    expect(emailMessagingService.sendEmail).not.toHaveBeenCalled();
    expect(interactionService.create).not.toHaveBeenCalled();
  });

  it('lead inexistente no tenant → 404 CONTACT_NOT_FOUND', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null as never);

    await expect(
      sendLeadEmail(tenantId, 'u2', 'l9', { subject: 'Olá', html: '<p>Oi</p>' })
    ).rejects.toMatchObject({ statusCode: 404, code: 'CONTACT_NOT_FOUND' });
    expect(emailMessagingService.sendEmail).not.toHaveBeenCalled();
  });

  it('sem EmailConfig verificada → 400 EMAIL_CONFIG_MISSING', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(baseLead as never);
    prismaMock.emailConfig.findFirst.mockResolvedValue(null as never);

    await expect(
      sendLeadEmail(tenantId, 'u2', 'l9', { subject: 'Olá', html: '<p>Oi</p>' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'EMAIL_CONFIG_MISSING' });
  });

  it('envia com variáveis do lead e grava Interaction EMAIL OUTBOUND com leadId e SEM dealId', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(baseLead as never);
    prismaMock.emailConfig.findFirst.mockResolvedValue({ id: 'cfg-1', provider: 'RESEND' } as never);

    const result = await sendLeadEmail(tenantId, 'u2', 'l9', {
      subject: 'Olá {{nome}} da {{empresa}}',
      html: '<p>{{responsavel}} | neg="{{negociacao}}" val="{{valor}}"</p>',
    });

    expect(result).toEqual({ sent: true, interactionId: 'int-1' });

    const sendArgs = (emailMessagingService.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sendArgs[1]).toMatchObject({
      configId: 'cfg-1',
      to: 'carla@lead.com',
      subject: 'Olá Carla Prospect da Lead Corp Ltda',
      // Sem deal → negociacao e valor vazios.
      html: '<p>Pedro Vendedor | neg="" val=""</p>',
    });

    const interactionArgs = (interactionService.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(interactionArgs[1]).toMatchObject({
      leadId: 'l9',
      companyId: 'c9',
      type: InteractionType.EMAIL,
      direction: InteractionDirection.OUTBOUND,
      userId: 'u2',
    });
    // Garante que NÃO vincula a um deal.
    expect(interactionArgs[1].dealId).toBeUndefined();
  });

  it('escapa nome do lead com XSS antes de interpolar (#13/#11)', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      ...baseLead,
      name: '<b onmouseover=x>Carla</b>',
    } as never);
    prismaMock.emailConfig.findFirst.mockResolvedValue({ id: 'cfg-1', provider: 'RESEND' } as never);

    await sendLeadEmail(tenantId, 'u2', 'l9', {
      subject: 'Oi',
      html: '<p>{{nome}}</p>',
    });

    const sendArgs = (emailMessagingService.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentHtml = sendArgs[1].html as string;
    expect(sentHtml).not.toContain('onmouseover');
    expect(sentHtml).toContain('&lt;b');
  });
});
