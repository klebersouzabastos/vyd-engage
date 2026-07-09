// Currículos estratégicos dos profissionais — classificados por segmento/área/
// disciplina, puxam automaticamente os atestados do profissional e geram CV em PDF
// sob medida para uma concorrência (reqs 22, 23, 24).

import prisma from '../../config/database.js';
import { createError } from '../../middleware/errorHandler.js';
import { collapseSpaces } from './normalize.js';
import { storageService } from '../storageService.js';
import { sanitizeFileName } from '../attachmentService.js';

export interface CurriculoData {
  profissionalId: string;
  titulo?: string;
  segmento?: string | null;
  area?: string | null;
  disciplina?: string | null;
  corpo?: string | null;
  concorrenciaId?: string | null;
}

/** Atestados do profissional (opcionalmente restritos aos da concorrência). */
async function atestadosDoProfissional(tenantId: string, profissionalId: string, concorrenciaId?: string | null) {
  let atestadoIds: Set<string> | null = null;
  if (concorrenciaId) {
    const matches = await prisma.exigenciaMatch.findMany({
      where: { tenantId, incluido: true, exigencia: { concorrenciaId } },
      select: { atestadoId: true },
    });
    atestadoIds = new Set(matches.map((m) => m.atestadoId));
  }
  const atestados = await prisma.atestado.findMany({
    where: { tenantId, deletedAt: null, responsaveis: { some: { profissionalId } } },
    include: { responsaveis: { where: { profissionalId }, include: { funcoes: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return atestadoIds ? atestados.filter((a) => atestadoIds!.has(a.id)) : atestados;
}

export interface CurriculoFilters {
  profissionalId?: string;
  segmento?: string;
  area?: string;
  disciplina?: string;
}

export const curriculoService = {
  async list(tenantId: string, filters: CurriculoFilters = {}) {
    return prisma.curriculo.findMany({
      where: {
        tenantId,
        ...(filters.profissionalId ? { profissionalId: filters.profissionalId } : {}),
        ...(filters.segmento ? { segmento: { contains: filters.segmento, mode: 'insensitive' } } : {}),
        ...(filters.area ? { area: { contains: filters.area, mode: 'insensitive' } } : {}),
        ...(filters.disciplina ? { disciplina: { contains: filters.disciplina, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { profissional: { select: { id: true, nome: true, vinculo: true } } },
    });
  },

  async get(tenantId: string, id: string) {
    const curriculo = await prisma.curriculo.findFirst({
      where: { id, tenantId },
      include: { profissional: { select: { id: true, nome: true, conselho: true, conselhoUF: true, vinculo: true } } },
    });
    if (!curriculo) throw createError('Currículo não encontrado', 404, 'CURRICULO_NOT_FOUND');
    // Req 6: currículo cujo profissional está DESLIGADO não habilita (acervo profissional).
    return { ...curriculo, rtDesligado: curriculo.profissional.vinculo === 'DESLIGADO' };
  },

  async generate(tenantId: string, data: CurriculoData, createdById?: string) {
    const prof = await prisma.profissional.findFirst({
      where: { id: data.profissionalId, tenantId, deletedAt: null },
    });
    if (!prof) throw createError('Profissional não encontrado', 404, 'PROFISSIONAL_NOT_FOUND');

    const corpo = data.corpo ?? prof.curriculoResumo ?? '';
    const curriculo = await prisma.curriculo.create({
      data: {
        tenantId,
        profissionalId: prof.id,
        titulo: collapseSpaces(data.titulo || `Currículo — ${prof.nome}`),
        segmento: data.segmento ?? prof.segmento ?? null,
        area: data.area ?? prof.area ?? null,
        disciplina: data.disciplina ?? null,
        corpo,
        concorrenciaId: data.concorrenciaId ?? null,
        createdById: createdById ?? null,
      },
    });
    return this.get(tenantId, curriculo.id);
  },

  async remove(tenantId: string, id: string) {
    const existing = await prisma.curriculo.findFirst({ where: { id, tenantId } });
    if (!existing) throw createError('Currículo não encontrado', 404, 'CURRICULO_NOT_FOUND');
    await prisma.curriculo.delete({ where: { id } });
    return { id };
  },

  /** Gera o PDF do currículo (com os atestados aderentes) e o persiste como Attachment. */
  async generatePdf(tenantId: string, id: string, userId?: string) {
    const curriculo = await prisma.curriculo.findFirst({
      where: { id, tenantId },
      include: { profissional: true },
    });
    if (!curriculo) throw createError('Currículo não encontrado', 404, 'CURRICULO_NOT_FOUND');

    const atestados = await atestadosDoProfissional(tenantId, curriculo.profissionalId, curriculo.concorrenciaId);
    const subtitulo = [curriculo.segmento, curriculo.area, curriculo.disciplina].filter(Boolean).join(' · ');

    const { renderCurriculoPdf } = await import('../pdfService.js');
    const pdf = await renderCurriculoPdf({
      tenantName: '',
      profissionalNome: curriculo.profissional.nome,
      titulo: curriculo.titulo,
      subtitulo: subtitulo || undefined,
      corpo: curriculo.corpo,
      // Req 6: aviso explícito quando o RT está desligado (acervo profissional não habilita).
      alertaRtDesligado: curriculo.profissional.vinculo === 'DESLIGADO',
      atestados: atestados.map((a) => ({
        numero: a.numero,
        contratante: a.contratante,
        objeto: a.objeto,
        funcoes: a.responsaveis.flatMap((r) => r.funcoes.map((f) => f.funcao)),
      })),
      generatedBy: undefined,
    });

    const attachment = await storageService.put(tenantId, {
      name: sanitizeFileName(`curriculo-${curriculo.profissional.nome}.pdf`),
      mimeType: 'application/pdf',
      buffer: pdf,
      source: 'CURRICULO',
      uploadedById: userId ?? null,
    });
    await prisma.curriculo.update({ where: { id }, data: { attachmentId: attachment.id } });
    return { curriculo: await this.get(tenantId, id), attachmentId: attachment.id };
  },
};
