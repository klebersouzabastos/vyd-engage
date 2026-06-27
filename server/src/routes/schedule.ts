import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { nanoid } from 'nanoid';

const router = Router();

// ========================
// Authenticated routes (manage availability)
// ========================

router.use(authenticate);
router.use(tenantScope);

const availabilitySchema = z.object({
  title: z.string().min(1).max(200),
  duration: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  availableHours: z.record(z.array(z.object({ start: z.string(), end: z.string() }))),
});

// GET /schedule — list this user's availability configs
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const items = await prisma.meetingAvailability.findMany({
      where: { tenantId: req.user.tenantId, userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 200, data: items });
  } catch (error) {
    next(error);
  }
});

// POST /schedule — create availability config
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = availabilitySchema.parse(req.body);
    const slug = nanoid(8).toLowerCase();
    const item = await prisma.meetingAvailability.create({
      data: {
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        slug,
        ...data,
        bufferMinutes: data.bufferMinutes ?? 15,
      },
    });
    res.status(201).json({ status: 201, data: item });
  } catch (error) {
    next(error);
  }
});

// PUT /schedule/:id — update
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const existing = await prisma.meetingAvailability.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, userId: req.user.userId },
    });
    if (!existing) return next(createError('Not found', 404));
    const data = availabilitySchema.partial().parse(req.body);
    const updated = await prisma.meetingAvailability.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ status: 200, data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /schedule/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const existing = await prisma.meetingAvailability.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, userId: req.user.userId },
    });
    if (!existing) return next(createError('Not found', 404));
    await prisma.meetingAvailability.delete({ where: { id: req.params.id } });
    res.json({ status: 200, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
