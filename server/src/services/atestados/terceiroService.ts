// Terceiros / parceiros donos de atestados (consórcios e parcerias) — req 25, 26.

import prisma from '../../config/database.js';
import { createError } from '../../middleware/errorHandler.js';
import { collapseSpaces } from './normalize.js';
import type { NaturezaParceria } from '@prisma/client';

export interface TerceiroData {
  empresa: string;
  contatoNome?: string | null;
  contatoEmail?: string | null;
  contatoTelefone?: string | null;
  validadeParceria?: Date | null;
  condicoes?: string | null;
  usoLivre?: boolean;
  naturezaParceria?: NaturezaParceria | null;
}

export const terceiroService = {
  async list(tenantId: string, search?: string) {
    return prisma.terceiro.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(search ? { empresa: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { empresa: 'asc' },
      include: { _count: { select: { atestados: true } } },
    });
  },

  async get(tenantId: string, id: string) {
    const terceiro = await prisma.terceiro.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { atestados: { where: { deletedAt: null }, select: { id: true, numero: true, objeto: true } } },
    });
    if (!terceiro) throw createError('Parceiro não encontrado', 404, 'TERCEIRO_NOT_FOUND');
    return terceiro;
  },

  async create(tenantId: string, data: TerceiroData) {
    return prisma.terceiro.create({
      data: {
        tenantId,
        empresa: collapseSpaces(data.empresa),
        contatoNome: data.contatoNome ?? null,
        contatoEmail: data.contatoEmail ?? null,
        contatoTelefone: data.contatoTelefone ?? null,
        validadeParceria: data.validadeParceria ?? null,
        condicoes: data.condicoes ?? null,
        usoLivre: data.usoLivre ?? false,
        naturezaParceria: data.naturezaParceria ?? null,
      },
    });
  },

  async update(tenantId: string, id: string, data: Partial<TerceiroData>) {
    const existing = await prisma.terceiro.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Parceiro não encontrado', 404, 'TERCEIRO_NOT_FOUND');
    const updateData: Record<string, unknown> = {};
    if (data.empresa !== undefined) updateData.empresa = collapseSpaces(data.empresa);
    for (const key of [
      'contatoNome',
      'contatoEmail',
      'contatoTelefone',
      'validadeParceria',
      'condicoes',
      'usoLivre',
      'naturezaParceria',
    ] as const) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    return prisma.terceiro.update({ where: { id }, data: updateData });
  },

  async remove(tenantId: string, id: string) {
    const existing = await prisma.terceiro.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Parceiro não encontrado', 404, 'TERCEIRO_NOT_FOUND');
    await prisma.terceiro.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  },
};
