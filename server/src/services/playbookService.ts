import prisma from '../config/database.js';
import { Prisma, TaskType, StakeholderRole, TaskPriority, CommercialFunction } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

export interface PlaybookStepInput {
  order: number;
  title: string;
  actionType: TaskType;
  targetRole?: StakeholderRole | null;
  responsibleFunction?: CommercialFunction | null;
  offsetDays: number;
  priority: TaskPriority;
  description?: string | null;
}

export interface CreatePlaybookData {
  name: string;
  description?: string;
  steps: PlaybookStepInput[];
}

export type UpdatePlaybookData = Partial<CreatePlaybookData>;

const include = { steps: { orderBy: { order: 'asc' as const } } };

function stepData(s: PlaybookStepInput) {
  return {
    order: s.order,
    title: s.title,
    actionType: s.actionType,
    targetRole: s.targetRole ?? null,
    responsibleFunction: s.responsibleFunction ?? null,
    offsetDays: s.offsetDays,
    priority: s.priority,
    description: s.description ?? null,
  };
}

/** Modelos de jornada (playbooks) que geram a sequência de ações do desdobramento. */
export const playbookService = {
  async findAll(tenantId: string) {
    await this.ensureBuiltins(tenantId);
    const items = await prisma.playbookTemplate.findMany({
      where: { tenantId },
      orderBy: [{ isBuiltin: 'desc' }, { name: 'asc' }],
      include,
    });
    return { items };
  },

  async findById(tenantId: string, id: string) {
    const item = await prisma.playbookTemplate.findFirst({
      where: { id, tenantId },
      include,
    });
    if (!item) throw createError('Playbook não encontrado', 404, 'PLAYBOOK_NOT_FOUND');
    return item;
  },

  async create(tenantId: string, createdById: string | undefined, data: CreatePlaybookData) {
    const tpl = await prisma.playbookTemplate.create({
      data: {
        tenantId,
        createdById: createdById || null,
        name: data.name,
        description: data.description || null,
        steps: { create: data.steps.map(stepData) },
      },
      include,
    });
    return tpl;
  },

  async update(tenantId: string, id: string, data: UpdatePlaybookData) {
    const current = await this.findById(tenantId, id);
    if (current.isBuiltin) {
      throw createError('Playbooks padrão não podem ser editados.', 403, 'PLAYBOOK_BUILTIN');
    }
    const updateData: Prisma.PlaybookTemplateUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    // Substitui os steps por completo quando enviados.
    if (data.steps !== undefined) {
      updateData.steps = { deleteMany: {}, create: data.steps.map(stepData) };
    }
    await prisma.playbookTemplate.update({ where: { id }, data: updateData });
    return this.findById(tenantId, id);
  },

  async delete(tenantId: string, id: string) {
    const current = await this.findById(tenantId, id);
    if (current.isBuiltin) {
      throw createError('Playbooks padrão não podem ser removidos.', 403, 'PLAYBOOK_BUILTIN');
    }
    await prisma.playbookTemplate.delete({ where: { id } });
  },

  /** Provisiona os playbooks padrão do tenant (idempotente por nome). */
  async ensureBuiltins(tenantId: string) {
    for (const b of BUILTIN_PLAYBOOKS) {
      const exists = await prisma.playbookTemplate.findFirst({
        where: { tenantId, name: b.name, isBuiltin: true },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.playbookTemplate.create({
        data: {
          tenantId,
          isBuiltin: true,
          name: b.name,
          description: b.description,
          steps: { create: b.steps.map(stepData) },
        },
      });
    }
  },
};

const BUILTIN_PLAYBOOKS: { name: string; description: string; steps: PlaybookStepInput[] }[] = [
  {
    name: 'Acesso a nova conta',
    description: 'Jornada padrão para abrir relacionamento com uma nova empresa até a proposta.',
    steps: [
      {
        order: 1,
        title: 'Mapear decisores e contatos',
        actionType: TaskType.LIGACAO,
        targetRole: StakeholderRole.INFLUENCIADOR,
        responsibleFunction: CommercialFunction.SDR,
        offsetDays: 0,
        priority: TaskPriority.HIGH,
        description: 'Identificar quem decide e quem influencia.',
      },
      {
        order: 2,
        title: 'Ligação de prospecção',
        actionType: TaskType.LIGACAO,
        targetRole: StakeholderRole.DECISOR,
        responsibleFunction: CommercialFunction.SDR,
        offsetDays: 2,
        priority: TaskPriority.HIGH,
        description: null,
      },
      {
        order: 3,
        title: 'Reunião de descoberta',
        actionType: TaskType.REUNIAO,
        targetRole: StakeholderRole.DECISOR,
        responsibleFunction: CommercialFunction.CLOSER,
        offsetDays: 7,
        priority: TaskPriority.MEDIUM,
        description: 'Entender necessidades e critérios.',
      },
      {
        order: 4,
        title: 'Apresentação da empresa',
        actionType: TaskType.APRESENTACAO,
        targetRole: StakeholderRole.DECISOR,
        responsibleFunction: CommercialFunction.CLOSER,
        offsetDays: 14,
        priority: TaskPriority.MEDIUM,
        description: null,
      },
      {
        order: 5,
        title: 'Visita técnica',
        actionType: TaskType.VISITA,
        targetRole: StakeholderRole.TECNICO,
        responsibleFunction: CommercialFunction.PRE_VENDAS,
        offsetDays: 21,
        priority: TaskPriority.MEDIUM,
        description: null,
      },
      {
        order: 6,
        title: 'Envio do pedido de proposta',
        actionType: TaskType.PROPOSTA,
        targetRole: StakeholderRole.APROVADOR,
        responsibleFunction: CommercialFunction.GESTOR,
        offsetDays: 30,
        priority: TaskPriority.URGENT,
        description: null,
      },
    ],
  },
  {
    name: 'Empreendimento de obra',
    description: 'Jornada para acompanhar um empreendimento/obra do cliente até a cotação.',
    steps: [
      {
        order: 1,
        title: 'Reunião de alinhamento do empreendimento',
        actionType: TaskType.REUNIAO,
        targetRole: StakeholderRole.DECISOR,
        responsibleFunction: CommercialFunction.CLOSER,
        offsetDays: 0,
        priority: TaskPriority.HIGH,
        description: null,
      },
      {
        order: 2,
        title: 'Visita ao canteiro/obra',
        actionType: TaskType.VISITA,
        targetRole: StakeholderRole.TECNICO,
        responsibleFunction: CommercialFunction.PRE_VENDAS,
        offsetDays: 5,
        priority: TaskPriority.HIGH,
        description: null,
      },
      {
        order: 3,
        title: 'Apresentação técnica da solução',
        actionType: TaskType.APRESENTACAO,
        targetRole: StakeholderRole.TECNICO,
        responsibleFunction: CommercialFunction.PRE_VENDAS,
        offsetDays: 12,
        priority: TaskPriority.MEDIUM,
        description: null,
      },
      {
        order: 4,
        title: 'Follow-up com decisor',
        actionType: TaskType.LIGACAO,
        targetRole: StakeholderRole.DECISOR,
        responsibleFunction: CommercialFunction.CLOSER,
        offsetDays: 20,
        priority: TaskPriority.MEDIUM,
        description: null,
      },
      {
        order: 5,
        title: 'Pedido de proposta',
        actionType: TaskType.PROPOSTA,
        targetRole: StakeholderRole.APROVADOR,
        responsibleFunction: CommercialFunction.GESTOR,
        offsetDays: 28,
        priority: TaskPriority.URGENT,
        description: null,
      },
    ],
  },
];
