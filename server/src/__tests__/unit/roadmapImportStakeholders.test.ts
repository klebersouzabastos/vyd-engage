// Pesquisa de Empresa → Organograma do Desdobramento: o cap. 7 (Mapa de
// Stakeholders) é só markdown; aqui ele vira pré-visualização com dedupe contra
// os contatos da empresa, e depois Leads (isContact) + RoadmapStakeholder — sempre
// com confirmação humana das linhas (o modelo pode alucinar nomes).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';

vi.mock('../../services/taskService.js', () => ({ taskService: { create: vi.fn() } }));
vi.mock('../../services/dealService.js', () => ({ dealService: { create: vi.fn(), update: vi.fn() } }));
vi.mock('../../services/googleCalendarService.js', () => ({
  googleCalendarService: { syncTaskForUser: vi.fn(async () => {}) },
}));

import { roadmapService } from '../../services/roadmapService.js';

const TENANT = 't1';
const RELATORIO = [
  '## Capítulo 7 — Mapa de Stakeholders',
  '| Nome | Cargo | Contato institucional público | Classificação |',
  '|---|---|---|---|',
  '| Ana Souza | Diretora de Engenharia | ana@acme.com | decide |',
  '| Carlos Lima | Gerente de Suprimentos | — | influencia / veta |',
  '| Bruno Reis | Coordenador | — | influencia |',
].join('\n');

function mockRoadmap(overrides: Record<string, unknown> = {}) {
  prismaMock.commercialRoadmap.findFirst.mockResolvedValue({
    id: 'rm1',
    tenantId: TENANT,
    companyId: 'co1',
    deepResearchId: 'dr1',
    stakeholders: [],
    tasks: [],
    ...overrides,
  } as never);
}

function createCalls() {
  return prismaMock.lead.create.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>;
}
function upsertCalls() {
  return prismaMock.roadmapStakeholder.upsert.mock.calls as unknown as Array<
    [{ create: Record<string, unknown> }]
  >;
}

beforeEach(() => {
  prismaMock.deepResearch.findFirst.mockResolvedValue({
    id: 'dr1',
    title: 'Empresa: ACME',
    reportMarkdown: RELATORIO,
  } as never);
  prismaMock.lead.findMany.mockResolvedValue([] as never);
});

describe('previewStakeholdersFromResearch', () => {
  it('usa a pesquisa de origem do roadmap e devolve as linhas do cap. 7 com papel sugerido', async () => {
    mockRoadmap();

    const out = await roadmapService.previewStakeholdersFromResearch(TENANT, 'rm1');

    expect(out.research).toEqual({ id: 'dr1', title: 'Empresa: ACME' });
    expect(out.rows.map((r) => r.name)).toEqual(['Ana Souza', 'Carlos Lima', 'Bruno Reis']);
    expect(out.rows[0]).toMatchObject({ email: 'ana@acme.com', suggestedRole: 'DECISOR' });
    expect(out.rows[1].suggestedRole).toBe('APROVADOR');
    const where = (prismaMock.deepResearch.findFirst.mock.calls as unknown as Array<[{ where: unknown }]>)[0][0].where;
    expect(where).toMatchObject({ id: 'dr1', tenantId: TENANT });
  });

  it('marca contato já existente na empresa (por nome normalizado ou e-mail) e se já é stakeholder', async () => {
    mockRoadmap({ stakeholders: [{ leadId: 'lead-ana' }] });
    prismaMock.lead.findMany.mockResolvedValue([
      { id: 'lead-ana', name: 'ANA  SOUZA', email: null },
      { id: 'lead-carlos', name: 'C. Lima', email: 'carlos@acme.com' },
      { id: 'lead-bruno', name: 'Outro', email: 'bruno@acme.com' },
    ] as never);

    const out = await roadmapService.previewStakeholdersFromResearch(TENANT, 'rm1');

    expect(out.rows[0]).toMatchObject({ existingLeadId: 'lead-ana', alreadyStakeholder: true });
    expect(out.rows[1].existingLeadId).toBeUndefined();
    expect(out.rows[2].existingLeadId).toBeUndefined();
    const whereLeads = (prismaMock.lead.findMany.mock.calls as unknown as Array<[{ where: unknown }]>)[0][0].where;
    expect(whereLeads).toMatchObject({ tenantId: TENANT, companyId: 'co1', deletedAt: null });
  });

  it('e-mail da pesquisa igual ao de um contato vincula mesmo com nome diferente', async () => {
    mockRoadmap();
    prismaMock.lead.findMany.mockResolvedValue([
      { id: 'lead-x', name: 'Ana S.', email: 'ANA@acme.com' },
    ] as never);

    const out = await roadmapService.previewStakeholdersFromResearch(TENANT, 'rm1');

    expect(out.rows[0].existingLeadId).toBe('lead-x');
  });

  it('sem pesquisa de origem nem id informado → 400 RESEARCH_REQUIRED', async () => {
    mockRoadmap({ deepResearchId: null });

    await expect(roadmapService.previewStakeholdersFromResearch(TENANT, 'rm1')).rejects.toMatchObject({
      code: 'RESEARCH_REQUIRED',
    });
  });

  it('pesquisa de outro tenant (não encontrada) → 404', async () => {
    mockRoadmap();
    prismaMock.deepResearch.findFirst.mockResolvedValue(null as never);

    await expect(
      roadmapService.previewStakeholdersFromResearch(TENANT, 'rm1', 'dr-alheia')
    ).rejects.toMatchObject({ code: 'DEEP_RESEARCH_NOT_FOUND' });
  });
});

describe('importStakeholdersFromResearch', () => {
  beforeEach(() => {
    mockRoadmap();
    prismaMock.lead.findFirst.mockResolvedValue({ id: 'qualquer' } as never);
    prismaMock.roadmapStakeholder.upsert.mockImplementation(
      (async (args: { create: { leadId: string; roleInDecision: string } }) => ({
        id: 'st',
        leadId: args.create.leadId,
        roleInDecision: args.create.roleInDecision,
        lead: { id: args.create.leadId, name: 'x' },
      })) as never
    );
    let n = 0;
    prismaMock.lead.create.mockImplementation(
      (async (args: { data: { name: string } }) => ({ id: `novo-${++n}`, name: args.data.name })) as never
    );
  });

  it('cria Lead (isContact, companyId, proveniência) para linha sem contato existente e vincula ao roadmap', async () => {
    const out = await roadmapService.importStakeholdersFromResearch(TENANT, 'rm1', {
      deepResearchId: 'dr1',
      rows: [
        {
          name: 'Ana Souza',
          position: 'Diretora de Engenharia',
          email: 'ana@acme.com',
          classification: 'decide',
          roleInDecision: 'DECISOR',
          posture: 'FAVORAVEL',
        },
      ],
    });

    expect(out.created).toBe(1);
    expect(out.linked).toBe(0);
    const data = createCalls()[0][0].data;
    expect(data).toMatchObject({
      tenantId: TENANT,
      companyId: 'co1',
      name: 'Ana Souza',
      position: 'Diretora de Engenharia',
      email: 'ana@acme.com',
      isContact: true,
    });
    expect(data.convertedAt).toBeInstanceOf(Date);
    expect(String(data.notes)).toContain('Importado da pesquisa «Empresa: ACME»');
    expect(String(data.notes)).toContain('classificação: decide');

    const up = upsertCalls()[0][0].create;
    expect(up).toMatchObject({ roadmapId: 'rm1', leadId: 'novo-1', roleInDecision: 'DECISOR', posture: 'FAVORAVEL' });
    expect(out.stakeholders).toHaveLength(1);
  });

  it('linha com existingLeadId não cria Lead: só vincula', async () => {
    const out = await roadmapService.importStakeholdersFromResearch(TENANT, 'rm1', {
      deepResearchId: 'dr1',
      rows: [{ name: 'Ana Souza', existingLeadId: 'lead-ana', roleInDecision: 'INFLUENCIADOR' }],
    });

    expect(out.created).toBe(0);
    expect(out.linked).toBe(1);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(upsertCalls()[0][0].create).toMatchObject({ leadId: 'lead-ana', roleInDecision: 'INFLUENCIADOR' });
  });

  it('mais de 50 linhas → 400 TOO_MANY_ROWS, sem gravar nada', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ name: `P${i}`, roleInDecision: 'USUARIO' as const }));

    await expect(
      roadmapService.importStakeholdersFromResearch(TENANT, 'rm1', { deepResearchId: 'dr1', rows })
    ).rejects.toMatchObject({ code: 'TOO_MANY_ROWS' });
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });
});
