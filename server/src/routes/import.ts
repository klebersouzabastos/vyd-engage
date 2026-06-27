import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { importLimiter } from '../middleware/rateLimit.js';
import { createError } from '../middleware/errorHandler.js';
import { ImportType } from '@prisma/client';
import { logger } from '../utils/logger.js';
import {
  parseImportFile,
  analyzeLeads,
  analyzeDeals,
  analyzeInteractions,
  analyzeCompanies,
  createBatch,
  executeBatch,
  shouldRunSync,
  listBatches,
  getBatch,
  rollbackBatch,
  ImportError,
  MAX_IMPORT_ROWS,
  type ColumnMapping,
  type DuplicateStrategy,
  type DuplicateActionMap,
  type LeadImportOptions,
  type ParsedFile,
} from '../services/importService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);
// 5 imports/hour/tenant (spec req 29). Keyed by tenantId; GETs are skipped.
router.use(importLimiter);

// 10 MB max file size (spec req 3 / restriction). Held in memory — files are
// small one-shot uploads and we parse the buffer directly.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Translate multer errors (e.g. file too large) into the project error format.
function handleUpload(field: string) {
  const mw = upload.single(field);
  return (req: any, res: any, next: any) => {
    mw(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return next(createError('Arquivo excede o tamanho máximo de 10 MB.', 413, 'FILE_TOO_LARGE'));
        }
        return next(createError('Falha no upload do arquivo.', 400, 'UPLOAD_FAILED'));
      }
      next();
    });
  };
}

const mappingSchema = z.record(z.string());

function parseMapping(raw: unknown): ColumnMapping {
  if (raw === undefined || raw === null || raw === '') return {};
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      throw createError('Mapeamento de colunas inválido (JSON malformado).', 400, 'INVALID_MAPPING');
    }
  }
  const result = mappingSchema.safeParse(value);
  if (!result.success) {
    throw createError('Mapeamento de colunas inválido.', 400, 'INVALID_MAPPING');
  }
  return result.data;
}

function parseDuplicateStrategy(raw: unknown): DuplicateStrategy {
  const v = String(raw ?? 'skip').toLowerCase();
  return v === 'update' ? 'update' : 'skip';
}

/**
 * Parse the per-duplicate actions map the frontend sends as a JSON string
 * `{ "<row>": "skip" | "update" }` (Gap 4). Unknown values default to 'skip';
 * a malformed/absent payload yields an empty map (global strategy applies).
 */
function parseDuplicateActions(raw: unknown): DuplicateActionMap {
  if (raw === undefined || raw === null || raw === '') return {};
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof value !== 'object' || value === null) return {};
  const out: DuplicateActionMap = {};
  for (const [row, action] of Object.entries(value as Record<string, unknown>)) {
    out[row] = String(action).toLowerCase() === 'update' ? 'update' : 'skip';
  }
  return out;
}

function isDryRun(req: { query: Record<string, unknown>; body: Record<string, unknown> }): boolean {
  const v = req.query.dry_run ?? req.body.dry_run;
  return v === true || v === 'true' || v === '1';
}

function mapImportError(err: unknown) {
  if (err instanceof ImportError) {
    return createError(err.message, err.statusCode, err.code);
  }
  return err;
}

/**
 * Shared handler for leads/contacts/companies/deals/interactions import. Parses
 * the file, runs the analysis, and either returns the dry-run report (spec req
 * 11) or persists synchronously (≤500 rows, req 30) / asynchronously (>500 rows,
 * req 31). `opts.contactsMode` selects the contacts variant of the leads path.
 */
async function handleImport(
  req: any,
  res: any,
  next: any,
  type: ImportType,
  opts: { contactsMode?: boolean } = {},
) {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    if (!req.file) {
      return next(createError('Nenhum arquivo enviado.', 400, 'NO_FILE'));
    }

    // Leads, contacts and companies are mapped via a visual column mapper.
    const usesMapping = type === ImportType.LEADS || type === ImportType.COMPANIES;
    const mapping = usesMapping ? parseMapping(req.body.mapping) : {};
    const options: LeadImportOptions | undefined = opts.contactsMode ? { contactsMode: true } : undefined;

    let parsed: ParsedFile;
    try {
      parsed = await parseImportFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    } catch (err) {
      return next(mapImportError(err));
    }

    if (parsed.rows.length === 0) {
      return next(createError('O arquivo não contém linhas de dados.', 400, 'EMPTY_FILE'));
    }
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      return next(
        createError(
          `A importação excede o máximo de ${MAX_IMPORT_ROWS} linhas.`,
          400,
          'TOO_MANY_ROWS',
        ),
      );
    }

    const dryRun = isDryRun(req);
    // Per-row decisions drive leads/contacts dedup (Gap 4); the global strategy is
    // only a fallback for rows the frontend did not specify.
    const duplicateActions =
      type === ImportType.LEADS ? parseDuplicateActions(req.body.duplicateActions) : {};
    // Companies and contacts default to upsert (idempotent re-import, spec req 27);
    // plain leads keep the original 'skip' default.
    const defaultStrategy = type === ImportType.COMPANIES || opts.contactsMode ? 'update' : 'skip';
    const duplicateStrategy = parseDuplicateStrategy(
      req.body.duplicateStrategy ?? req.body.duplicate_strategy ?? defaultStrategy,
    );

    // Run analysis (used for both dry-run and to feed the writers).
    let analysisResult;
    if (type === ImportType.COMPANIES) {
      analysisResult = await analyzeCompanies(tenantId, parsed, mapping);
    } else if (type === ImportType.LEADS) {
      analysisResult = await analyzeLeads(tenantId, parsed, mapping, options);
    } else if (type === ImportType.DEALS) {
      analysisResult = await analyzeDeals(tenantId, parsed);
    } else {
      analysisResult = await analyzeInteractions(tenantId, parsed);
    }

    // Dry-run: never write, just return the report (spec reqs 11, 13, 15).
    if (dryRun) {
      return res.json({ status: 200, data: { dryRun: true, ...analysisResult.analysis } });
    }

    // Create the batch row.
    const batch = await createBatch(tenantId, userId, type, parsed.rows.length);

    const runInput = { tenantId, userId, type, parsed, mapping, duplicateStrategy, duplicateActions, options };

    // The precomputed `type` tag mirrors the entity so executeBatch reuses the
    // analysis instead of re-running it.
    const precomputedType =
      type === ImportType.COMPANIES
        ? 'COMPANIES'
        : type === ImportType.LEADS
          ? 'LEADS'
          : type === ImportType.DEALS
            ? 'DEALS'
            : 'INTERACTIONS';
    const buildPrecomputed = () =>
      ({ type: precomputedType as any, rows: (analysisResult as any).mappedRows });

    if (shouldRunSync(parsed.rows.length)) {
      // ≤500 rows → process now and return the final state (spec req 30).
      await executeBatch(batch.id, runInput, buildPrecomputed());
      const finalBatch = await getBatch(tenantId, batch.id);
      // Unified import contract (Gap 3): map the batch row onto the same shape
      // the dry-run and the frontend toast consume. importedRows already folds
      // in updated duplicates; skippedRows are the duplicates that were skipped.
      return res.json({
        status: 200,
        data: {
          batchId: batch.id,
          async: false,
          totalRows: finalBatch?.totalRows ?? parsed.rows.length,
          newCount: finalBatch?.importedRows ?? 0,
          duplicateCount: finalBatch?.skippedRows ?? 0,
          errorCount: finalBatch?.errorRows ?? 0,
        },
      });
    }

    // >500 rows → return immediately with batchId, process in background (spec req 31).
    res.status(202).json({ status: 202, data: { batchId: batch.id, async: true } });

    setImmediate(() => {
      executeBatch(batch.id, runInput, buildPrecomputed()).catch((err) => {
        logger.error('Async import execution failed', err, { batchId: batch.id, tenantId });
      });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(mapImportError(error));
  }
}

// POST /api/v1/import/leads — multipart (file + mapping JSON), dry_run supported
router.post('/leads', handleUpload('file'), (req, res, next) =>
  handleImport(req, res, next, ImportType.LEADS),
);

// POST /api/v1/import/companies — multipart (file + mapping JSON), dry_run supported
router.post('/companies', handleUpload('file'), (req, res, next) =>
  handleImport(req, res, next, ImportType.COMPANIES),
);

// POST /api/v1/import/contacts — contacts variant of leads (email optional,
// dedup by name+email/company, links to companies, flagged isContact)
router.post('/contacts', handleUpload('file'), (req, res, next) =>
  handleImport(req, res, next, ImportType.LEADS, { contactsMode: true }),
);

// POST /api/v1/import/deals — multipart CSV (lead_email, deal_name, value, stage, expected_close_date)
router.post('/deals', handleUpload('file'), (req, res, next) =>
  handleImport(req, res, next, ImportType.DEALS),
);

// POST /api/v1/import/interactions — multipart CSV (lead_email, type, date, notes)
router.post('/interactions', handleUpload('file'), (req, res, next) =>
  handleImport(req, res, next, ImportType.INTERACTIONS),
);

// GET /api/v1/import/batches — import history + polling source (spec reqs 22, 31)
router.get('/batches', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const batches = await listBatches(req.user.tenantId);
    res.json({ status: 200, data: { batches } });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/import/batches/:batchId — single batch status (polling, spec req 31)
router.get('/batches/:batchId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const batch = await getBatch(req.user.tenantId, req.params.batchId);
    if (!batch) return next(createError('Lote de importação não encontrado.', 404, 'BATCH_NOT_FOUND'));
    res.json({ status: 200, data: { batch } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/import/batches/:batchId — rollback via soft delete (spec reqs 27-28)
router.delete('/batches/:batchId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await rollbackBatch(req.user.tenantId, req.params.batchId);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(mapImportError(error));
  }
});

export default router;
