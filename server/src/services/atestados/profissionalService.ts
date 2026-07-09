// Profissionais / Responsáveis Técnicos — acervo técnico-profissional (req 5, 6, 22).

import prisma from '../../config/database.js';
import { createError } from '../../middleware/errorHandler.js';
import { normalizeName, collapseSpaces } from './normalize.js';
import type { VinculoProfissional } from '@prisma/client';

export interface ProfissionalData {
  nome: string;
  titulo?: string | null;
  conselho?: string | null;
  conselhoNum?: string | null;
  conselhoUF?: string | null;
  disciplinas?: string[];
  segmento?: string | null;
  area?: string | null;
  vinculo?: VinculoProfissional;
  vinculoInicio?: Date | null;
  vinculoFim?: Date | null;
  email?: string | null;
  telefone?: string | null;
  curriculoResumo?: string | null;
}

export interface ProfissionalFilters {
  search?: string;
  vinculo?: VinculoProfissional;
  segmento?: string;
  area?: string;
  disciplina?: string;
}

export const profissionalService = {
  async list(tenantId: string, filters: ProfissionalFilters = {}) {
    return prisma.profissional.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters.vinculo ? { vinculo: filters.vinculo } : {}),
        ...(filters.segmento ? { segmento: { contains: filters.segmento, mode: 'insensitive' } } : {}),
        ...(filters.area ? { area: { contains: filters.area, mode: 'insensitive' } } : {}),
        ...(filters.disciplina ? { disciplinas: { has: filters.disciplina } } : {}),
        ...(filters.search
          ? {
              OR: [
                { nome: { contains: filters.search, mode: 'insensitive' } },
                { conselhoNum: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { nome: 'asc' },
    });
  },

  async get(tenantId: string, id: string) {
    const prof = await prisma.profissional.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        responsavelLinks: {
          include: {
            funcoes: true,
            atestado: { select: { id: true, numero: true, contratante: true, objeto: true } },
          },
        },
      },
    });
    if (!prof) throw createError('Profissional não encontrado', 404, 'PROFISSIONAL_NOT_FOUND');
    return prof;
  },

  async create(tenantId: string, data: ProfissionalData) {
    const nome = collapseSpaces(data.nome);
    const nomeNorm = normalizeName(nome);
    const existing = await prisma.profissional.findFirst({ where: { tenantId, nomeNorm, deletedAt: null } });
    if (existing) {
      throw createError('Já existe um profissional com este nome', 400, 'PROFISSIONAL_EXISTS');
    }
    return prisma.profissional.create({
      data: {
        tenantId,
        nome,
        nomeNorm,
        titulo: data.titulo ?? null,
        conselho: data.conselho ?? null,
        conselhoNum: data.conselhoNum ?? null,
        conselhoUF: data.conselhoUF ?? null,
        disciplinas: data.disciplinas ?? [],
        segmento: data.segmento ?? null,
        area: data.area ?? null,
        vinculo: data.vinculo ?? 'CONTRATO',
        vinculoInicio: data.vinculoInicio ?? null,
        vinculoFim: data.vinculoFim ?? null,
        email: data.email ?? null,
        telefone: data.telefone ?? null,
        curriculoResumo: data.curriculoResumo ?? null,
      },
    });
  },

  async update(tenantId: string, id: string, data: Partial<ProfissionalData>) {
    const existing = await prisma.profissional.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Profissional não encontrado', 404, 'PROFISSIONAL_NOT_FOUND');

    const updateData: Record<string, unknown> = {};
    if (data.nome !== undefined) {
      updateData.nome = collapseSpaces(data.nome);
      updateData.nomeNorm = normalizeName(data.nome);
    }
    for (const key of [
      'titulo',
      'conselho',
      'conselhoNum',
      'conselhoUF',
      'segmento',
      'area',
      'vinculo',
      'vinculoInicio',
      'vinculoFim',
      'email',
      'telefone',
      'curriculoResumo',
    ] as const) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (data.disciplinas !== undefined) updateData.disciplinas = data.disciplinas;

    return prisma.profissional.update({ where: { id }, data: updateData });
  },

  async remove(tenantId: string, id: string) {
    const existing = await prisma.profissional.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Profissional não encontrado', 404, 'PROFISSIONAL_NOT_FOUND');
    await prisma.profissional.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  },

  /**
   * Find-or-create por nome normalizado (usado na importação para consolidar os
   * responsáveis distintos). Não sobrescreve dados de um profissional já existente.
   */
  async ensureByName(
    tenantId: string,
    nome: string,
    extra: { importBatchId?: string } = {}
  ): Promise<{ id: string; created: boolean }> {
    const clean = collapseSpaces(nome);
    const nomeNorm = normalizeName(clean);
    const found = await prisma.profissional.findFirst({ where: { tenantId, nomeNorm } });
    if (found) return { id: found.id, created: false };
    const created = await prisma.profissional.create({
      data: { tenantId, nome: clean, nomeNorm, disciplinas: [], importBatchId: extra.importBatchId ?? null },
      select: { id: true },
    });
    return { id: created.id, created: true };
  },
};
