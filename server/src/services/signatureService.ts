/**
 * signatureService — assinatura eletrônica plugável, GATED (Upgrade RD P2, req 19).
 *
 * Primeiro provedor: ZapSign (https://docs.zapsign.com.br). O envio cria um
 * documento a partir do PDF da proposta (base64) e um signatário; o provedor
 * devolve um token de envelope que guardamos em `Proposal.signatureEnvelopeId`.
 * O acompanhamento de status vem por webhook (POST /webhooks/zapsign), validado
 * por HMAC com o `webhookSecret` do tenant.
 *
 * GATING: sem `IntegrationConfig` kind=SIGNATURE, `sendForSignature` lança
 * 400 SIGNATURE_NOT_CONFIGURED e a UI oculta o recurso.
 *
 * SEGURANÇA: toda chamada externa passa por `assertPublicHttpUrl` (anti-SSRF)
 * + timeout via AbortController. O PDF é lido pelo storageService (provider "db").
 *
 * NOTA: não temos conta ZapSign neste ambiente; o cliente segue a API pública
 * documentada e é exercido nos testes com `fetch` MOCKADO.
 */
import type { SignatureStatus } from '@prisma/client';
import prisma from '../config/database.js';
import crypto from 'crypto';
import { createError } from '../middleware/errorHandler.js';
import { assertPublicHttpUrl } from '../utils/safeFetch.js';
import { integrationService, type SignatureConfig } from './integrationService.js';
import { storageService } from './storageService.js';
import { notificationService } from './notificationService.js';
import { NotificationType } from '@prisma/client';
import { logger } from '../utils/logger.js';

const ZAPSIGN_BASE_URL = 'https://api.zapsign.com.br/api/v1';
const REQUEST_TIMEOUT_MS = 15000;

/** fetch com timeout + validação anti-SSRF do destino. */
async function safeFetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; body: any }> {
  await assertPublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Mapeia o `status` textual do ZapSign para o nosso enum SignatureStatus.
 * ZapSign usa: signed / refused / pending / new / expired; eventos de webhook
 * incluem doc_signed, doc_refused, doc_viewed, etc. Cobrimos ambos.
 */
function mapZapSignStatus(raw: string | undefined | null): SignatureStatus | null {
  const s = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (!s) return null;
  if (s.includes('sign')) return 'SIGNED';
  if (s.includes('refus') || s.includes('reject') || s.includes('cancel')) return 'REFUSED';
  if (s.includes('view') || s.includes('open')) return 'VIEWED';
  if (s.includes('expir')) return 'EXPIRED';
  if (s === 'new' || s === 'pending' || s.includes('sent')) return 'SENT';
  return null;
}

export const signatureService = {
  mapZapSignStatus,

  /** True quando o tenant tem credencial de assinatura ativa. */
  async isConfigured(tenantId: string): Promise<boolean> {
    return (await integrationService.getConfig<SignatureConfig>(tenantId, 'SIGNATURE')) !== null;
  },

  /**
   * Envia a proposta gerada (PDF) para assinatura via ZapSign.
   * - Sem credencial → 400 SIGNATURE_NOT_CONFIGURED.
   * - Proposta inexistente/de outro tenant → 404.
   * Grava `signatureEnvelopeId` + `signatureStatus=SENT` e retorna a Proposal.
   */
  async sendForSignature(
    tenantId: string,
    proposalId: string,
    signer: { signerEmail: string; signerName: string }
  ) {
    const config = await integrationService.getConfig<SignatureConfig>(tenantId, 'SIGNATURE');
    if (!config) {
      throw createError(
        'Assinatura eletrônica não configurada para este tenant.',
        400,
        'SIGNATURE_NOT_CONFIGURED'
      );
    }

    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, tenantId },
      include: { attachment: true },
    });
    if (!proposal || !proposal.attachment) {
      throw createError('Proposta não encontrada.', 404, 'PROPOSAL_NOT_FOUND');
    }

    // Lê o PDF do storage e envia como base64 (ZapSign aceita base64_pdf).
    const pdfBuffer = await storageService.get(proposal.attachment);
    const base64Pdf = pdfBuffer.toString('base64');

    const url = `${ZAPSIGN_BASE_URL}/docs/`;
    const payload = {
      name: proposal.attachment.name,
      base64_pdf: base64Pdf,
      signers: [{ name: signer.signerName, email: signer.signerEmail }],
      // não redirecionar/branding — mínimo necessário
      lang: 'pt-br',
    };

    const { ok, status, body } = await safeFetchJson(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!ok) {
      logger.warn('ZapSign send failed', { status, tenantId, proposalId });
      throw createError(
        'Falha ao enviar a proposta para assinatura no provedor.',
        502,
        'SIGNATURE_PROVIDER_ERROR',
        { providerStatus: status }
      );
    }

    // ZapSign devolve o token do documento (envelope).
    const envelopeId: string | undefined = body?.token || body?.doc?.token || body?.id;
    if (!envelopeId) {
      throw createError(
        'Provedor de assinatura não retornou um identificador de envelope.',
        502,
        'SIGNATURE_PROVIDER_ERROR'
      );
    }

    const updated = await prisma.proposal.update({
      where: { id: proposal.id },
      data: { signatureEnvelopeId: envelopeId, signatureStatus: 'SENT' },
    });
    return updated;
  },

  /**
   * Valida a assinatura HMAC-SHA256 do webhook ZapSign contra o `webhookSecret`
   * do tenant. O ZapSign envia o header configurado no painel; aceitamos o
   * cabeçalho tanto como hex quanto `sha256=<hex>`. Comparação timing-safe.
   */
  verifyWebhookSignature(secret: string, rawBody: string, headerSignature: string | undefined): boolean {
    if (!headerSignature) return false;
    const provided = headerSignature.startsWith('sha256=')
      ? headerSignature.slice('sha256='.length)
      : headerSignature;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (provided.length !== expected.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  },

  /**
   * Processa um evento de webhook do ZapSign. Identifica o tenant pelo envelopeId
   * (Proposal.signatureEnvelopeId, único por documento), VALIDA o HMAC com o
   * secret desse tenant, atualiza `signatureStatus` e, quando SIGNED, notifica o
   * responsável pelo deal (Notification PROPOSAL_SIGNED).
   *
   * Retorna { handled, status } — nunca lança para o handler (webhook responde 200).
   */
  async handleWebhook(
    rawBody: string,
    headerSignature: string | undefined
  ): Promise<{ handled: boolean; reason?: string; signatureStatus?: SignatureStatus }> {
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { handled: false, reason: 'invalid_json' };
    }

    const envelopeId: string | undefined =
      payload?.token || payload?.doc?.token || payload?.external_id;
    if (!envelopeId) return { handled: false, reason: 'no_envelope_id' };

    // Identifica o tenant/proposta pelo envelope. Proposal não tem relação `deal`
    // no schema (só `dealId`), então buscamos o deal separadamente.
    const proposal = await prisma.proposal.findFirst({
      where: { signatureEnvelopeId: envelopeId },
    });
    if (!proposal) return { handled: false, reason: 'proposal_not_found' };
    const deal = await prisma.deal.findUnique({
      where: { id: proposal.dealId },
      select: { id: true, name: true, assignedTo: true },
    });

    // Valida o HMAC com o secret do tenant dono da proposta.
    const config = await integrationService.getConfig<SignatureConfig>(
      proposal.tenantId,
      'SIGNATURE'
    );
    if (!config) return { handled: false, reason: 'not_configured' };
    if (!this.verifyWebhookSignature(config.webhookSecret, rawBody, headerSignature)) {
      logger.warn('ZapSign webhook: invalid signature', { envelopeId });
      return { handled: false, reason: 'invalid_signature' };
    }

    const rawStatus: string | undefined =
      payload?.status || payload?.doc?.status || payload?.event_type || payload?.event;
    const nextStatus = mapZapSignStatus(rawStatus);
    if (!nextStatus) return { handled: false, reason: 'unmapped_status' };

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { signatureStatus: nextStatus },
    });

    // Notifica o responsável pelo deal quando assinado.
    if (nextStatus === 'SIGNED' && deal?.assignedTo) {
      await notificationService
        .create(proposal.tenantId, {
          userId: deal.assignedTo,
          type: NotificationType.PROPOSAL_SIGNED,
          title: 'Proposta assinada',
          message: `A proposta da negociação "${deal.name}" foi assinada.`,
          link: `/app/deals/${deal.id}`,
          metadata: { proposalId: proposal.id, dealId: deal.id },
        })
        .catch((err) => logger.error('Falha ao notificar assinatura', err));

      // Evento na timeline do deal.
      await prisma.interaction
        .create({
          data: {
            tenantId: proposal.tenantId,
            dealId: deal.id,
            type: 'NOTE',
            direction: 'INBOUND',
            content: `Proposta v${proposal.version} assinada eletronicamente.`,
            metadata: { proposalId: proposal.id, signatureStatus: nextStatus },
          },
        })
        .catch((err) => logger.error('Falha ao registrar interação de assinatura', err));
    }

    return { handled: true, signatureStatus: nextStatus };
  },
};
