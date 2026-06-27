import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Adds `.openapi()` to the shared zod instance (additive; safe for existing schemas).
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ========================
// Public API schemas
// ========================

const CaptureLeadSchema = registry.register(
  'CaptureLead',
  z.object({
    name: z.string().min(1).openapi({ example: 'Maria Silva' }),
    email: z.string().email().optional(),
    phone: z.string().optional().openapi({ example: '+5511999999999' }),
    company: z.string().optional(),
    message: z.string().optional(),
    source: z.string().optional().openapi({ example: 'website' }),
    customFields: z.record(z.any()).optional(),
  })
);

const PlanSchema = registry.register(
  'Plan',
  z.object({
    id: z.string(),
    type: z.string().openapi({ example: 'PRO' }),
    name: z.string(),
    price: z.number(),
    description: z.string().nullable().optional(),
    features: z.any().optional(),
    highlighted: z.boolean().optional(),
  })
);

// ========================
// Public API paths
// ========================

registry.registerPath({
  method: 'post',
  path: '/public/capture/{tenantSlug}',
  summary: 'Captura pública de lead via formulário',
  tags: ['Public'],
  request: {
    params: z.object({ tenantSlug: z.string().openapi({ example: 'minha-empresa' }) }),
    body: { content: { 'application/json': { schema: CaptureLeadSchema } } },
  },
  responses: {
    201: {
      description: 'Lead capturado com sucesso',
      content: {
        'application/json': {
          schema: z.object({ status: z.number(), message: z.string(), leadId: z.string() }),
        },
      },
    },
    400: { description: 'Erro de validação' },
    404: { description: 'Formulário (tenant) não encontrado' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/public/plans',
  summary: 'Planos públicos (pricing da landing page)',
  tags: ['Public'],
  responses: {
    200: {
      description: 'Lista de planos ativos',
      content: { 'application/json': { schema: z.array(PlanSchema) } },
    },
  },
});

/** Builds the OpenAPI 3.0 document from the registered schemas/paths. */
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'VYD Engage API',
      version: '1.0.0',
      description: 'API pública do VYD Engage CRM (captação de leads e pricing).',
    },
    servers: [{ url: '/api/v1' }],
  });
}
