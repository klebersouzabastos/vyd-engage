/**
 * /proposals — ações sobre propostas já geradas (Upgrade RD P2, req 19).
 *
 * A GERAÇÃO de propostas (POST /deals/:id/proposals) e a listagem pertencem ao
 * deal (dono B2). Este grupo cobre o envio para assinatura eletrônica:
 *
 *   POST /proposals/:id/send-signature  { signerEmail, signerName }
 *     → sem credencial de assinatura no tenant: 400 SIGNATURE_NOT_CONFIGURED
 *     → senão: envia ao ZapSign (safeFetch) e grava signatureEnvelopeId + SENT.
 *
 * Multi-tenant: o service valida que a proposta pertence ao tenant do usuário.
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { signatureService } from '../services/signatureService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const sendSignatureSchema = z.object({
  signerEmail: z.string().email(),
  signerName: z.string().min(1),
});

router.post('/:id/send-signature', async (req, res, next) => {
  try {
    const data = sendSignatureSchema.parse(req.body);
    const proposal = await signatureService.sendForSignature(
      req.user!.tenantId,
      req.params.id,
      data
    );
    res.json({ status: 200, data: proposal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

export default router;
