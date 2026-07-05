import { Router } from 'express';
import { z } from 'zod';
import { whatsappService } from '../services/whatsappService.js';
import { whatsappMessagingService } from '../services/whatsappMessagingService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { WhatsAppProvider, WhatsAppConnectionStatus } from '@prisma/client';
import prisma from '../config/database.js';
import { visibilityScope } from '../services/permissionService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createConnectionSchema = z.object({
  name: z.string().min(1),
  provider: z.nativeEnum(WhatsAppProvider),
  config: z.any(),
  // Copiloto IA (Upgrade RD P3, req 25): ADMIN designa a conexão do copiloto.
  isCopilot: z.boolean().optional(),
});

const updateConnectionSchema = createConnectionSchema.extend({
  id: z.string().uuid(),
  status: z.nativeEnum(WhatsAppConnectionStatus).optional(),
  qrCode: z.string().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const connections = await whatsappService.findAll(req.user.tenantId);
    res.json(connections);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const connection = await whatsappService.findById(req.user.tenantId, req.params.id);
    res.json(connection);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    // Copiloto IA (Upgrade RD P3, req 25): apenas ADMIN pode designar a conexão
    // do copiloto. A criação/edição normal de conexão por não-admin continua livre;
    // só o campo isCopilot é restrito.
    if ('isCopilot' in req.body && req.user.role !== 'ADMIN') {
      return next(
        createError('Apenas administradores podem designar a conexão do copiloto', 403, 'INSUFFICIENT_PERMISSIONS'),
      );
    }

    const data = createConnectionSchema.parse(req.body);
    const connection = await whatsappService.create(req.user.tenantId, data);
    res.status(201).json(connection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    // Copiloto IA (Upgrade RD P3, req 25): apenas ADMIN pode designar a conexão
    // do copiloto. A edição normal de conexão por não-admin continua livre;
    // só o campo isCopilot é restrito.
    if ('isCopilot' in req.body && req.user.role !== 'ADMIN') {
      return next(
        createError('Apenas administradores podem designar a conexão do copiloto', 403, 'INSUFFICIENT_PERMISSIONS'),
      );
    }

    const data = updateConnectionSchema.parse({
      ...req.body,
      id: req.params.id,
    });
    const connection = await whatsappService.update(req.user.tenantId, data);
    res.json(connection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await whatsappService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ========================
// Messaging
// ========================

const sendMessageSchema = z.object({
  connectionId: z.string().uuid(),
  to: z.string().min(10),
  type: z.enum(['text', 'template', 'image', 'document', 'audio']).default('text'),
  content: z.string(),
  templateName: z.string().optional(),
  templateParams: z.array(z.string()).optional(),
  mediaUrl: z.string().url().optional(),
  leadId: z.string().uuid().optional(),
  // Upgrade RD P3 (req 23): vincula a mensagem à timeline do deal/empresa.
  dealId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
});

// POST /api/whatsapp/send - Send a message
router.post('/send', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const data = sendMessageSchema.parse(req.body);

    // Visibilidade viva (P1): quando a mensagem vincula deal/empresa à timeline
    // (cria Interaction), o registro-alvo DEVE estar DENTRO do escopo de
    // visibilidade efetivo do usuário. Sem isso, um analista USER (deals=PROPRIA)
    // escreveria na timeline de um deal de OUTRO dono no mesmo tenant.
    // Espelha EXATAMENTE o padrão de enforceDealOwnership (deals.ts): scope
    // undefined (GERAL) → sem filtro por dono; string (PROPRIA) ou { in } (EQUIPE)
    // → só passa se o dono ∈ escopo. Fora do escopo → 404 (não vaza existência).
    const permUser = {
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      role: req.user.role,
      isPlatformAdmin: req.user.isPlatformAdmin,
    };

    // Rastreia se há um alvo deal/empresa VÁLIDO neste mesmo request. Como as
    // validações de dealId/companyId abaixo abortam com 404 quando o alvo é
    // inválido, chegar ao fim delas com a flag ligada garante que o alvo passou.
    let hasValidDealOrCompany = false;

    if (data.dealId) {
      const scope = await visibilityScope(permUser, 'deals');
      const ok = await prisma.deal.findFirst({
        where: {
          id: data.dealId,
          tenantId: req.user.tenantId,
          deletedAt: null,
          ...(scope === undefined ? {} : { assignedTo: scope }),
        },
        select: { id: true },
      });
      if (!ok) return next(createError('Deal not found', 404, 'DEAL_NOT_FOUND'));
      hasValidDealOrCompany = true;
    }

    if (data.companyId) {
      // companies: no default do analista USER a visibilidade é GERAL → scope
      // undefined → valida ao menos a posse por tenant (não vaza empresa de outro
      // tenant). Um perfil custom pode restringir a PROPRIA/EQUIPE, e aí o filtro
      // por dono passa a valer, sem regredir o comportamento de hoje.
      const scope = await visibilityScope(permUser, 'companies');
      const ok = await prisma.company.findFirst({
        where: {
          id: data.companyId,
          tenantId: req.user.tenantId,
          deletedAt: null,
          ...(scope === undefined ? {} : { assignedTo: scope }),
        },
        select: { id: true },
      });
      if (!ok) return next(createError('Company not found', 404, 'COMPANY_NOT_FOUND'));
      hasValidDealOrCompany = true;
    }

    // leadId propagado ao service (pode ser zerado abaixo se não passar na
    // validação e houver um alvo deal/empresa válido no mesmo request).
    let effectiveLeadId = data.leadId;

    if (data.leadId) {
      // Espelha o padrão de dealId para o lead/contato (escopo 'contacts'): o
      // registro-alvo deve estar DENTRO do escopo de visibilidade efetivo do
      // usuário, senão um analista USER escreveria na timeline de um lead de
      // OUTRO dono no mesmo tenant. Fora do escopo → 404 (não vaza existência).
      const scope = await visibilityScope(permUser, 'contacts');
      const ok = await prisma.lead.findFirst({
        where: {
          id: data.leadId,
          tenantId: req.user.tenantId,
          deletedAt: null,
          ...(scope === undefined ? {} : { assignedTo: scope }),
        },
        select: { id: true },
      });
      if (!ok) {
        // Lead-alvo trashado (soft-deletado) ou fora de escopo. Se há um alvo
        // deal/empresa VÁLIDO no mesmo request, o envio é legítimo pelo deal/
        // empresa (ex.: DealDetail passa deal.leadId junto com dealId): NÃO
        // bloqueia — apenas não propaga o leadId ao service. Se o lead era o
        // ÚNICO alvo, mantém o 404 (não vaza existência).
        if (!hasValidDealOrCompany) {
          return next(createError('Lead not found', 404, 'LEAD_NOT_FOUND'));
        }
        effectiveLeadId = undefined;
      }
    }

    // Propaga o userId do remetente à Interaction criada pelo service (dono B),
    // para que a mensagem apareça na timeline do analista com visibilidade PROPRIA.
    const result = await whatsappMessagingService.sendMessage(req.user.tenantId, {
      ...data,
      leadId: effectiveLeadId,
      userId: req.user.userId,
    });
    res.json({ status: 200, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/whatsapp/:id/templates - Get message templates
router.get('/:id/templates', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const templates = await whatsappMessagingService.getTemplates(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: templates });
  } catch (error) {
    next(error);
  }
});

export default router;
