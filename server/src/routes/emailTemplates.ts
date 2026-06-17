import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(500),
  html: z.string().min(1),
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const templates = await prisma.emailTemplate.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, subject: true, createdAt: true, updatedAt: true },
    });
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const template = await prisma.emailTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!template) return next(createError('Template não encontrado', 404));
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = templateSchema.parse(req.body);
    const template = await prisma.emailTemplate.create({
      data: { ...data, tenantId: req.user.tenantId },
    });
    res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = templateSchema.partial().parse(req.body);
    const existing = await prisma.emailTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!existing) return next(createError('Template não encontrado', 404));
    const template = await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data,
    });
    res.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const existing = await prisma.emailTemplate.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!existing) return next(createError('Template não encontrado', 404));
    await prisma.emailTemplate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
