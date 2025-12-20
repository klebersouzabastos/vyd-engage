import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

export interface CreateTagData {
  name: string;
  color?: string;
}

export interface UpdateTagData extends Partial<CreateTagData> {
  id: string;
}

export const tagService = {
  async create(tenantId: string, data: CreateTagData) {
    // Check if tag with same name already exists
    const existing = await prisma.tag.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw createError('Tag with this name already exists', 400, 'TAG_EXISTS');
    }

    const tag = await prisma.tag.create({
      data: {
        tenantId,
        name: data.name,
        color: data.color || '#2563EB',
      },
    });

    return tag;
  },

  async findAll(tenantId: string) {
    return prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  },

  async findById(tenantId: string, id: string) {
    const tag = await prisma.tag.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!tag) {
      throw createError('Tag not found', 404, 'TAG_NOT_FOUND');
    }

    return tag;
  },

  async update(tenantId: string, data: UpdateTagData) {
    await this.findById(tenantId, data.id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;

    // Check name uniqueness if updating name
    if (data.name) {
      const existing = await prisma.tag.findFirst({
        where: {
          tenantId,
          name: data.name,
          id: { not: data.id },
        },
      });

      if (existing) {
        throw createError('Tag with this name already exists', 400, 'TAG_EXISTS');
      }
    }

    return prisma.tag.update({
      where: { id: data.id },
      data: updateData,
    });
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.tag.delete({
      where: { id },
    });
  },
};








