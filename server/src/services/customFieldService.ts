import prisma from '../config/database.js';
import { Prisma, CustomFieldType, CustomFieldEntity, CustomFieldVisibility } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

export interface CreateCustomFieldData {
  name: string;
  type: CustomFieldType;
  options?: string[]; // For select / multi-select type
  required?: boolean;
  order?: number;
  entity?: CustomFieldEntity | null; // DEAL|COMPANY|CONTACT|PRODUCT; null = legado (todas)
  visibility?: CustomFieldVisibility;
}

export interface UpdateCustomFieldData extends Partial<CreateCustomFieldData> {
  id: string;
  active?: boolean;
}

export const customFieldService = {
  async create(tenantId: string, data: CreateCustomFieldData) {
    // Check if field with same name already exists
    const existing = await prisma.customField.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw createError('Custom field with this name already exists', 400, 'FIELD_EXISTS');
    }

    const field = await prisma.customField.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        options: data.options || Prisma.JsonNull,
        entity: data.entity ?? null,
        visibility: data.visibility ?? CustomFieldVisibility.VISIBLE,
        required: data.required || false,
        order: data.order || 0,
        active: true,
      },
    });

    return field;
  },

  async findAll(tenantId: string, activeOnly: boolean = false, entity?: CustomFieldEntity) {
    const where: any = { tenantId };
    if (activeOnly) {
      where.active = true;
    }
    // Por entidade: inclui os campos da entidade pedida + os legados (entity=null,
    // visíveis em todas as entidades por compatibilidade).
    if (entity) {
      where.OR = [{ entity }, { entity: null }];
    }

    return prisma.customField.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  },

  async findById(tenantId: string, id: string) {
    const field = await prisma.customField.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!field) {
      throw createError('Custom field not found', 404, 'CUSTOM_FIELD_NOT_FOUND');
    }

    return field;
  },

  async update(tenantId: string, data: UpdateCustomFieldData) {
    await this.findById(tenantId, data.id);

    // Check name uniqueness if updating name
    if (data.name) {
      const existing = await prisma.customField.findFirst({
        where: {
          tenantId,
          name: data.name,
          id: { not: data.id },
        },
      });

      if (existing) {
        throw createError('Custom field with this name already exists', 400, 'FIELD_EXISTS');
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.options !== undefined) updateData.options = data.options || Prisma.JsonNull;
    if (data.required !== undefined) updateData.required = data.required;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.entity !== undefined) updateData.entity = data.entity;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;

    return prisma.customField.update({
      where: { id: data.id },
      data: updateData,
    });
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.customField.delete({
      where: { id },
    });
  },
};
