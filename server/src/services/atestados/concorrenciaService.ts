// Análise de Concorrência — edital → exigências → matriz de atendimento (reqs 16-21).
// Combina busca semântica (RAG), comparação quantitativa determinística e
// classificação por IA. Lacunas e baixa confiança são SEMPRE explícitas.

import prisma from '../../config/database.js';
import { createError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { collapseSpaces, normalizeName } from './normalize.js';
import { ragService } from './ragService.js';
import { ocrService } from './ocrService.js';
import { aiExtractService } from './aiExtractService.js';
import { notificationService } from '../notificationService.js';
import type { Prisma, MatchStatus, ExigenciaAcervo } from '@prisma/client';

const CANDIDATES_PER_EXIGENCIA = 8;
const AI_CLASSIFY_TOP = 5;

export interface ConcorrenciaData {
  titulo: string;
  orgao?: string | null;
  editalTexto?: string | null;
  editalAttachmentId?: string | null;
  incluirTerceiros?: boolean;
}

const detailInclude = {
  exigencias: {
    orderBy: { ordem: 'asc' as const },
    include: {
      matches: {
        include: {
          atestado: {
            select: {
              id: true,
              numero: true,
              contratante: true,
              objeto: true,
              origem: true,
              acervoTipo: true,
              catNumero: true,
              responsaveis: { include: { profissional: { select: { nome: true, vinculo: true } } } },
              // Req 27 + caso extremo: dono do atestado de terceiro + condição/validade.
              terceiro: {
                select: { id: true, empresa: true, usoLivre: true, validadeParceria: true, naturezaParceria: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ConcorrenciaInclude;

/** Agrega o status de uma exigência a partir dos matches incluídos (lacuna explícita). */
function aggregateStatus(
  exigencia: { quantMinimo: unknown; permiteSomatorio: boolean },
  matches: Array<{ status: MatchStatus; incluido: boolean; quantComprovado: unknown }>
): MatchStatus {
  const inc = matches.filter((m) => m.incluido);
  if (inc.length === 0) return 'NAO_ATENDE';
  const min = exigencia.quantMinimo != null ? Number(exigencia.quantMinimo) : null;

  if (min != null && exigencia.permiteSomatorio) {
    const soma = inc
      .filter((m) => m.status === 'ATENDE' || m.status === 'ATENDE_PARCIAL')
      .reduce((acc, m) => acc + (m.quantComprovado != null ? Number(m.quantComprovado) : 0), 0);
    if (soma >= min) return 'ATENDE';
  }
  if (inc.some((m) => m.status === 'ATENDE')) return 'ATENDE';
  if (inc.some((m) => m.status === 'ATENDE_PARCIAL')) return 'ATENDE_PARCIAL';
  if (inc.some((m) => m.status === 'REVISAR')) return 'REVISAR';
  return 'NAO_ATENDE';
}

function serialize(concorrencia: Prisma.ConcorrenciaGetPayload<{ include: typeof detailInclude }>) {
  const now = new Date();
  return {
    ...concorrencia,
    exigencias: concorrencia.exigencias.map((ex) => {
      const matches = ex.matches.map((m) => {
        // Req 6: acervo técnico-profissional de RT DESLIGADO não habilita a empresa.
        const rtDesligado =
          m.atestado.acervoTipo !== 'OPERACIONAL' &&
          m.atestado.responsaveis.some((r) => r.profissional.vinculo === 'DESLIGADO');
        // Req 27 + caso extremo: uso condicionado ou parceria vencida em atestado de terceiro.
        const t = m.atestado.terceiro;
        const alertaTerceiro =
          m.atestado.origem === 'TERCEIRO' &&
          !!t &&
          (t.usoLivre === false || (t.validadeParceria != null && t.validadeParceria < now));
        return { ...m, rtDesligado, alertaTerceiro };
      });
      // Req 19: soma corrente dos incluídos que comprovam (para compor somatório).
      const somatorioAtual = matches
        .filter((m) => m.incluido && (m.status === 'ATENDE' || m.status === 'ATENDE_PARCIAL'))
        .reduce((acc, m) => acc + (m.quantComprovado != null ? Number(m.quantComprovado) : 0), 0);
      return {
        ...ex,
        matches,
        statusAgregado: aggregateStatus(ex, ex.matches),
        alertaRtDesligado: matches.some((m) => m.incluido && m.rtDesligado),
        alertaTerceiro: matches.some((m) => m.incluido && m.alertaTerceiro),
        somatorioAtual,
      };
    }),
  };
}

/** Comparação quantitativa determinística: acha o melhor quantitativo do atestado. */
function quantitativoComprovado(
  exigencia: { grandeza: string | null },
  quantitativos: Array<{ grandeza: string; valor: unknown; unidade: string }>
): number | null {
  if (!exigencia.grandeza) return null;
  const alvo = normalizeName(exigencia.grandeza);
  const candidatos = quantitativos.filter(
    (q) => normalizeName(q.grandeza).includes(alvo) || alvo.includes(normalizeName(q.grandeza))
  );
  if (candidatos.length === 0) return null;
  return Math.max(...candidatos.map((q) => Number(q.valor) || 0));
}

export const concorrenciaService = {
  async list(tenantId: string) {
    return prisma.concorrencia.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { exigencias: true } } },
    });
  },

  async get(tenantId: string, id: string) {
    const concorrencia = await prisma.concorrencia.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: detailInclude,
    });
    if (!concorrencia) throw createError('Concorrência não encontrada', 404, 'CONCORRENCIA_NOT_FOUND');
    return serialize(concorrencia);
  },

  async create(tenantId: string, data: ConcorrenciaData, createdById?: string) {
    return prisma.concorrencia.create({
      data: {
        tenantId,
        titulo: collapseSpaces(data.titulo),
        orgao: data.orgao ?? null,
        editalTexto: data.editalTexto ?? null,
        editalAttachmentId: data.editalAttachmentId ?? null,
        incluirTerceiros: data.incluirTerceiros ?? false,
        createdById: createdById ?? null,
      },
    });
  },

  async update(tenantId: string, id: string, data: Partial<ConcorrenciaData>) {
    const existing = await prisma.concorrencia.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Concorrência não encontrada', 404, 'CONCORRENCIA_NOT_FOUND');
    const updateData: Record<string, unknown> = {};
    if (data.titulo !== undefined) updateData.titulo = collapseSpaces(data.titulo);
    for (const key of ['orgao', 'editalTexto', 'editalAttachmentId', 'incluirTerceiros'] as const) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    await prisma.concorrencia.update({ where: { id }, data: updateData });
    return this.get(tenantId, id);
  },

  async remove(tenantId: string, id: string) {
    const existing = await prisma.concorrencia.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!existing) throw createError('Concorrência não encontrada', 404, 'CONCORRENCIA_NOT_FOUND');
    await prisma.concorrencia.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  },

  /** Adiciona uma exigência manualmente (edição da matriz). */
  async addExigencia(
    tenantId: string,
    concorrenciaId: string,
    data: { descricao: string; acervo?: ExigenciaAcervo; grandeza?: string | null; quantMinimo?: number | null; unidade?: string | null; permiteSomatorio?: boolean }
  ) {
    const concorrencia = await prisma.concorrencia.findFirst({ where: { id: concorrenciaId, tenantId, deletedAt: null } });
    if (!concorrencia) throw createError('Concorrência não encontrada', 404, 'CONCORRENCIA_NOT_FOUND');
    const count = await prisma.concorrenciaExigencia.count({ where: { concorrenciaId } });
    await prisma.concorrenciaExigencia.create({
      data: {
        tenantId,
        concorrenciaId,
        ordem: count,
        descricao: collapseSpaces(data.descricao),
        acervo: data.acervo ?? 'INDEFINIDO',
        grandeza: data.grandeza ?? null,
        quantMinimo: data.quantMinimo ?? null,
        unidade: data.unidade ?? null,
        permiteSomatorio: data.permiteSomatorio ?? true,
      },
    });
    return this.get(tenantId, concorrenciaId);
  },

  /** Ajuste manual de um match (incluir/excluir da composição, mudar status). */
  async updateMatch(tenantId: string, matchId: string, data: { status?: MatchStatus; incluido?: boolean }) {
    const match = await prisma.exigenciaMatch.findFirst({ where: { id: matchId, tenantId } });
    if (!match) throw createError('Match não encontrado', 404, 'MATCH_NOT_FOUND');
    await prisma.exigenciaMatch.update({
      where: { id: matchId },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.incluido !== undefined ? { incluido: data.incluido } : {}),
        manual: true,
      },
    });
    const exigencia = await prisma.concorrenciaExigencia.findFirst({ where: { id: match.exigenciaId, tenantId }, select: { concorrenciaId: true } });
    if (!exigencia) throw createError('Exigência não encontrada', 404, 'EXIGENCIA_NOT_FOUND');
    return this.get(tenantId, exigencia.concorrenciaId);
  },

  /**
   * Executa a análise: extrai exigências do edital (IA), varre o acervo e monta a
   * matriz de atendimento. Nunca lança 500: em falha, grava analiseErro e status.
   */
  async analisar(tenantId: string, id: string) {
    const concorrencia = await prisma.concorrencia.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!concorrencia) throw createError('Concorrência não encontrada', 404, 'CONCORRENCIA_NOT_FOUND');

    await prisma.concorrencia.update({ where: { id }, data: { status: 'ANALISANDO', analiseErro: null } });

    try {
      // Resolve o texto do edital (texto colado OU documento anexado).
      let editalTexto = concorrencia.editalTexto ?? '';
      if (!editalTexto && concorrencia.editalAttachmentId) {
        editalTexto = await extractAttachmentText(tenantId, concorrencia.editalAttachmentId);
        if (editalTexto) {
          await prisma.concorrencia.update({ where: { id }, data: { editalTexto } });
        }
      }
      if (!editalTexto.trim()) {
        await prisma.concorrencia.update({
          where: { id },
          data: { status: 'RASCUNHO', analiseErro: 'Nenhum texto de edital para analisar. Cole o texto ou anexe um edital legível.' },
        });
        return this.get(tenantId, id);
      }

      const exigencias = await aiExtractService.extractEditalRequirements(tenantId, editalTexto);
      if (exigencias === null) {
        await prisma.concorrencia.update({
          where: { id },
          data: {
            status: 'RASCUNHO',
            analiseErro:
              'IA não configurada: as exigências não foram extraídas automaticamente. Adicione as exigências manualmente para gerar a matriz.',
          },
        });
        return this.get(tenantId, id);
      }

      // Substitui as exigências (reanálise recomeça do zero).
      await prisma.concorrenciaExigencia.deleteMany({ where: { concorrenciaId: id } });

      for (let i = 0; i < exigencias.length; i++) {
        const ex = exigencias[i];
        const exigencia = await prisma.concorrenciaExigencia.create({
          data: {
            tenantId,
            concorrenciaId: id,
            ordem: i,
            descricao: collapseSpaces(ex.descricao),
            acervo: ex.acervo,
            grandeza: ex.grandeza ?? null,
            quantMinimo: ex.quantMinimo ?? null,
            unidade: ex.unidade ?? null,
            permiteSomatorio: ex.permiteSomatorio,
          },
        });
        await this.matchExigencia(tenantId, exigencia.id, {
          descricao: exigencia.descricao,
          grandeza: exigencia.grandeza,
          includeTerceiros: concorrencia.incluirTerceiros,
        });
      }

      await prisma.concorrencia.update({
        where: { id },
        data: { status: 'CONCLUIDA', promptUsed: 'atestado-edital', analiseErro: null },
      });

      if (concorrencia.createdById) {
        notificationService
          .create(tenantId, {
            userId: concorrencia.createdById,
            type: 'ATESTADO_ANALISE_CONCLUIDA',
            title: 'Análise de concorrência concluída',
            message: `A matriz de atendimento de "${concorrencia.titulo}" está pronta.`,
            link: `/app/atestados/concorrencias/${id}`,
            metadata: { concorrenciaId: id },
          })
          .catch(() => {});
      }

      return this.get(tenantId, id);
    } catch (err) {
      logger.error('Falha ao analisar concorrência', err as Error);
      await prisma.concorrencia.update({
        where: { id },
        data: { status: 'RASCUNHO', analiseErro: 'Erro inesperado ao analisar. Tente novamente.' },
      });
      return this.get(tenantId, id);
    }
  },

  /** Encontra atestados candidatos para uma exigência e cria os matches. */
  async matchExigencia(
    tenantId: string,
    exigenciaId: string,
    ex: { descricao: string; grandeza: string | null; includeTerceiros: boolean }
  ) {
    const query = [ex.descricao, ex.grandeza ?? ''].join(' ').trim();
    const hits = await ragService.semanticSearch(tenantId, query, {
      limit: CANDIDATES_PER_EXIGENCIA,
      includeTerceiros: ex.includeTerceiros,
    });
    if (hits.length === 0) return; // lacuna: exigência sem candidato → NAO_ATENDE no agregado

    const exigencia = await prisma.concorrenciaExigencia.findFirst({ where: { id: exigenciaId, tenantId } });
    if (!exigencia) return;

    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      const atestado = await prisma.atestado.findFirst({
        where: { id: hit.atestadoId, tenantId, deletedAt: null },
        include: { quantitativos: true },
      });
      if (!atestado) continue;

      // Comparação quantitativa determinística.
      const min = exigencia.quantMinimo != null ? Number(exigencia.quantMinimo) : null;
      const comprovado = quantitativoComprovado(exigencia, atestado.quantitativos);
      let status: MatchStatus = 'REVISAR';
      let confianca = hit.score;
      let trecho: string | null = hit.trecho;

      if (min != null) {
        if (comprovado != null && comprovado >= min) status = 'ATENDE';
        else if (comprovado != null && comprovado > 0) status = 'ATENDE_PARCIAL';
        else status = 'REVISAR';
      }

      // Refino por IA (apenas nos primeiros candidatos, se disponível).
      if (i < AI_CLASSIFY_TOP && aiExtractService.isAiExtractEnabled()) {
        const resumo = [
          atestado.objeto,
          atestado.textoExtraido ?? '',
          atestado.quantitativos.map((q) => `${q.grandeza}: ${q.valor} ${q.unidade}`).join('; '),
        ].join('\n');
        const cls = await aiExtractService.classifyMatch(tenantId, exigencia.descricao, resumo);
        if (cls) {
          // Se há quantitativo mínimo, o determinístico manda; a IA refina confiança/trecho.
          if (min == null) status = cls.status;
          confianca = cls.confianca;
          if (cls.trecho) trecho = cls.trecho;
        }
      }
      // Baixa confiança sem quantitativo → REVISAR explícito (nunca "ATENDE" silencioso).
      if (min == null && confianca < 0.55 && status === 'ATENDE') status = 'REVISAR';

      await prisma.exigenciaMatch.upsert({
        where: { exigenciaId_atestadoId: { exigenciaId, atestadoId: atestado.id } },
        create: {
          tenantId,
          exigenciaId,
          atestadoId: atestado.id,
          status,
          confianca,
          quantComprovado: comprovado,
          trecho,
        },
        update: { status, confianca, quantComprovado: comprovado, trecho, manual: false },
      });
    }
  },
};

/** Extrai o texto de um Attachment (edital anexado) via storage + OCR. */
async function extractAttachmentText(tenantId: string, attachmentId: string): Promise<string> {
  try {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, tenantId, deletedAt: null },
      select: { storageProvider: true, storageKey: true, mimeType: true },
    });
    if (!attachment) return '';
    const { storageService } = await import('../storageService.js');
    const buffer = await storageService.get(attachment);
    const extraction = await ocrService.extractText(buffer, attachment.mimeType);
    return extraction.text;
  } catch (err) {
    logger.warn('Falha ao extrair texto do edital anexado', err as Error);
    return '';
  }
}
