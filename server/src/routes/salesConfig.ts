import { Router } from 'express';
import { z } from 'zod';
import { PresetEntity, TriggerConditionType } from '@prisma/client';
import { authenticate, requireManagerForWrites } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { salesConfigService } from '../services/salesConfigService.js';

/**
 * Configurações de vendas (Upgrade RD parity — P0) — /api/v1/sales-config
 *
 * Contrato fixado (specs/upgrade-rd-parity.md, design p0):
 *   GET/PUT  /qualification  — escala de 5 níveis + toggle de auto-qualificação
 *   GET/PUT  /flags          — multiSalesEnabled / celebrationEnabled
 *   CRUD     /segments       — CompanySegment
 *   CRUD     /presets        — FieldPreset { entity, field, options, allowCustom }
 *   CRUD     /triggers       — ManagerTrigger (DELETE de isDefault → 400)
 *
 * Leitura livre para autenticados (formulários precisam das listas); escrita
 * exige ADMIN/GESTOR (requireManagerForWrites — padrão das rotas de config).
 */
const router = Router();

router.use(authenticate);
router.use(tenantScope);
router.use(requireManagerForWrites);

// ── Schemas ─────────────────────────────────────────────────────────────────

const qualificationLevelSchema = z.object({
  level: z.number().int().min(1).max(5),
  name: z.string().trim().min(1, 'Informe o nome do nível').max(50),
  maxScore: z.number().int().min(0).nullable().optional(),
});

// Exportado para testes: exatamente 5 níveis (1–5, sem repetição), nomes não
// vazios e maxScore estritamente crescente entre os níveis que o definirem.
export const qualificationSchema = z
  .object({
    levels: z.array(qualificationLevelSchema).length(5, 'A escala deve ter exatamente 5 níveis'),
    autoQualifyEnabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const levelNumbers = [...data.levels].map((l) => l.level).sort((a, b) => a - b);
    if (levelNumbers.join(',') !== '1,2,3,4,5') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['levels'],
        message: 'Os níveis devem ser 1 a 5, sem repetição',
      });
      return;
    }
    const ordered = [...data.levels].sort((a, b) => a.level - b.level);
    let previous: number | null = null;
    for (const level of ordered) {
      if (level.maxScore === null || level.maxScore === undefined) continue;
      if (previous !== null && level.maxScore <= previous) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['levels'],
          message: 'A pontuação máxima deve ser crescente entre os níveis',
        });
        return;
      }
      previous = level.maxScore;
    }
  });

export const flagsSchema = z.object({
  multiSalesEnabled: z.boolean().optional(),
  celebrationEnabled: z.boolean().optional(),
});

const segmentCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do segmento').max(100),
  active: z.boolean().optional(),
});

const segmentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

const presetOptionsSchema = z
  .array(z.string().trim().min(1, 'Opção não pode ser vazia').max(100))
  .min(1, 'Informe pelo menos uma opção');

const presetCreateSchema = z.object({
  entity: z.nativeEnum(PresetEntity),
  field: z.string().trim().min(1).max(50),
  options: presetOptionsSchema,
  allowCustom: z.boolean().optional(),
});

const presetUpdateSchema = presetCreateSchema.partial();

const triggerConditionConfigSchema = z.object({
  days: z.number().int().min(1, 'O número de dias deve ser no mínimo 1').optional(),
  funnelColumnId: z.string().uuid().optional(),
  useCoolingDays: z.boolean().optional(),
  minValue: z.number().positive('O valor mínimo deve ser maior que zero').optional(),
});

const triggerCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do gatilho').max(100),
  conditionType: z.nativeEnum(TriggerConditionType),
  conditionConfig: triggerConditionConfigSchema.default({}),
  notifyOwner: z.boolean().optional(),
  notifyManagers: z.boolean().optional(),
  notifyUserIds: z.array(z.string().uuid()).optional(),
  emailEnabled: z.boolean().optional(),
  active: z.boolean().optional(),
});

const triggerUpdateSchema = triggerCreateSchema.partial();

// ── Qualificação ────────────────────────────────────────────────────────────

router.get('/qualification', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const config = await salesConfigService.getQualificationConfig(req.user.tenantId);
    res.json({ status: 200, data: config });
  } catch (error) {
    next(error);
  }
});

router.put('/qualification', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = qualificationSchema.parse(req.body);
    const config = await salesConfigService.updateQualificationConfig(req.user.tenantId, {
      levels: data.levels.map((l) => ({ ...l, maxScore: l.maxScore ?? null })),
      autoQualifyEnabled: data.autoQualifyEnabled,
    });
    res.json({ status: 200, data: config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ── Flags do tenant ─────────────────────────────────────────────────────────

router.get('/flags', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const flags = await salesConfigService.getFlags(req.user.tenantId);
    res.json({ status: 200, data: flags });
  } catch (error) {
    next(error);
  }
});

router.put('/flags', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = flagsSchema.parse(req.body);
    const flags = await salesConfigService.updateFlags(req.user.tenantId, data);
    res.json({ status: 200, data: flags });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ── Segmentos de empresas ───────────────────────────────────────────────────

router.get('/segments', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const activeOnly = req.query.active === 'true' || req.query.active === '1';
    const segments = await salesConfigService.listSegments(req.user.tenantId, activeOnly);
    res.json({ status: 200, data: segments });
  } catch (error) {
    next(error);
  }
});

router.post('/segments', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = segmentCreateSchema.parse(req.body);
    const segment = await salesConfigService.createSegment(req.user.tenantId, data);
    res.status(201).json({ status: 201, data: segment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.put('/segments/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = segmentUpdateSchema.parse(req.body);
    const segment = await salesConfigService.updateSegment(req.user.tenantId, req.params.id, data);
    res.json({ status: 200, data: segment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/segments/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await salesConfigService.deleteSegment(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// ── Presets (informações pré-definidas) ─────────────────────────────────────

router.get('/presets', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const entityParam = req.query.entity as string | undefined;
    const entity =
      entityParam && Object.values(PresetEntity).includes(entityParam as PresetEntity)
        ? (entityParam as PresetEntity)
        : undefined;
    const presets = await salesConfigService.listPresets(req.user.tenantId, entity);
    res.json({ status: 200, data: presets });
  } catch (error) {
    next(error);
  }
});

router.post('/presets', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = presetCreateSchema.parse(req.body);
    const preset = await salesConfigService.createPreset(req.user.tenantId, data);
    res.status(201).json({ status: 201, data: preset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.put('/presets/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = presetUpdateSchema.parse(req.body);
    const preset = await salesConfigService.updatePreset(req.user.tenantId, req.params.id, data);
    res.json({ status: 200, data: preset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/presets/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await salesConfigService.deletePreset(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// ── Gatilhos gerenciais ─────────────────────────────────────────────────────

router.get('/triggers', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const triggers = await salesConfigService.listTriggers(req.user.tenantId);
    res.json({ status: 200, data: triggers });
  } catch (error) {
    next(error);
  }
});

router.post('/triggers', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = triggerCreateSchema.parse(req.body);
    const trigger = await salesConfigService.createTrigger(req.user.tenantId, data);
    res.status(201).json({ status: 201, data: trigger });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.put('/triggers/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = triggerUpdateSchema.parse(req.body);
    const trigger = await salesConfigService.updateTrigger(req.user.tenantId, req.params.id, data);
    res.json({ status: 200, data: trigger });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/triggers/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await salesConfigService.deleteTrigger(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
