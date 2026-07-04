import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireManagerForWrites } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { questionnaireService } from '../services/questionnaireService.js';

/**
 * Questionários de qualificação (Upgrade RD parity — P0) — /api/v1/questionnaires
 *
 * Contrato fixado:
 *   GET    /?includeInactive=1        — lista (leitura livre)
 *   POST   / | PUT /:id | DELETE /:id — CRUD (ADMIN/GESTOR)
 *   POST   /:id/responses             — { dealId, answers } → score + auto-qualify;
 *                                       retorna { response, dealQualification }
 *   GET    /responses?dealId=X        — histórico com questionário/autor/score/data
 *
 * Responder e consultar respostas são operações do VENDEDOR (qualquer papel
 * autenticado); somente o CRUD de questionários exige GESTOR/ADMIN.
 */
const router = Router();

router.use(authenticate);
router.use(tenantScope);
router.use((req, res, next) => {
  // POST /:id/responses é operacional (vendedor responde dentro do deal).
  if (/^\/[^/]+\/responses\/?$/.test(req.path)) return next();
  return requireManagerForWrites(req, res, next);
});

// ── Schemas ─────────────────────────────────────────────────────────────────

const optionSchema = z.object({
  label: z.string().trim().min(1, 'Informe o texto da opção').max(200),
  points: z.number().int().min(0, 'Pontos não podem ser negativos').max(1000),
});

const questionSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    text: z.string().trim().min(1, 'Informe o texto da pergunta').max(500),
    type: z.enum(['SINGLE', 'MULTI', 'TEXT']),
    options: z.array(optionSchema).optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type !== 'TEXT') {
      if (!q.options || q.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'Perguntas de escolha precisam de pelo menos uma opção',
        });
        return;
      }
      const labels = q.options.map((o) => o.label);
      if (new Set(labels).size !== labels.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'As opções da pergunta devem ter textos únicos',
        });
      }
    }
  });

const questionnaireCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do questionário').max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  active: z.boolean().optional(),
  questions: z.array(questionSchema).min(1, 'Adicione pelo menos uma pergunta'),
});

const questionnaireUpdateSchema = questionnaireCreateSchema.partial();

// Exportado para testes (validação do payload de resposta).
export const respondSchema = z.object({
  dealId: z.string().uuid('Negociação inválida'),
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        optionLabels: z.array(z.string().trim().min(1)).optional(),
        text: z.string().max(5000).optional(),
      })
    )
    .default([]),
});

// ── Rotas ───────────────────────────────────────────────────────────────────

// GET /questionnaires — lista (só ativos por padrão; ?includeInactive=1 traz todos)
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
    const questionnaires = await questionnaireService.findAll(req.user.tenantId, includeInactive);
    res.json({ status: 200, data: questionnaires });
  } catch (error) {
    next(error);
  }
});

// GET /questionnaires/responses?dealId=X — histórico de respostas do deal
// (registrada ANTES de /:id para o path literal não colidir com o parâmetro)
router.get('/responses', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const dealId = z.string().uuid('Negociação inválida').parse(req.query.dealId);
    const responses = await questionnaireService.listResponses(req.user.tenantId, dealId);
    res.json({ status: 200, data: responses });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// POST /questionnaires — cria questionário (ADMIN/GESTOR)
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = questionnaireCreateSchema.parse(req.body);
    const questionnaire = await questionnaireService.create(req.user.tenantId, data);
    res.status(201).json({ status: 201, data: questionnaire });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /questionnaires/:id — atualiza questionário (ADMIN/GESTOR)
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = questionnaireUpdateSchema.parse(req.body);
    const questionnaire = await questionnaireService.update(req.user.tenantId, req.params.id, data);
    res.json({ status: 200, data: questionnaire });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /questionnaires/:id — exclui questionário e respostas (ADMIN/GESTOR)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await questionnaireService.delete(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /questionnaires/:id/responses — responde dentro do deal (qualquer papel)
router.post('/:id/responses', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = respondSchema.parse(req.body);
    const result = await questionnaireService.respond(
      req.user.tenantId,
      req.params.id,
      data,
      req.user.userId
    );
    res.status(201).json({ status: 201, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

export default router;
