// Pendências de atestação — serviço executado que ainda precisa ser atestado.
// Ciclo de vida CONFIGURÁVEL pela UI + criação automática/manual + conversão em
// atestado (reqs 30, 31, 32).

import prisma from '../../config/database.js';
import { createError } from '../../middleware/errorHandler.js';
import { collapseSpaces } from './normalize.js';
import { atestadoService } from './atestadoService.js';
import type { AtestadoData } from './atestadoService.js';
import type { PendenciaOrigem } from '@prisma/client';

// Fluxo-padrão inicial (ajustável pela UI). isFinal marca etapas de conclusão.
const DEFAULT_STATUSES: Array<{ nome: string; ordem: number; isFinal: boolean }> = [
  { nome: 'Necessidade identificada', ordem: 0, isFinal: false },
  { nome: 'Serviço concluído', ordem: 1, isFinal: false },
  { nome: 'Documentação reunida', ordem: 2, isFinal: false },
  { nome: 'Enviado ao cliente', ordem: 3, isFinal: false },
  { nome: 'Assinado pelo cliente', ordem: 4, isFinal: false },
  { nome: 'CAT emitida', ordem: 5, isFinal: true },
  { nome: 'Arquivado', ordem: 6, isFinal: true },
];

export interface PendenciaData {
  titulo: string;
  descricao?: string | null;
  responsavelId?: string | null;
  prazo?: Date | null;
  statusId?: string;
  origem?: PendenciaOrigem;
  dealId?: string | null;
  companyId?: string | null;
  osRef?: string | null;
}

export const pendenciaService = {
  /** Semeia o ciclo de vida padrão (idempotente). Retorna as etapas. */
  async ensureStatuses(tenantId: string) {
    const count = await prisma.pendenciaStatus.count({ where: { tenantId } });
    if (count === 0) {
      for (const s of DEFAULT_STATUSES) {
        await prisma.pendenciaStatus.create({ data: { tenantId, ...s, builtin: true } });
      }
    }
    return prisma.pendenciaStatus.findMany({ where: { tenantId }, orderBy: { ordem: 'asc' } });
  },

  async listStatuses(tenantId: string) {
    return this.ensureStatuses(tenantId);
  },

  async createStatus(tenantId: string, data: { nome: string; ordem?: number; isFinal?: boolean }) {
    const nome = collapseSpaces(data.nome);
    const existing = await prisma.pendenciaStatus.findFirst({ where: { tenantId, nome } });
    if (existing) throw createError('Etapa já existe', 400, 'STATUS_EXISTS');
    const max = await prisma.pendenciaStatus.aggregate({ where: { tenantId }, _max: { ordem: true } });
    return prisma.pendenciaStatus.create({
      data: { tenantId, nome, ordem: data.ordem ?? (max._max.ordem ?? 0) + 1, isFinal: data.isFinal ?? false },
    });
  },

  async updateStatus(tenantId: string, id: string, data: { nome?: string; ordem?: number; isFinal?: boolean }) {
    const existing = await prisma.pendenciaStatus.findFirst({ where: { id, tenantId } });
    if (!existing) throw createError('Etapa não encontrada', 404, 'STATUS_NOT_FOUND');
    return prisma.pendenciaStatus.update({
      where: { id },
      data: {
        ...(data.nome !== undefined ? { nome: collapseSpaces(data.nome) } : {}),
        ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
        ...(data.isFinal !== undefined ? { isFinal: data.isFinal } : {}),
      },
    });
  },

  async removeStatus(tenantId: string, id: string) {
    const existing = await prisma.pendenciaStatus.findFirst({ where: { id, tenantId } });
    if (!existing) throw createError('Etapa não encontrada', 404, 'STATUS_NOT_FOUND');
    const inUse = await prisma.pendencia.count({ where: { tenantId, statusId: id, deletedAt: null } });
    if (inUse > 0) throw createError('Etapa em uso por pendências', 400, 'STATUS_IN_USE');
    await prisma.pendenciaStatus.delete({ where: { id } });
    return { id };
  },

  async list(
    tenantId: string,
    filters: { statusId?: string; responsavelId?: string; atrasadas?: boolean; origem?: PendenciaOrigem } = {}
  ) {
    return prisma.pendencia.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters.statusId ? { statusId: filters.statusId } : {}),
        ...(filters.responsavelId ? { responsavelId: filters.responsavelId } : {}),
        ...(filters.origem ? { origem: filters.origem } : {}),
        ...(filters.atrasadas
          ? { prazo: { lt: new Date() }, status: { isFinal: false } }
          : {}),
      },
      orderBy: [{ prazo: 'asc' }, { createdAt: 'desc' }],
      include: { status: true },
    });
  },

  async get(tenantId: string, id: string) {
    const pendencia = await prisma.pendencia.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { status: true },
    });
    if (!pendencia) throw createError('Pendência não encontrada', 404, 'PENDENCIA_NOT_FOUND');
    return pendencia;
  },

  async create(tenantId: string, data: PendenciaData, createdById?: string) {
    const statuses = await this.ensureStatuses(tenantId);
    const statusId = data.statusId ?? statuses[0]?.id;
    if (!statusId) throw createError('Nenhuma etapa configurada', 400, 'NO_STATUS');
    return prisma.pendencia.create({
      data: {
        tenantId,
        titulo: collapseSpaces(data.titulo),
        descricao: data.descricao ?? null,
        responsavelId: data.responsavelId ?? null,
        prazo: data.prazo ?? null,
        statusId,
        origem: data.origem ?? 'MANUAL',
        dealId: data.dealId ?? null,
        companyId: data.companyId ?? null,
        osRef: data.osRef ?? null,
        createdById: createdById ?? null,
      },
      include: { status: true },
    });
  },

  async update(tenantId: string, id: string, data: Partial<PendenciaData>) {
    const existing = await prisma.pendencia.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Pendência não encontrada', 404, 'PENDENCIA_NOT_FOUND');
    const updateData: Record<string, unknown> = {};
    if (data.titulo !== undefined) updateData.titulo = collapseSpaces(data.titulo);
    for (const key of ['descricao', 'responsavelId', 'prazo', 'statusId', 'dealId', 'companyId', 'osRef'] as const) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (data.statusId) {
      const status = await prisma.pendenciaStatus.findFirst({ where: { id: data.statusId, tenantId } });
      if (!status) throw createError('Etapa inválida', 400, 'STATUS_NOT_FOUND');
    }
    return prisma.pendencia.update({ where: { id }, data: updateData, include: { status: true } });
  },

  async remove(tenantId: string, id: string) {
    const existing = await prisma.pendencia.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Pendência não encontrada', 404, 'PENDENCIA_NOT_FOUND');
    await prisma.pendencia.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  },

  /**
   * Converte a pendência em um atestado do acervo, aproveitando os dados, e marca
   * a pendência como concluída (última etapa final) com o vínculo atestadoId (req 32).
   */
  async convertToAtestado(tenantId: string, id: string, data: AtestadoData, createdById?: string) {
    const pendencia = await prisma.pendencia.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!pendencia) throw createError('Pendência não encontrada', 404, 'PENDENCIA_NOT_FOUND');
    if (pendencia.atestadoId) throw createError('Pendência já convertida', 400, 'ALREADY_CONVERTED');

    const atestado = await atestadoService.create(
      tenantId,
      { ...data, objeto: data.objeto || pendencia.descricao || pendencia.titulo },
      createdById
    );

    const statuses = await this.ensureStatuses(tenantId);
    const finalStatus = [...statuses].reverse().find((s) => s.isFinal) ?? statuses[statuses.length - 1];
    await prisma.pendencia.update({
      where: { id },
      data: { atestadoId: atestado.id, statusId: finalStatus?.id ?? pendencia.statusId },
    });
    return { pendencia: await this.get(tenantId, id), atestado };
  },

  /**
   * Criação automática a partir de um gatilho (Deal ganho / contrato). Idempotente:
   * não duplica pendência já existente para o mesmo deal/contrato (req 31).
   */
  async createFromTrigger(
    tenantId: string,
    input: { origem: PendenciaOrigem; titulo: string; dealId?: string; companyId?: string; osRef?: string }
  ): Promise<{ created: boolean; id?: string }> {
    // Idempotência: por dealId (gatilho de deal) OU por companyId (gatilho de contrato).
    if (input.dealId) {
      const existing = await prisma.pendencia.findFirst({
        where: { tenantId, dealId: input.dealId, origem: input.origem, deletedAt: null },
      });
      if (existing) return { created: false, id: existing.id };
    } else if (input.companyId) {
      const existing = await prisma.pendencia.findFirst({
        where: { tenantId, companyId: input.companyId, origem: input.origem, deletedAt: null },
      });
      if (existing) return { created: false, id: existing.id };
    }
    const pendencia = await this.create(tenantId, {
      titulo: input.titulo,
      origem: input.origem,
      dealId: input.dealId ?? null,
      companyId: input.companyId ?? null,
      osRef: input.osRef ?? null,
    });
    return { created: true, id: pendencia.id };
  },
};
