// Gestão de Atestados Técnicos — acervo, profissionais, terceiros, taxonomia,
// pendências, concorrências (matriz de atendimento), currículos e dossiê.
//
// Acesso ao módulo é gated por capability própria (`accessAtestados`) — restrito a um
// perfil específico (default: ADMIN/GESTOR). Escrita/gestão exige `manageAtestados`.
// Montado UMA vez em index.ts (import + CSRF whitelist + mount).

import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import prisma from '../config/database.js';
import { atestadoService } from '../services/atestados/atestadoService.js';
import { profissionalService } from '../services/atestados/profissionalService.js';
import { terceiroService } from '../services/atestados/terceiroService.js';
import { taxonomiaService } from '../services/atestados/taxonomiaService.js';
import { pendenciaService } from '../services/atestados/pendenciaService.js';
import { concorrenciaService } from '../services/atestados/concorrenciaService.js';
import { curriculoService } from '../services/atestados/curriculoService.js';
import { dossieService } from '../services/atestados/dossieService.js';
import { ragService } from '../services/atestados/ragService.js';
import { ocrService } from '../services/atestados/ocrService.js';
import { aiExtractService } from '../services/atestados/aiExtractService.js';
import { storageService } from '../services/storageService.js';
import { sanitizeFileName } from '../services/attachmentService.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const router = Router();
router.use(authenticate);
router.use(tenantScope);
router.use(requirePermission('accessAtestados'));

const manage = requirePermission('manageAtestados');

function tenant(req: Request): string {
  return req.user!.tenantId;
}
function getFile(req: Request): { buffer: Buffer; mimetype: string; originalname: string } | undefined {
  return (req as unknown as { file?: { buffer: Buffer; mimetype: string; originalname: string } }).file;
}
function zodNext(error: unknown, next: (e?: unknown) => void) {
  if (error instanceof z.ZodError) {
    return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
  }
  next(error);
}

// ── Schemas ──────────────────────────────────────────────────────────────────
const funcaoSchema = z.object({ funcao: z.string().min(1), categoria: z.string().nullable().optional() });
const responsavelSchema = z.object({
  profissionalId: z.string().uuid().optional(),
  nome: z.string().optional(),
  funcoes: z.array(funcaoSchema).default([]),
});
const quantitativoSchema = z.object({
  grandeza: z.string().min(1),
  valor: z.number(),
  unidade: z.string().min(1),
  descricao: z.string().nullable().optional(),
});
const atestadoCreateSchema = z.object({
  numero: z.string().min(1),
  caixa: z.string().nullable().optional(),
  contratante: z.string().min(1),
  contrato: z.string().nullable().optional(),
  objeto: z.string().min(1),
  periodoTexto: z.string().nullable().optional(),
  dataInicio: z.coerce.date().nullable().optional(),
  dataConclusao: z.coerce.date().nullable().optional(),
  valorContrato: z.number().nullable().optional(),
  origem: z.enum(['PROPRIO', 'TERCEIRO']).optional(),
  acervoTipo: z.enum(['OPERACIONAL', 'PROFISSIONAL', 'AMBOS']).optional(),
  artNumero: z.string().nullable().optional(),
  catNumero: z.string().nullable().optional(),
  conselho: z.string().nullable().optional(),
  conselhoUF: z.string().nullable().optional(),
  terceiroId: z.string().uuid().nullable().optional(),
  responsaveis: z.array(responsavelSchema).optional(),
  quantitativos: z.array(quantitativoSchema).optional(),
});

// ── Sub-router: Profissionais ────────────────────────────────────────────────
const profissionaisRouter = Router();
const profissionalSchema = z.object({
  nome: z.string().min(1),
  titulo: z.string().nullable().optional(),
  conselho: z.string().nullable().optional(),
  conselhoNum: z.string().nullable().optional(),
  conselhoUF: z.string().nullable().optional(),
  disciplinas: z.array(z.string()).optional(),
  segmento: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  vinculo: z.enum(['SOCIO', 'CLT', 'CONTRATO', 'DESLIGADO']).optional(),
  vinculoInicio: z.coerce.date().nullable().optional(),
  vinculoFim: z.coerce.date().nullable().optional(),
  email: z.string().email().nullable().optional(),
  telefone: z.string().nullable().optional(),
  curriculoResumo: z.string().nullable().optional(),
});
profissionaisRouter.get('/', async (req, res, next) => {
  try {
    const q = req.query;
    res.json({
      status: 200,
      data: await profissionalService.list(tenant(req), {
        search: q.search as string | undefined,
        vinculo: q.vinculo as never,
        segmento: q.segmento as string | undefined,
        area: q.area as string | undefined,
        disciplina: q.disciplina as string | undefined,
      }),
    });
  } catch (e) { next(e); }
});
profissionaisRouter.get('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await profissionalService.get(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
profissionaisRouter.post('/', manage, async (req, res, next) => {
  try {
    const data = profissionalSchema.parse(req.body);
    res.status(201).json({ status: 201, data: await profissionalService.create(tenant(req), data) });
  } catch (e) { zodNext(e, next); }
});
profissionaisRouter.put('/:id', manage, async (req, res, next) => {
  try {
    const data = profissionalSchema.partial().parse(req.body);
    res.json({ status: 200, data: await profissionalService.update(tenant(req), req.params.id, data) });
  } catch (e) { zodNext(e, next); }
});
profissionaisRouter.delete('/:id', manage, async (req, res, next) => {
  try { res.json({ status: 200, data: await profissionalService.remove(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});

// ── Sub-router: Terceiros ────────────────────────────────────────────────────
const terceirosRouter = Router();
const terceiroSchema = z.object({
  empresa: z.string().min(1),
  contatoNome: z.string().nullable().optional(),
  contatoEmail: z.string().email().nullable().optional(),
  contatoTelefone: z.string().nullable().optional(),
  validadeParceria: z.coerce.date().nullable().optional(),
  condicoes: z.string().nullable().optional(),
  usoLivre: z.boolean().optional(),
  naturezaParceria: z.enum(['CONSORCIO', 'SUBCONTRATACAO', 'CESSAO_DE_ACERVO']).nullable().optional(),
});
terceirosRouter.get('/', async (req, res, next) => {
  try { res.json({ status: 200, data: await terceiroService.list(tenant(req), req.query.search as string | undefined) }); }
  catch (e) { next(e); }
});
terceirosRouter.get('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await terceiroService.get(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
terceirosRouter.post('/', manage, async (req, res, next) => {
  try { res.status(201).json({ status: 201, data: await terceiroService.create(tenant(req), terceiroSchema.parse(req.body)) }); }
  catch (e) { zodNext(e, next); }
});
terceirosRouter.put('/:id', manage, async (req, res, next) => {
  try { res.json({ status: 200, data: await terceiroService.update(tenant(req), req.params.id, terceiroSchema.partial().parse(req.body)) }); }
  catch (e) { zodNext(e, next); }
});
terceirosRouter.delete('/:id', manage, async (req, res, next) => {
  try { res.json({ status: 200, data: await terceiroService.remove(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});

// ── Sub-router: Taxonomia ────────────────────────────────────────────────────
const taxonomiasRouter = Router();
const taxonomiaSchema = z.object({
  tipo: z.enum(['CATEGORIA', 'DISCIPLINA', 'SEGMENTO', 'SERVICO']),
  nome: z.string().min(1),
});
taxonomiasRouter.get('/', async (req, res, next) => {
  try {
    await taxonomiaService.ensureBuiltins(tenant(req));
    res.json({ status: 200, data: await taxonomiaService.list(tenant(req), req.query.tipo as never) });
  } catch (e) { next(e); }
});
taxonomiasRouter.post('/', manage, async (req, res, next) => {
  try {
    const { tipo, nome } = taxonomiaSchema.parse(req.body);
    res.status(201).json({ status: 201, data: await taxonomiaService.create(tenant(req), tipo, nome) });
  } catch (e) { zodNext(e, next); }
});
taxonomiasRouter.delete('/:id', manage, async (req, res, next) => {
  try { res.json({ status: 200, data: await taxonomiaService.remove(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});

// ── Sub-router: Pendências ───────────────────────────────────────────────────
const pendenciasRouter = Router();
const pendenciaSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().nullable().optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  prazo: z.coerce.date().nullable().optional(),
  statusId: z.string().uuid().optional(),
  origem: z.enum(['DEAL', 'CONTRATO', 'MANUAL']).optional(),
  dealId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  osRef: z.string().nullable().optional(),
});
const statusSchema = z.object({ nome: z.string().min(1), ordem: z.number().optional(), isFinal: z.boolean().optional() });
pendenciasRouter.get('/status', async (req, res, next) => {
  try { res.json({ status: 200, data: await pendenciaService.listStatuses(tenant(req)) }); }
  catch (e) { next(e); }
});
pendenciasRouter.post('/status', manage, async (req, res, next) => {
  try { res.status(201).json({ status: 201, data: await pendenciaService.createStatus(tenant(req), statusSchema.parse(req.body)) }); }
  catch (e) { zodNext(e, next); }
});
pendenciasRouter.put('/status/:id', manage, async (req, res, next) => {
  try { res.json({ status: 200, data: await pendenciaService.updateStatus(tenant(req), req.params.id, statusSchema.partial().parse(req.body)) }); }
  catch (e) { zodNext(e, next); }
});
pendenciasRouter.delete('/status/:id', manage, async (req, res, next) => {
  try { res.json({ status: 200, data: await pendenciaService.removeStatus(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
pendenciasRouter.get('/', async (req, res, next) => {
  try {
    res.json({
      status: 200,
      data: await pendenciaService.list(tenant(req), {
        statusId: req.query.statusId as string | undefined,
        responsavelId: req.query.responsavelId as string | undefined,
        atrasadas: req.query.atrasadas === 'true',
        origem: req.query.origem as never,
      }),
    });
  } catch (e) { next(e); }
});
pendenciasRouter.get('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await pendenciaService.get(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
pendenciasRouter.post('/', async (req, res, next) => {
  try {
    const data = pendenciaSchema.parse(req.body);
    res.status(201).json({ status: 201, data: await pendenciaService.create(tenant(req), data, req.user!.userId) });
  } catch (e) { zodNext(e, next); }
});
pendenciasRouter.put('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await pendenciaService.update(tenant(req), req.params.id, pendenciaSchema.partial().parse(req.body)) }); }
  catch (e) { zodNext(e, next); }
});
pendenciasRouter.delete('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await pendenciaService.remove(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
pendenciasRouter.post('/:id/converter', async (req, res, next) => {
  try {
    const data = atestadoCreateSchema.parse(req.body);
    res.status(201).json({ status: 201, data: await pendenciaService.convertToAtestado(tenant(req), req.params.id, data, req.user!.userId) });
  } catch (e) { zodNext(e, next); }
});

// ── Sub-router: Concorrências ────────────────────────────────────────────────
const concorrenciasRouter = Router();
const concorrenciaSchema = z.object({
  titulo: z.string().min(1),
  orgao: z.string().nullable().optional(),
  editalTexto: z.string().nullable().optional(),
  editalAttachmentId: z.string().uuid().nullable().optional(),
  incluirTerceiros: z.boolean().optional(),
});
const exigenciaSchema = z.object({
  descricao: z.string().min(1),
  acervo: z.enum(['OPERACIONAL', 'PROFISSIONAL', 'INDEFINIDO']).optional(),
  grandeza: z.string().nullable().optional(),
  quantMinimo: z.number().nullable().optional(),
  unidade: z.string().nullable().optional(),
  permiteSomatorio: z.boolean().optional(),
});
const matchUpdateSchema = z.object({
  status: z.enum(['ATENDE', 'ATENDE_PARCIAL', 'NAO_ATENDE', 'REVISAR']).optional(),
  incluido: z.boolean().optional(),
});
concorrenciasRouter.get('/', async (req, res, next) => {
  try { res.json({ status: 200, data: await concorrenciaService.list(tenant(req)) }); }
  catch (e) { next(e); }
});
concorrenciasRouter.get('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await concorrenciaService.get(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
concorrenciasRouter.post('/', async (req, res, next) => {
  try {
    const data = concorrenciaSchema.parse(req.body);
    res.status(201).json({ status: 201, data: await concorrenciaService.create(tenant(req), data, req.user!.userId) });
  } catch (e) { zodNext(e, next); }
});
concorrenciasRouter.put('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await concorrenciaService.update(tenant(req), req.params.id, concorrenciaSchema.partial().parse(req.body)) }); }
  catch (e) { zodNext(e, next); }
});
concorrenciasRouter.delete('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await concorrenciaService.remove(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
concorrenciasRouter.post('/:id/analisar', async (req, res, next) => {
  try { res.json({ status: 200, data: await concorrenciaService.analisar(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
concorrenciasRouter.post('/:id/exigencias', async (req, res, next) => {
  try { res.status(201).json({ status: 201, data: await concorrenciaService.addExigencia(tenant(req), req.params.id, exigenciaSchema.parse(req.body)) }); }
  catch (e) { zodNext(e, next); }
});
concorrenciasRouter.put('/matches/:matchId', async (req, res, next) => {
  try { res.json({ status: 200, data: await concorrenciaService.updateMatch(tenant(req), req.params.matchId, matchUpdateSchema.parse(req.body)) }); }
  catch (e) { zodNext(e, next); }
});
concorrenciasRouter.post('/:id/dossie', async (req, res, next) => {
  try {
    const body = z.object({ curriculoIds: z.array(z.string().uuid()).optional() }).parse(req.body ?? {});
    res.status(201).json({ status: 201, data: await dossieService.generate(tenant(req), req.params.id, body, req.user!.userId) });
  } catch (e) { zodNext(e, next); }
});

// ── Sub-router: Currículos ───────────────────────────────────────────────────
const curriculosRouter = Router();
const curriculoSchema = z.object({
  profissionalId: z.string().uuid(),
  titulo: z.string().optional(),
  segmento: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  disciplina: z.string().nullable().optional(),
  corpo: z.string().nullable().optional(),
  concorrenciaId: z.string().uuid().nullable().optional(),
});
curriculosRouter.get('/', async (req, res, next) => {
  try {
    const q = req.query;
    res.json({
      status: 200,
      data: await curriculoService.list(tenant(req), {
        profissionalId: q.profissionalId as string | undefined,
        segmento: q.segmento as string | undefined,
        area: q.area as string | undefined,
        disciplina: q.disciplina as string | undefined,
      }),
    });
  } catch (e) { next(e); }
});
curriculosRouter.get('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await curriculoService.get(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
curriculosRouter.post('/', async (req, res, next) => {
  try { res.status(201).json({ status: 201, data: await curriculoService.generate(tenant(req), curriculoSchema.parse(req.body), req.user!.userId) }); }
  catch (e) { zodNext(e, next); }
});
curriculosRouter.post('/:id/pdf', async (req, res, next) => {
  try { res.status(201).json({ status: 201, data: await curriculoService.generatePdf(tenant(req), req.params.id, req.user!.userId) }); }
  catch (e) { next(e); }
});
curriculosRouter.delete('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await curriculoService.remove(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});

// ── Rotas do acervo (literais ANTES de /:id) ─────────────────────────────────
// Mount dos sub-routers ANTES de /:id (senão o param captura os prefixos literais).
router.use('/profissionais', profissionaisRouter);
router.use('/terceiros', terceirosRouter);
router.use('/taxonomias', taxonomiasRouter);
router.use('/pendencias', pendenciasRouter);
router.use('/concorrencias', concorrenciasRouter);
router.use('/curriculos', curriculosRouter);

router.get('/status', (_req, res) => {
  res.json({
    status: 200,
    data: { aiEnabled: aiExtractService.isAiExtractEnabled(), embeddingEnabled: ragService.isEmbeddingEnabled() },
  });
});

// Configuração do módulo — limiar de antecedência do alerta de pendências (req 33).
router.get('/config', async (req, res, next) => {
  try {
    const t = await prisma.tenant.findUnique({ where: { id: tenant(req) }, select: { atestadoAlertDays: true } });
    res.json({ status: 200, data: { atestadoAlertDays: t?.atestadoAlertDays ?? 7 } });
  } catch (e) { next(e); }
});
router.put('/config', manage, async (req, res, next) => {
  try {
    const { atestadoAlertDays } = z.object({ atestadoAlertDays: z.number().int().min(0).max(365) }).parse(req.body);
    await prisma.tenant.update({ where: { id: tenant(req) }, data: { atestadoAlertDays } });
    res.json({ status: 200, data: { atestadoAlertDays } });
  } catch (e) { zodNext(e, next); }
});

// Busca semântica/inteligente sobre o acervo (RAG + fallback por palavra-chave).
router.get('/busca', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    if (!q.trim()) return res.json({ status: 200, data: [] });
    const includeTerceiros = req.query.includeTerceiros === 'true';
    const hits = await ragService.semanticSearch(tenant(req), q, { limit: 30, includeTerceiros });
    const ids = hits.map((h) => h.atestadoId);
    const atestados = await prisma.atestado.findMany({
      where: { id: { in: ids }, tenantId: tenant(req), deletedAt: null },
      include: { terceiro: { select: { id: true, empresa: true } }, responsaveis: { include: { funcoes: true, profissional: { select: { nome: true } } } } },
    });
    const byId = new Map(atestados.map((a) => [a.id, a]));
    const results = hits
      .map((h) => ({ score: h.score, trecho: h.trecho, atestado: byId.get(h.atestadoId) }))
      .filter((r) => r.atestado);
    res.json({ status: 200, data: results });
  } catch (e) { next(e); }
});

// Importação da planilha (req 28). Restrito a gestão.
router.post('/import', manage, upload.single('file'), async (req, res, next) => {
  try {
    const file = getFile(req);
    if (!file) return next(createError('Arquivo obrigatório', 400, 'FILE_REQUIRED'));
    const { importAtestadosService } = await import('../services/atestados/importAtestados.js');
    const report = await importAtestadosService.importBuffer(tenant(req), req.user!.userId, file.buffer);
    res.json({ status: 200, data: report });
  } catch (e) { next(e); }
});

// Sugestão de campos por IA a partir de um documento (req 29) — NÃO persiste.
router.post('/sugerir', manage, upload.single('file'), async (req, res, next) => {
  try {
    const file = getFile(req);
    if (!file) return next(createError('Arquivo obrigatório', 400, 'FILE_REQUIRED'));
    const extraction = await ocrService.extractText(file.buffer, file.mimetype);
    const suggestion = extraction.text
      ? await aiExtractService.suggestAtestadoFields(tenant(req), extraction.text)
      : null;
    res.json({
      status: 200,
      data: {
        extraction: { status: extraction.status, engine: extraction.engine, message: extraction.message ?? null },
        suggestion,
        textoExtraido: extraction.text || null,
      },
    });
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const q = req.query;
    res.json({
      status: 200,
      data: await atestadoService.list(tenant(req), {
        search: q.search as string | undefined,
        origem: q.origem as never,
        acervoTipo: q.acervoTipo as never,
        docStatus: q.docStatus as never,
        contratante: q.contratante as string | undefined,
        categoria: q.categoria as string | undefined,
        profissionalId: q.profissionalId as string | undefined,
        terceiroId: q.terceiroId as string | undefined,
        grandeza: q.grandeza as string | undefined,
        valorMinimo: q.valorMinimo !== undefined ? Number(q.valorMinimo) : undefined,
        includeTerceiros: q.includeTerceiros === 'true',
        conselho: q.conselho as string | undefined,
        conselhoUF: q.conselhoUF as string | undefined,
        dataInicioDe: q.dataInicioDe ? new Date(q.dataInicioDe as string) : undefined,
        dataInicioAte: q.dataInicioAte ? new Date(q.dataInicioAte as string) : undefined,
        dataConclusaoDe: q.dataConclusaoDe ? new Date(q.dataConclusaoDe as string) : undefined,
        dataConclusaoAte: q.dataConclusaoAte ? new Date(q.dataConclusaoAte as string) : undefined,
        valorContratoMin: q.valorContratoMin !== undefined ? Number(q.valorContratoMin) : undefined,
        valorContratoMax: q.valorContratoMax !== undefined ? Number(q.valorContratoMax) : undefined,
      }),
    });
  } catch (e) { next(e); }
});
router.post('/', manage, async (req, res, next) => {
  try {
    const data = atestadoCreateSchema.parse(req.body);
    res.status(201).json({ status: 201, data: await atestadoService.create(tenant(req), data, req.user!.userId) });
  } catch (e) { zodNext(e, next); }
});
router.get('/:id', async (req, res, next) => {
  try { res.json({ status: 200, data: await atestadoService.get(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
router.put('/:id', manage, async (req, res, next) => {
  try { res.json({ status: 200, data: await atestadoService.update(tenant(req), req.params.id, atestadoCreateSchema.partial().parse(req.body)) }); }
  catch (e) { zodNext(e, next); }
});
router.delete('/:id', manage, async (req, res, next) => {
  try { res.json({ status: 200, data: await atestadoService.remove(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});
router.post('/:id/reindex', manage, async (req, res, next) => {
  try { res.json({ status: 200, data: await atestadoService.reindex(tenant(req), req.params.id) }); }
  catch (e) { next(e); }
});

// Upload do documento do atestado → armazena + extrai texto/OCR + indexa (req 7, 8).
router.post('/:id/documento', manage, upload.single('file'), async (req, res, next) => {
  try {
    const file = getFile(req);
    if (!file) return next(createError('Arquivo obrigatório', 400, 'FILE_REQUIRED'));
    const attachment = await storageService.put(tenant(req), {
      name: sanitizeFileName(file.originalname || 'documento.pdf'),
      mimeType: file.mimetype,
      buffer: file.buffer,
      source: 'ATESTADO_DOC',
      uploadedById: req.user!.userId,
    });
    const result = await atestadoService.setDocument(tenant(req), req.params.id, {
      attachmentId: attachment.id,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
    res.json({ status: 200, data: result });
  } catch (e) { next(e); }
});

export default router;
