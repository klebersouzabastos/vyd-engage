import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { LeadStatus, LeadSource } from '@prisma/client';

/**
 * Reproduz o payload REAL que a tela de novo lead envia (LeadForm → useLeads)
 * contra o schema REAL da rota (server/src/routes/leads.ts), para descobrir qual
 * campo derruba o POST /leads com 400 "Validation error".
 */
const vazioComoAusente = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);

const createLeadSchema = z.object({
  name: z.string().min(1),
  email: vazioComoAusente(z.string().email().optional()),
  phone: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  score: z.number().int().min(0).max(100).optional(),
  customFields: z.record(z.any()).optional(),
  notes: z.string().optional(),
  assignedTo: vazioComoAusente(z.string().uuid().optional()),
  tagIds: z.array(z.string().uuid()).optional(),
});

/** Payload como o useLeads.createLead monta hoje. */
function payloadDaTela(over: Record<string, unknown> = {}) {
  return {
    name: 'Lead de teste',
    email: '', // formData.email começa vazio e vai assim quando não preenchido
    phone: '',
    company: undefined,
    position: undefined,
    status: 'NEW',
    source: 'OTHER',
    score: 0,
    customFields: { 'campo-livre': 'valor' },
    notes: undefined,
    assignedTo: undefined,
    tagIds: [],
    ...over,
  };
}

describe('POST /leads — payload da tela vs schema da rota', () => {
  it('e-mail VAZIO passa a ser aceito como "não informado" (era a causa do 400)', () => {
    const r = createLeadSchema.safeParse(payloadDaTela());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBeUndefined();
  });

  it('e-mail INVÁLIDO continua sendo rejeitado — a tolerância é só para vazio', () => {
    const r = createLeadSchema.safeParse(payloadDaTela({ email: 'nao-e-email' }));
    expect(r.success).toBe(false);
  });

  it('com e-mail preenchido, o mesmo payload passa', () => {
    const r = createLeadSchema.safeParse(payloadDaTela({ email: 'alguem@k2mais.com.br' }));
    expect(r.success).toBe(true);
  });

  it('com e-mail ausente (undefined), passa — é assim que a tela deveria enviar', () => {
    const r = createLeadSchema.safeParse(payloadDaTela({ email: undefined }));
    expect(r.success).toBe(true);
  });

  it('assignedTo vazio também é aceito (uuid rejeitaria string vazia)', () => {
    const r = createLeadSchema.safeParse(payloadDaTela({ email: undefined, assignedTo: '' }));
    expect(r.success).toBe(true);
  });

  it('assignedTo com valor não-uuid continua rejeitado', () => {
    const r = createLeadSchema.safeParse(payloadDaTela({ email: undefined, assignedTo: 'abc' }));
    expect(r.success).toBe(false);
  });

  it('phone vazio NÃO é problema (z.string() aceita vazio)', () => {
    const r = createLeadSchema.safeParse(payloadDaTela({ email: undefined, phone: '' }));
    expect(r.success).toBe(true);
  });
});
