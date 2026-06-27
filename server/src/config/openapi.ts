import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJSDoc from 'swagger-jsdoc';
import type { Request, Response, RequestHandler } from 'express';
import redoc from 'redoc-express';
import swaggerUi from 'swagger-ui-express';
import { logger } from '../utils/logger.js';

/**
 * OpenAPI 3.0 spec (API-1.1).
 *
 * The document is generated automatically from `@openapi` JSDoc annotations in
 * the route files (req 2 — no manual update step). Served as interactive docs
 * via Redoc at `GET /api/docs` (gated in production by ENABLE_API_DOCS).
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve route source files relative to THIS module so it works both in dev
// (tsx, src/config) and prod (node, dist/config). tsc keeps comments
// (removeComments defaults to false), so JSDoc survives in dist/*.js.
//
// We enumerate explicit absolute file paths instead of passing a glob string:
// glob path-separator handling is unreliable on Windows, which previously made
// swagger-jsdoc match zero files.
const ext = __filename.endsWith('.ts') ? '.ts' : '.js';

function resolveApiFiles(): string[] {
  const files: string[] = [];
  const routesDir = path.join(__dirname, '..', 'routes');
  try {
    for (const name of fs.readdirSync(routesDir)) {
      if (name.endsWith(ext)) files.push(path.join(routesDir, name));
    }
  } catch (err: any) {
    logger.error('OpenAPI: failed to read routes dir', { routesDir, error: err?.message });
  }
  const indexFile = path.join(__dirname, '..', `index${ext}`);
  if (fs.existsSync(indexFile)) files.push(indexFile);
  return files;
}

const apiGlobs = resolveApiFiles();

const swaggerDefinition: swaggerJSDoc.SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'VYD Engage API',
    version: '1.0.0', // req 6
    description:
      'API REST do VYD Engage CRM. Autentique-se com Bearer JWT (sessão) ou ' +
      'API Key (header X-API-Key) para integrações.',
  },
  servers: [{ url: '/api/v1', description: 'Versão atual (relativa ao host)' }],
  // req 4 — all 28 route groups present as tags (operations annotated per route).
  tags: [
    { name: 'Auth', description: 'Autenticação, sessão, 2FA e perfil' },
    { name: 'Leads', description: 'Gestão de leads' },
    { name: 'Deals', description: 'Negócios / pipeline' },
    { name: 'Tasks', description: 'Tarefas' },
    { name: 'Companies', description: 'Empresas / contatos' },
    { name: 'Tags', description: 'Tags de leads' },
    { name: 'Funnels', description: 'Funis e colunas de pipeline' },
    { name: 'Automations', description: 'Automações de marketing/vendas' },
    { name: 'Automation Logs', description: 'Logs de execução de automações' },
    { name: 'Webhooks', description: 'Webhooks de entrada (Mercado Pago, WhatsApp, e-mail)' },
    { name: 'Outgoing Webhooks', description: 'Webhooks de saída configuráveis por evento' },
    { name: 'API Keys', description: 'Chaves de API e scopes' },
    { name: 'Subscriptions', description: 'Assinaturas e planos' },
    { name: 'Payments', description: 'Pagamentos (Mercado Pago)' },
    { name: 'Users', description: 'Usuários do tenant' },
    { name: 'Invitations', description: 'Convites de usuários' },
    { name: 'Custom Fields', description: 'Campos personalizados' },
    { name: 'Interactions', description: 'Interações com leads' },
    { name: 'Notifications', description: 'Notificações' },
    { name: 'Scoring', description: 'Regras de pontuação de leads' },
    { name: 'Reports', description: 'Relatórios e métricas' },
    { name: 'Saved Views', description: 'Visualizações salvas' },
    { name: 'Exports', description: 'Exportações de dados' },
    { name: 'Calendar', description: 'Integração de calendário (Google)' },
    { name: 'Email', description: 'Configuração e envio de e-mail' },
    { name: 'WhatsApp', description: 'Conexões e mensagens WhatsApp' },
    { name: 'AI', description: 'Assistente de IA (resumos, next action, score)' },
    { name: 'Tracking', description: 'Pixel e links rastreáveis (público)' },
    { name: 'Zapier', description: 'Endpoints de integração Zapier (polling)' },
  ],
  // req 3 — Bearer JWT + API Key (X-API-Key)
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT de sessão (Authorization: Bearer <token>).',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Chave de API para integrações (header X-API-Key).',
      },
    },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
};

/** Build (and memoize) the OpenAPI document from JSDoc annotations. */
let cachedSpec: object | null = null;
export function getOpenApiSpec(): object {
  if (cachedSpec) return cachedSpec;
  try {
    cachedSpec = swaggerJSDoc({ definition: swaggerDefinition, apis: apiGlobs });
  } catch (err: any) {
    logger.error('Failed to build OpenAPI spec', { error: err?.message });
    cachedSpec = { ...swaggerDefinition, paths: {} };
  }
  return cachedSpec;
}

/**
 * Whether the docs endpoint is enabled (req 7 + edge case):
 *  - dev/non-production: enabled.
 *  - production: disabled unless ENABLE_API_DOCS=true.
 */
export function areApiDocsEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.ENABLE_API_DOCS === 'true';
}

/** Handler that serves the raw OpenAPI JSON (consumed by Redoc + try-it-out). */
export function openApiJsonHandler(req: Request, res: Response): void {
  if (!areApiDocsEnabled()) {
    res.status(404).json({ error: 'Route not found' });
    return;
  }
  // CORS for try-it-out (req 5) — allow cross-origin fetch of the spec.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(getOpenApiSpec());
}

/** Redoc UI handler for GET /api/docs (404 when docs are disabled). */
export function redocHandler(): RequestHandler {
  const redocMiddleware = redoc({
    title: 'VYD Engage API — Documentação',
    specUrl: '/api/docs/openapi.json',
  });
  return (req, res, next) => {
    if (!areApiDocsEnabled()) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }
    // CORS for try-it-out (req 5).
    res.setHeader('Access-Control-Allow-Origin', '*');
    return redocMiddleware(req, res);
  };
}

/**
 * Swagger UI middleware chain with FUNCTIONAL try-it-out (req 5 + DoD).
 *
 * Redoc (community) is read-only, so the interactive "execute a real request"
 * UI is served by Swagger UI at /api/docs/try, alongside Redoc at /api/docs.
 * redoc-express remains the documentation renderer per the Restrição; Swagger UI
 * only adds the interactive execution surface the spec requires. Gated by the
 * same ENABLE_API_DOCS rule (404 when docs are disabled).
 */
export function swaggerUiHandlers(): RequestHandler[] {
  const gate: RequestHandler = (req, res, next) => {
    if (!areApiDocsEnabled()) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }
    next();
  };
  const setup = swaggerUi.setup(getOpenApiSpec(), {
    customSiteTitle: 'VYD Engage API — Try it out',
    swaggerOptions: { persistAuthorization: true },
  });
  return [gate, ...swaggerUi.serve, setup];
}
