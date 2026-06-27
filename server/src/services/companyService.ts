import prisma from '../config/database.js';
import { CompanySize } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

export interface CreateCompanyData {
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: CompanySize | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {
  id: string;
}

export const companyService = {
  async create(tenantId: string, data: CreateCompanyData) {
    const company = await prisma.company.create({
      data: {
        tenantId,
        name: data.name,
        domain: data.domain || null,
        industry: data.industry || null,
        size: data.size || null,
        phone: data.phone || null,
        address: data.address || null,
        website: data.website || null,
        notes: data.notes || null,
      },
      include: {
        _count: { select: { leads: true, deals: true } },
      },
    });

    return company;
  },

  async findById(tenantId: string, id: string) {
    const company = await prisma.company.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        leads: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            source: true,
            score: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        deals: {
          select: {
            id: true,
            name: true,
            value: true,
            stage: true,
            probability: true,
            expectedCloseDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        interactions: {
          select: {
            id: true,
            type: true,
            direction: true,
            subject: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { leads: true, deals: true, interactions: true } },
      },
    });

    if (!company) {
      throw createError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    return company;
  },

  async findAll(
    tenantId: string,
    filters?: {
      search?: string;
      industry?: string;
      size?: CompanySize;
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'asc' | 'desc';
    }
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;
    const sortField = filters?.sort || 'createdAt';
    const sortOrder = filters?.order || 'desc';

    const where: any = { tenantId, deletedAt: null };

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { domain: { contains: filters.search, mode: 'insensitive' } },
        { industry: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.industry) {
      where.industry = { contains: filters.industry, mode: 'insensitive' };
    }

    if (filters?.size) {
      where.size = filters.size;
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          _count: { select: { leads: true, deals: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.company.count({ where }),
    ]);

    return {
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async update(tenantId: string, data: UpdateCompanyData) {
    // Verify ownership
    const existing = await prisma.company.findFirst({
      where: { id: data.id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw createError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    const updateData: any = {
      name: data.name,
      domain: data.domain,
      industry: data.industry,
      size: data.size,
      phone: data.phone,
      address: data.address,
      website: data.website,
      notes: data.notes,
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const company = await prisma.company.update({
      where: { id: data.id },
      data: updateData,
      include: {
        _count: { select: { leads: true, deals: true } },
      },
    });

    return company;
  },

  async delete(tenantId: string, id: string) {
    const company = await prisma.company.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!company) {
      throw createError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // Check for linked leads/deals
    const linkedCount = await prisma.company.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { leads: true, deals: true } },
      },
    });

    if (linkedCount && (linkedCount._count.leads > 0 || linkedCount._count.deals > 0)) {
      throw createError(
        `Cannot delete company with ${linkedCount._count.leads} lead(s) and ${linkedCount._count.deals} deal(s) linked. Unlink them first.`,
        400,
        'COMPANY_HAS_RELATIONS'
      );
    }

    await prisma.company.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async count(tenantId: string) {
    return prisma.company.count({ where: { tenantId, deletedAt: null } });
  },
};
