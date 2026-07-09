// Vocabulário controlado de categorias/disciplinas/segmentos/serviços (req 37).
// Preserva os textos livres originais e mapeia-os para uma taxonomia normalizada.

import prisma from '../../config/database.js';
import { createError } from '../../middleware/errorHandler.js';
import { normalizeName, collapseSpaces } from './normalize.js';
import type { TaxonomiaTipo } from '@prisma/client';

// Sementes mínimas de disciplinas de engenharia comuns (o acervo enriquece o resto).
const BUILTIN_DISCIPLINAS = [
  'Projeto Civil',
  'Cálculo Estrutural',
  'Projeto Hidráulico/Sanitário',
  'Projeto Elétrico',
  'Projeto Mecânico',
  'Geotecnia',
  'Projeto Rodoviário',
  'Projeto Ferroviário',
  'Projeto de Saneamento',
  'Projeto Arquitetônico',
];

export const taxonomiaService = {
  async list(tenantId: string, tipo?: TaxonomiaTipo) {
    return prisma.atestadoTaxonomia.findMany({
      where: { tenantId, ...(tipo ? { tipo } : {}) },
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    });
  },

  async create(tenantId: string, tipo: TaxonomiaTipo, nome: string) {
    const clean = collapseSpaces(nome);
    const nomeNorm = normalizeName(clean);
    if (!nomeNorm) throw createError('Nome inválido', 400, 'VALIDATION_ERROR');
    const existing = await prisma.atestadoTaxonomia.findFirst({ where: { tenantId, tipo, nomeNorm } });
    if (existing) throw createError('Item de taxonomia já existe', 400, 'TAXONOMIA_EXISTS');
    return prisma.atestadoTaxonomia.create({ data: { tenantId, tipo, nome: clean, nomeNorm } });
  },

  async remove(tenantId: string, id: string) {
    const existing = await prisma.atestadoTaxonomia.findFirst({ where: { id, tenantId } });
    if (!existing) throw createError('Item de taxonomia não encontrado', 404, 'TAXONOMIA_NOT_FOUND');
    if (existing.builtin) throw createError('Item padrão não pode ser removido', 403, 'TAXONOMIA_BUILTIN');
    await prisma.atestadoTaxonomia.delete({ where: { id } });
    return { id };
  },

  /** Semeia as disciplinas builtin (idempotente). */
  async ensureBuiltins(tenantId: string): Promise<void> {
    for (const nome of BUILTIN_DISCIPLINAS) {
      const nomeNorm = normalizeName(nome);
      const existing = await prisma.atestadoTaxonomia.findFirst({
        where: { tenantId, tipo: 'DISCIPLINA', nomeNorm },
      });
      if (!existing) {
        await prisma.atestadoTaxonomia.create({
          data: { tenantId, tipo: 'DISCIPLINA', nome, nomeNorm, builtin: true },
        });
      }
    }
  },

  /**
   * Find-or-create de um item de taxonomia por nome normalizado (usado na importação
   * para mapear categorias/funções de texto livre à taxonomia, normalizando
   * inconsistências como espaços duplicados). Retorna o id do item.
   */
  async mapOrCreate(tenantId: string, tipo: TaxonomiaTipo, nome: string): Promise<string | null> {
    const clean = collapseSpaces(nome);
    const nomeNorm = normalizeName(clean);
    if (!nomeNorm) return null;
    const existing = await prisma.atestadoTaxonomia.findFirst({ where: { tenantId, tipo, nomeNorm } });
    if (existing) return existing.id;
    const created = await prisma.atestadoTaxonomia.create({
      data: { tenantId, tipo, nome: clean, nomeNorm },
      select: { id: true },
    });
    return created.id;
  },
};
