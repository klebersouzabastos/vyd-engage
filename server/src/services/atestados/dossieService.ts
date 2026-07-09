// Dossiê de habilitação técnica em PDF a partir de uma Análise de Concorrência
// (matriz de atendimento + atestados + currículos). Req 34.

import prisma from '../../config/database.js';
import { createError } from '../../middleware/errorHandler.js';
import { storageService } from '../storageService.js';
import { sanitizeFileName } from '../attachmentService.js';
import { concorrenciaService } from './concorrenciaService.js';

export const dossieService = {
  async generate(tenantId: string, concorrenciaId: string, opts: { curriculoIds?: string[] } = {}, userId?: string) {
    const concorrencia = await concorrenciaService.get(tenantId, concorrenciaId);
    if (concorrencia.exigencias.length === 0) {
      throw createError('Analise a concorrência antes de gerar o dossiê', 400, 'NO_EXIGENCIAS');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });

    const curriculos = opts.curriculoIds?.length
      ? await prisma.curriculo.findMany({
          where: { id: { in: opts.curriculoIds }, tenantId },
          include: { profissional: { select: { nome: true, vinculo: true } } },
        })
      : [];

    // Atestados selecionados (únicos, incluídos na composição) — seção própria do dossiê.
    const atestadosMap = new Map<
      string,
      { numero: string; contratante: string; objeto: string; catNumero: string | null; origem: string; parceiro: string | null; responsaveis: string[] }
    >();
    for (const ex of concorrencia.exigencias) {
      for (const m of ex.matches) {
        if (!m.incluido || atestadosMap.has(m.atestado.id)) continue;
        atestadosMap.set(m.atestado.id, {
          numero: m.atestado.numero,
          contratante: m.atestado.contratante,
          objeto: m.atestado.objeto,
          catNumero: m.atestado.catNumero ?? null,
          origem: m.atestado.origem,
          parceiro: m.atestado.terceiro?.empresa ?? null,
          responsaveis: m.atestado.responsaveis.map((r) => r.profissional.nome),
        });
      }
    }

    const { renderDossierPdf } = await import('../pdfService.js');
    const pdf = await renderDossierPdf({
      tenantName: tenant?.name ?? '',
      concorrenciaTitulo: concorrencia.titulo,
      orgao: concorrencia.orgao,
      dataGeracao: new Date().toLocaleDateString('pt-BR'),
      exigencias: concorrencia.exigencias.map((ex) => ({
        descricao: ex.descricao,
        statusAgregado: ex.statusAgregado,
        grandeza: ex.grandeza,
        quantMinimo: ex.quantMinimo != null ? Number(ex.quantMinimo) : null,
        unidade: ex.unidade,
        matches: ex.matches.map((m) => ({
          atestadoNumero: m.atestado.numero,
          contratante: m.atestado.contratante,
          status: m.status,
          confianca: m.confianca,
          quantComprovado: m.quantComprovado != null ? Number(m.quantComprovado) : null,
          incluido: m.incluido,
          origem: m.atestado.origem,
          parceiro: m.atestado.terceiro?.empresa ?? null,
        })),
      })),
      atestados: [...atestadosMap.values()],
      curriculos: curriculos.map((c) => ({
        profissional: c.profissional.nome,
        corpo: c.corpo,
        rtDesligado: c.profissional.vinculo === 'DESLIGADO',
      })),
      generatedBy: undefined,
    });

    const attachment = await storageService.put(tenantId, {
      name: sanitizeFileName(`dossie-${concorrencia.titulo}.pdf`),
      mimeType: 'application/pdf',
      buffer: pdf,
      source: 'DOSSIER',
      uploadedById: userId ?? null,
    });
    await prisma.concorrencia.update({ where: { id: concorrenciaId }, data: { dossieAttachmentId: attachment.id } });
    return { concorrenciaId, attachmentId: attachment.id };
  },
};
