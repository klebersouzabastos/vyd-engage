import prisma from '../../config/database.js';
import { createError } from '../../middleware/errorHandler.js';
import { BUILTIN_TEMPLATES } from './builtinTemplates.js';
import { extractPlaceholders, extractOutline } from './promptUtils.js';

export interface CreateTemplateData {
  name: string;
  description?: string;
  promptBody: string;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string;
  promptBody?: string;
}

type TemplateRow = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  promptBody: string;
  isBuiltin: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Projeção do template para o cliente. O `promptBody` (IP da plataforma) só é
 * incluído para platform admins. Para os demais, expomos apenas os campos a
 * preencher (placeholders) e o resumo do que será entregue (outline) — nunca o
 * texto do prompt.
 */
function toClientTemplate(tpl: TemplateRow, includePrompt: boolean) {
  const base = {
    id: tpl.id,
    tenantId: tpl.tenantId,
    name: tpl.name,
    description: tpl.description,
    isBuiltin: tpl.isBuiltin,
    createdById: tpl.createdById,
    createdAt: tpl.createdAt,
    updatedAt: tpl.updatedAt,
    placeholders: extractPlaceholders(tpl.promptBody),
    outline: extractOutline(tpl.promptBody),
  };
  return includePrompt ? { ...base, promptBody: tpl.promptBody } : base;
}

export const deepResearchTemplateService = {
  /** Garante que os templates semente existam para o tenant (idempotente). */
  async ensureBuiltins(tenantId: string) {
    for (const t of BUILTIN_TEMPLATES) {
      const existing = await prisma.deepResearchTemplate.findFirst({
        where: { tenantId, isBuiltin: true, name: t.name },
        select: { id: true },
      });
      if (!existing) {
        await prisma.deepResearchTemplate.create({
          data: {
            tenantId,
            name: t.name,
            description: t.description,
            promptBody: t.promptBody,
            isBuiltin: true,
          },
        });
      }
    }
  },

  async findAll(tenantId: string, includePrompt = false) {
    await this.ensureBuiltins(tenantId);
    const items = (await prisma.deepResearchTemplate.findMany({
      where: { tenantId },
      orderBy: [{ isBuiltin: 'desc' }, { name: 'asc' }],
    })) as TemplateRow[];
    return { items: items.map((t) => toClientTemplate(t, includePrompt)) };
  },

  async findById(tenantId: string, id: string, includePrompt = false) {
    const tpl = await this.getRaw(tenantId, id);
    return toClientTemplate(tpl, includePrompt);
  },

  /** Uso interno — retorna o template completo (com promptBody). */
  async getRaw(tenantId: string, id: string): Promise<TemplateRow> {
    const tpl = (await prisma.deepResearchTemplate.findFirst({
      where: { id, tenantId },
    })) as TemplateRow | null;
    if (!tpl) {
      throw createError('Template not found', 404, 'DEEP_RESEARCH_TEMPLATE_NOT_FOUND');
    }
    return tpl;
  },

  async create(tenantId: string, createdById: string | undefined, data: CreateTemplateData) {
    const tpl = (await prisma.deepResearchTemplate.create({
      data: {
        tenantId,
        createdById: createdById || null,
        name: data.name,
        description: data.description,
        promptBody: data.promptBody,
        isBuiltin: false,
      },
    })) as TemplateRow;
    return toClientTemplate(tpl, true);
  },

  async update(tenantId: string, id: string, data: UpdateTemplateData) {
    await this.getRaw(tenantId, id);
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.promptBody !== undefined) updateData.promptBody = data.promptBody;
    const tpl = (await prisma.deepResearchTemplate.update({
      where: { id },
      data: updateData,
    })) as TemplateRow;
    return toClientTemplate(tpl, true);
  },

  async delete(tenantId: string, id: string) {
    const tpl = await this.getRaw(tenantId, id);
    if (tpl.isBuiltin) {
      throw createError(
        'Templates padrão não podem ser excluídos',
        403,
        'BUILTIN_TEMPLATE_PROTECTED'
      );
    }
    await prisma.deepResearchTemplate.delete({ where: { id } });
  },
};
