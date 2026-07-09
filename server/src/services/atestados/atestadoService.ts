// Atestado técnico / CAT — CRUD do acervo, responsáveis/funções/quantitativos,
// documento digital (extração de texto + indexação RAG). Reqs 1-4, 7-15.

import prisma from '../../config/database.js';
import { createError } from '../../middleware/errorHandler.js';
import { collapseSpaces, normalizeName } from './normalize.js';
import { profissionalService } from './profissionalService.js';
import { ragService } from './ragService.js';
import { ocrService } from './ocrService.js';
import type { AtestadoOrigem, AcervoTipo, AtestadoDocStatus, Prisma } from '@prisma/client';

export interface FuncaoInput {
  funcao: string;
  categoria?: string | null;
}
export interface ResponsavelInput {
  profissionalId?: string;
  nome?: string;
  funcoes: FuncaoInput[];
}
export interface QuantitativoInput {
  grandeza: string;
  valor: number;
  unidade: string;
  descricao?: string | null;
}
export interface AtestadoData {
  numero: string;
  caixa?: string | null;
  contratante: string;
  contrato?: string | null;
  objeto: string;
  periodoTexto?: string | null;
  dataInicio?: Date | null;
  dataConclusao?: Date | null;
  valorContrato?: number | null;
  origem?: AtestadoOrigem;
  acervoTipo?: AcervoTipo;
  artNumero?: string | null;
  catNumero?: string | null;
  conselho?: string | null;
  conselhoUF?: string | null;
  terceiroId?: string | null;
  responsaveis?: ResponsavelInput[];
  quantitativos?: QuantitativoInput[];
}

export interface AtestadoFilters {
  search?: string;
  origem?: AtestadoOrigem;
  acervoTipo?: AcervoTipo;
  docStatus?: AtestadoDocStatus;
  contratante?: string;
  categoria?: string;
  profissionalId?: string;
  terceiroId?: string;
  grandeza?: string;
  valorMinimo?: number;
  includeTerceiros?: boolean;
  conselho?: string;
  conselhoUF?: string;
  dataInicioDe?: Date;
  dataInicioAte?: Date;
  dataConclusaoDe?: Date;
  dataConclusaoAte?: Date;
  valorContratoMin?: number;
  valorContratoMax?: number;
}

const detailInclude = {
  responsaveis: {
    include: {
      profissional: { select: { id: true, nome: true, vinculo: true, conselho: true, conselhoUF: true } },
      funcoes: true,
    },
  },
  quantitativos: true,
  terceiro: { select: { id: true, empresa: true, usoLivre: true, naturezaParceria: true } },
} satisfies Prisma.AtestadoInclude;

/** Resolve os profissionalId dos responsáveis (find-or-create por nome quando preciso). */
async function resolveResponsaveis(
  tenantId: string,
  responsaveis: ResponsavelInput[]
): Promise<Array<{ profissionalId: string; funcoes: FuncaoInput[] }>> {
  const out: Array<{ profissionalId: string; funcoes: FuncaoInput[] }> = [];
  for (const r of responsaveis) {
    let profissionalId = r.profissionalId;
    if (!profissionalId && r.nome) {
      const ensured = await profissionalService.ensureByName(tenantId, r.nome);
      profissionalId = ensured.id;
    }
    if (!profissionalId) continue;
    out.push({ profissionalId, funcoes: r.funcoes || [] });
  }
  return out;
}

export const atestadoService = {
  async list(tenantId: string, filters: AtestadoFilters = {}) {
    const where: Prisma.AtestadoWhereInput = {
      tenantId,
      deletedAt: null,
      ...(filters.origem ? { origem: filters.origem } : {}),
      ...(!filters.origem && filters.includeTerceiros === false ? { origem: 'PROPRIO' } : {}),
      // AMBOS comprova operacional E profissional: ao filtrar por um deles, inclui AMBOS.
      ...(filters.acervoTipo
        ? filters.acervoTipo === 'AMBOS'
          ? { acervoTipo: 'AMBOS' as const }
          : { acervoTipo: { in: [filters.acervoTipo, 'AMBOS'] } }
        : {}),
      ...(filters.docStatus ? { docStatus: filters.docStatus } : {}),
      ...(filters.terceiroId ? { terceiroId: filters.terceiroId } : {}),
      ...(filters.conselho ? { conselho: { contains: filters.conselho, mode: 'insensitive' } } : {}),
      ...(filters.conselhoUF ? { conselhoUF: filters.conselhoUF } : {}),
      ...(filters.dataInicioDe || filters.dataInicioAte
        ? {
            dataInicio: {
              ...(filters.dataInicioDe ? { gte: filters.dataInicioDe } : {}),
              ...(filters.dataInicioAte ? { lte: filters.dataInicioAte } : {}),
            },
          }
        : {}),
      ...(filters.dataConclusaoDe || filters.dataConclusaoAte
        ? {
            dataConclusao: {
              ...(filters.dataConclusaoDe ? { gte: filters.dataConclusaoDe } : {}),
              ...(filters.dataConclusaoAte ? { lte: filters.dataConclusaoAte } : {}),
            },
          }
        : {}),
      ...(filters.valorContratoMin !== undefined || filters.valorContratoMax !== undefined
        ? {
            valorContrato: {
              ...(filters.valorContratoMin !== undefined ? { gte: filters.valorContratoMin } : {}),
              ...(filters.valorContratoMax !== undefined ? { lte: filters.valorContratoMax } : {}),
            },
          }
        : {}),
      ...(filters.contratante
        ? { contratante: { contains: filters.contratante, mode: 'insensitive' } }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { numero: { contains: filters.search, mode: 'insensitive' } },
              { contratante: { contains: filters.search, mode: 'insensitive' } },
              { objeto: { contains: filters.search, mode: 'insensitive' } },
              { textoExtraido: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filters.profissionalId
        ? { responsaveis: { some: { profissionalId: filters.profissionalId } } }
        : {}),
      ...(filters.categoria
        ? { responsaveis: { some: { funcoes: { some: { categoriaNorm: normalizeName(filters.categoria) } } } } }
        : {}),
      ...(filters.grandeza || filters.valorMinimo !== undefined
        ? {
            quantitativos: {
              some: {
                ...(filters.grandeza ? { grandeza: { contains: filters.grandeza, mode: 'insensitive' } } : {}),
                ...(filters.valorMinimo !== undefined ? { valor: { gte: filters.valorMinimo } } : {}),
              },
            },
          }
        : {}),
    };

    return prisma.atestado.findMany({
      where,
      include: detailInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  },

  async get(tenantId: string, id: string) {
    const atestado = await prisma.atestado.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: detailInclude,
    });
    if (!atestado) throw createError('Atestado não encontrado', 404, 'ATESTADO_NOT_FOUND');
    return atestado;
  },

  async create(tenantId: string, data: AtestadoData, createdById?: string) {
    const origem = data.origem ?? 'PROPRIO';
    if (origem === 'TERCEIRO' && !data.terceiroId) {
      throw createError('Atestado de terceiro exige o parceiro (terceiroId)', 400, 'TERCEIRO_REQUIRED');
    }
    const numero = collapseSpaces(data.numero);
    const dup = await prisma.atestado.findFirst({ where: { tenantId, origem, numero, deletedAt: null } });
    if (dup) throw createError('Já existe um atestado com este número', 400, 'ATESTADO_EXISTS');

    const responsaveis = await resolveResponsaveis(tenantId, data.responsaveis ?? []);

    const created = await prisma.$transaction(async (tx) => {
      const atestado = await tx.atestado.create({
        data: {
          tenantId,
          numero,
          caixa: data.caixa ?? null,
          contratante: collapseSpaces(data.contratante),
          contrato: data.contrato ?? null,
          objeto: data.objeto,
          periodoTexto: data.periodoTexto ?? null,
          dataInicio: data.dataInicio ?? null,
          dataConclusao: data.dataConclusao ?? null,
          valorContrato: data.valorContrato ?? null,
          origem,
          acervoTipo: data.acervoTipo ?? 'AMBOS',
          artNumero: data.artNumero ?? null,
          catNumero: data.catNumero ?? null,
          conselho: data.conselho ?? null,
          conselhoUF: data.conselhoUF ?? null,
          terceiroId: origem === 'TERCEIRO' ? data.terceiroId ?? null : null,
          createdById: createdById ?? null,
        },
      });

      for (const r of responsaveis) {
        const link = await tx.atestadoResponsavel.create({
          data: { tenantId, atestadoId: atestado.id, profissionalId: r.profissionalId },
        });
        for (const f of r.funcoes) {
          await tx.atestadoFuncao.create({
            data: {
              tenantId,
              responsavelId: link.id,
              funcao: collapseSpaces(f.funcao),
              funcaoNorm: normalizeName(f.funcao),
              categoria: f.categoria ? collapseSpaces(f.categoria) : null,
              categoriaNorm: f.categoria ? normalizeName(f.categoria) : null,
            },
          });
        }
      }

      for (const q of data.quantitativos ?? []) {
        await tx.atestadoQuantitativo.create({
          data: {
            tenantId,
            atestadoId: atestado.id,
            grandeza: collapseSpaces(q.grandeza),
            valor: q.valor,
            unidade: collapseSpaces(q.unidade),
            descricao: q.descricao ?? null,
          },
        });
      }
      return atestado;
    });

    // Indexa (objeto) fora da transação — não bloqueia o create.
    void ragService.indexAtestado(tenantId, created.id);
    return this.get(tenantId, created.id);
  },

  async update(tenantId: string, id: string, data: Partial<AtestadoData>) {
    const existing = await prisma.atestado.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Atestado não encontrado', 404, 'ATESTADO_NOT_FOUND');

    const updateData: Record<string, unknown> = {};
    if (data.numero !== undefined) updateData.numero = collapseSpaces(data.numero);
    if (data.contratante !== undefined) updateData.contratante = collapseSpaces(data.contratante);
    for (const key of [
      'caixa',
      'contrato',
      'objeto',
      'periodoTexto',
      'dataInicio',
      'dataConclusao',
      'valorContrato',
      'acervoTipo',
      'artNumero',
      'catNumero',
      'conselho',
      'conselhoUF',
      'terceiroId',
    ] as const) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }

    await prisma.$transaction(async (tx) => {
      await tx.atestado.update({ where: { id }, data: updateData });

      if (data.responsaveis !== undefined) {
        const responsaveis = await resolveResponsaveis(tenantId, data.responsaveis);
        await tx.atestadoResponsavel.deleteMany({ where: { atestadoId: id } });
        for (const r of responsaveis) {
          const link = await tx.atestadoResponsavel.create({
            data: { tenantId, atestadoId: id, profissionalId: r.profissionalId },
          });
          for (const f of r.funcoes) {
            await tx.atestadoFuncao.create({
              data: {
                tenantId,
                responsavelId: link.id,
                funcao: collapseSpaces(f.funcao),
                funcaoNorm: normalizeName(f.funcao),
                categoria: f.categoria ? collapseSpaces(f.categoria) : null,
                categoriaNorm: f.categoria ? normalizeName(f.categoria) : null,
              },
            });
          }
        }
      }

      if (data.quantitativos !== undefined) {
        await tx.atestadoQuantitativo.deleteMany({ where: { atestadoId: id } });
        for (const q of data.quantitativos) {
          await tx.atestadoQuantitativo.create({
            data: {
              tenantId,
              atestadoId: id,
              grandeza: collapseSpaces(q.grandeza),
              valor: q.valor,
              unidade: collapseSpaces(q.unidade),
              descricao: q.descricao ?? null,
            },
          });
        }
      }
    });

    if (data.objeto !== undefined) void ragService.indexAtestado(tenantId, id);
    return this.get(tenantId, id);
  },

  async remove(tenantId: string, id: string) {
    const existing = await prisma.atestado.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Atestado não encontrado', 404, 'ATESTADO_NOT_FOUND');
    await prisma.atestado.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  },

  /**
   * Anexa o documento (já persistido em Attachment) a um atestado, extrai o texto
   * (nativo ou OCR) e reindexa. Nunca silencia: retorna o status e a mensagem da
   * extração para o usuário (req 8, 10).
   */
  async setDocument(
    tenantId: string,
    id: string,
    input: { attachmentId: string; buffer: Buffer; mimeType: string }
  ) {
    const existing = await prisma.atestado.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Atestado não encontrado', 404, 'ATESTADO_NOT_FOUND');

    const extraction = await ocrService.extractText(input.buffer, input.mimeType);
    const docStatus: AtestadoDocStatus =
      extraction.status === 'OK' ? 'OK' : extraction.status === 'ILEGIVEL' ? 'ILEGIVEL' : 'PENDENTE_EXTRACAO';

    await prisma.atestado.update({
      where: { id },
      data: {
        documentoAttachmentId: input.attachmentId,
        textoExtraido: extraction.text || null,
        docStatus,
      },
    });
    if (extraction.text) void ragService.indexAtestado(tenantId, id);

    return {
      atestado: await this.get(tenantId, id),
      extraction: { status: docStatus, engine: extraction.engine, message: extraction.message ?? null },
    };
  },

  /** Reindexa manualmente um atestado (após configurar embeddings, p.ex.). */
  async reindex(tenantId: string, id: string) {
    const existing = await prisma.atestado.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Atestado não encontrado', 404, 'ATESTADO_NOT_FOUND');
    const chunks = await ragService.indexAtestado(tenantId, id);
    return { id, chunks };
  },
};
