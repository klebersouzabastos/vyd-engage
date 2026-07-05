import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P3 (B2, req 26): IA de reuniões no deal.
 *
 * Prova o service (IA mockada), sem rede:
 *  - transcrição COLADA → generateObject (mock) → Interaction MEETING + sugestões
 *    (resumo, tarefas com id estável, campos com diff current×suggested).
 *  - apply cria SÓ as tarefas aceitas + atualiza SÓ os campos aceitos (nunca silencioso),
 *    e marca appliedAt/appliedById no metadata.
 *  - sem OpenAI + áudio → 503 AI_NOT_CONFIGURED (Whisper exige OpenAI).
 *  - sem IA (isAIEnabled=false) → 503 AI_NOT_CONFIGURED em assertAIEnabled.
 *
 * `ai`, `@ai-sdk/openai` e aiProvider são mockados; storage/task/deal services também,
 * para isolar a lógica do meetingService.
 */

const { isAIEnabledMock, resolveProviderConfigMock, getModelMock } = vi.hoisted(() => ({
  isAIEnabledMock: vi.fn(() => true),
  resolveProviderConfigMock: vi.fn(() => ({ provider: 'openai', apiKey: 'sk-test' })),
  getModelMock: vi.fn(() => ({ id: 'mock-model' })),
}));

const { generateObjectMock, transcribeMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  transcribeMock: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
  experimental_transcribe: transcribeMock,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => ({ transcription: () => ({ id: 'whisper-1' }) }),
}));

vi.mock('../../services/aiProvider.js', () => ({
  isAIEnabled: isAIEnabledMock,
  resolveProviderConfig: resolveProviderConfigMock,
  getModel: getModelMock,
  logAiUsage: vi.fn(),
}));

const { storagePutMock } = vi.hoisted(() => ({ storagePutMock: vi.fn() }));
vi.mock('../../services/storageService.js', () => ({
  storageService: { put: storagePutMock },
}));

const { taskCreateMock } = vi.hoisted(() => ({ taskCreateMock: vi.fn() }));
vi.mock('../../services/taskService.js', () => ({
  taskService: { create: taskCreateMock },
}));

const { dealUpdateMock } = vi.hoisted(() => ({ dealUpdateMock: vi.fn() }));
vi.mock('../../services/dealService.js', () => ({
  dealService: { update: dealUpdateMock },
}));

import { meetingService } from '../../services/meetingService.js';

const tenantId = 'tenant-1';
const dealId = 'deal-1';

// O deep-mock do Prisma não tipa `.mock.calls`; cast p/ any (padrão do repo).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arg0 = (fn: any) => fn.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  isAIEnabledMock.mockReturnValue(true);
  resolveProviderConfigMock.mockReturnValue({ provider: 'openai', apiKey: 'sk-test' });
  getModelMock.mockReturnValue({ id: 'mock-model' } as never);
  delete process.env.OPENAI_API_KEY;
});

describe('meetingService.assertAIEnabled — gating', () => {
  it('sem IA → 503 AI_NOT_CONFIGURED', () => {
    isAIEnabledMock.mockReturnValue(false);
    try {
      meetingService.assertAIEnabled();
      throw new Error('esperava lançar');
    } catch (err: any) {
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe('AI_NOT_CONFIGURED');
    }
  });
});

describe('meetingService.createMeeting — transcrição colada', () => {
  it('gera resumo + sugestões e cria Interaction MEETING (sem áudio)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({
      value: 1000,
      stage: 'QUALIFICATION',
      notes: 'nota antiga',
    } as never);
    generateObjectMock.mockResolvedValue({
      object: {
        summary: 'Cliente pediu proposta.',
        suggestedTasks: [{ title: 'Enviar proposta', description: 'até sexta' }],
        suggestedFields: [
          { key: 'value', suggested: '2000', reason: 'Escopo maior' },
          { key: 'stage', suggested: 'PROPOSAL', reason: 'Avançou' },
        ],
      },
    });
    prismaMock.interaction.create.mockResolvedValue({
      id: 'int-1',
      createdAt: new Date('2026-07-05T10:00:00Z'),
      audioAttachmentId: null,
      metadata: {
        transcript: 'Reunião...',
        summary: 'Cliente pediu proposta.',
        suggestedTasks: [{ id: 't0', title: 'Enviar proposta', description: 'até sexta' }],
        suggestedFields: [
          { key: 'value', current: '1000', suggested: '2000', reason: 'Escopo maior' },
          { key: 'stage', current: 'QUALIFICATION', suggested: 'PROPOSAL', reason: 'Avançou' },
        ],
        appliedAt: null,
        appliedById: null,
      },
    } as never);

    const meeting = await meetingService.createMeeting(tenantId, dealId, {
      transcript: 'Reunião com o cliente sobre proposta.',
      userId: 'user-1',
    });

    // Não transcreve (sem áudio) e não persiste áudio.
    expect(transcribeMock).not.toHaveBeenCalled();
    expect(storagePutMock).not.toHaveBeenCalled();

    // Interaction MEETING com o metadata correto.
    const createArg = arg0(prismaMock.interaction.create).data;
    expect(createArg).toMatchObject({
      tenantId,
      dealId,
      type: 'MEETING',
      direction: 'OUTBOUND',
      audioAttachmentId: null,
    });
    expect(createArg.metadata.summary).toBe('Cliente pediu proposta.');
    // Tarefas recebem id estável (t0, t1, …).
    expect(createArg.metadata.suggestedTasks[0].id).toBe('t0');
    // Campos com diff current (do deal) × suggested (da IA).
    const valueField = createArg.metadata.suggestedFields.find((f: any) => f.key === 'value');
    expect(valueField).toMatchObject({ current: '1000', suggested: '2000' });

    expect(meeting.summary).toBe('Cliente pediu proposta.');
  });
});

describe('meetingService.createMeeting — áudio sem OpenAI', () => {
  it('áudio + sem OpenAI configurada → 503 AI_NOT_CONFIGURED', async () => {
    // IA habilitada (ex.: Anthropic), mas Whisper exige OpenAI → sem OpenAI, 503.
    resolveProviderConfigMock.mockReturnValue({ provider: 'anthropic', apiKey: 'sk-anthropic' });
    await expect(
      meetingService.createMeeting(tenantId, dealId, {
        audio: { buffer: Buffer.from('fake-audio'), mimeType: 'audio/mpeg', filename: 'r.mp3' },
      })
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_NOT_CONFIGURED' });

    expect(transcribeMock).not.toHaveBeenCalled();
    expect(storagePutMock).not.toHaveBeenCalled();
  });

  it('áudio com mime não-áudio → 415', async () => {
    resolveProviderConfigMock.mockReturnValue({ provider: 'openai', apiKey: 'sk-test' });
    await expect(
      meetingService.createMeeting(tenantId, dealId, {
        audio: { buffer: Buffer.from('x'), mimeType: 'application/pdf', filename: 'x.pdf' },
      })
    ).rejects.toMatchObject({ statusCode: 415, code: 'UNSUPPORTED_AUDIO_TYPE' });
  });
});

describe('meetingService.createMeeting — áudio com OpenAI', () => {
  it('transcreve via Whisper, persiste Attachment(source=MEETING) e vincula áudio', async () => {
    resolveProviderConfigMock.mockReturnValue({ provider: 'openai', apiKey: 'sk-test' });
    transcribeMock.mockResolvedValue({ text: 'Texto transcrito da reunião.' });
    storagePutMock.mockResolvedValue({ id: 'att-1' });
    prismaMock.deal.findFirst.mockResolvedValue({
      value: 500,
      stage: 'QUALIFICATION',
      notes: null,
    } as never);
    generateObjectMock.mockResolvedValue({
      object: { summary: 'Resumo.', suggestedTasks: [], suggestedFields: [] },
    });
    prismaMock.interaction.create.mockResolvedValue({
      id: 'int-2',
      createdAt: new Date(),
      audioAttachmentId: 'att-1',
      metadata: { transcript: 'Texto transcrito da reunião.', summary: 'Resumo.' },
    } as never);

    await meetingService.createMeeting(tenantId, dealId, {
      audio: { buffer: Buffer.from('audio-bytes'), mimeType: 'audio/mpeg', filename: 'r.mp3' },
      userId: 'user-1',
    });

    expect(transcribeMock).toHaveBeenCalledOnce();
    // Grava o áudio com source=MEETING vinculado ao deal (put(tenantId, input) → 2º arg).
    const putArg = storagePutMock.mock.calls[0][1];
    expect(putArg).toMatchObject({ dealId, source: 'MEETING', mimeType: 'audio/mpeg' });
    // A interação aponta para o Attachment do áudio.
    expect(arg0(prismaMock.interaction.create).data.audioAttachmentId).toBe('att-1');
  });

  it('análise falha DEPOIS de transcrever → áudio NÃO é persistido (sem Attachment órfão) (#15)', async () => {
    // Whisper transcreve com sucesso, mas a análise (generateObject) falha → 503.
    // Como o put do áudio só acontece após a análise, nenhum Attachment é criado.
    resolveProviderConfigMock.mockReturnValue({ provider: 'openai', apiKey: 'sk-test' });
    transcribeMock.mockResolvedValue({ text: 'Texto transcrito da reunião.' });
    prismaMock.deal.findFirst.mockResolvedValue({
      value: 500,
      stage: 'QUALIFICATION',
      notes: null,
    } as never);
    generateObjectMock.mockRejectedValue(new Error('IA fora do ar'));

    await expect(
      meetingService.createMeeting(tenantId, dealId, {
        audio: { buffer: Buffer.from('audio-bytes'), mimeType: 'audio/mpeg', filename: 'r.mp3' },
        userId: 'user-1',
      })
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_PROVIDER_UNAVAILABLE' });

    expect(transcribeMock).toHaveBeenCalledOnce();
    // Áudio NÃO foi persistido (put ocorre só após a análise) → sem Attachment órfão.
    expect(storagePutMock).not.toHaveBeenCalled();
    expect(prismaMock.interaction.create).not.toHaveBeenCalled();
  });

  it('Whisper falha em runtime (timeout/429/rede) → 503 AI_PROVIDER_UNAVAILABLE, não 500 (sem Attachment órfão)', async () => {
    // Uma falha de runtime do provedor de transcrição sobe como erro cru SEM statusCode.
    // O service deve convertê-la em 503 AI_PROVIDER_UNAVAILABLE (NUNCA 500 no caminho de
    // IA) — espelhando o que analyzeTranscript faz. Como o put do áudio só ocorre após
    // transcrição + análise, nenhum Attachment é criado.
    resolveProviderConfigMock.mockReturnValue({ provider: 'openai', apiKey: 'sk-test' });
    transcribeMock.mockRejectedValue(new Error('Request timed out (429)'));

    await expect(
      meetingService.createMeeting(tenantId, dealId, {
        audio: { buffer: Buffer.from('audio-bytes'), mimeType: 'audio/mpeg', filename: 'r.mp3' },
        userId: 'user-1',
      })
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_PROVIDER_UNAVAILABLE' });

    expect(transcribeMock).toHaveBeenCalledOnce();
    // Falhou na transcrição → nem análise, nem áudio persistido, nem Interaction.
    expect(generateObjectMock).not.toHaveBeenCalled();
    expect(storagePutMock).not.toHaveBeenCalled();
    expect(prismaMock.interaction.create).not.toHaveBeenCalled();
  });
});

describe('meetingService.applyMeeting — aplica só o aceito', () => {
  const meetingMeta = {
    transcript: 'x',
    summary: 'y',
    suggestedTasks: [
      { id: 't0', title: 'Tarefa A' },
      { id: 't1', title: 'Tarefa B' },
    ],
    suggestedFields: [
      { key: 'value', current: '1000', suggested: '2000' },
      { key: 'stage', current: 'QUALIFICATION', suggested: 'PROPOSAL' },
      { key: 'notes', current: null, suggested: 'anotação nova' },
    ],
    appliedAt: null,
    appliedById: null,
  };

  it('cria só as tarefas aceitas + atualiza só os campos aceitos + marca appliedAt', async () => {
    prismaMock.interaction.findFirst.mockResolvedValue({
      id: 'int-1',
      dealId,
      metadata: meetingMeta,
    } as never);
    // Deal sem notas atuais → a anotação sugerida entra como está (sem prefixo).
    prismaMock.deal.findFirst.mockResolvedValue({ notes: null } as never);
    taskCreateMock.mockImplementation(async () => ({ id: `task-${taskCreateMock.mock.calls.length}` }));
    dealUpdateMock.mockResolvedValue({ id: dealId });
    prismaMock.interaction.update.mockResolvedValue({ id: 'int-1' } as never);

    const result = await meetingService.applyMeeting(
      tenantId,
      dealId,
      'int-1',
      { taskIds: ['t1'], fieldUpdates: { value: '2000', notes: 'anotação nova' } },
      'user-1'
    );

    // Só a Tarefa B (t1) foi criada.
    expect(taskCreateMock).toHaveBeenCalledOnce();
    const taskArg = taskCreateMock.mock.calls[0][1];
    expect(taskArg).toMatchObject({ title: 'Tarefa B', dealId });
    expect(result.createdTaskIds).toHaveLength(1);

    // Só value + notes aplicados (stage NÃO foi aceito).
    expect(dealUpdateMock).toHaveBeenCalledOnce();
    const dealArg = dealUpdateMock.mock.calls[0][1];
    expect(dealArg).toMatchObject({ id: dealId, value: 2000, notes: 'anotação nova' });
    expect(dealArg.stage).toBeUndefined();
    expect(result.updatedFields.sort()).toEqual(['notes', 'value']);

    // Marca appliedAt/appliedById no metadata. O deep-mock do Prisma tem assinatura
    // sobrecarregada — cast p/ any p/ indexar `.mock.calls` (padrão dos testes do repo).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateArg = (prismaMock.interaction.update as any).mock.calls[0][0].data;
    expect(updateArg.metadata.appliedAt).toEqual(expect.any(String));
    expect(updateArg.metadata.appliedById).toBe('user-1');
  });

  it('reunião já aplicada → 409 MEETING_ALREADY_APPLIED e nenhum efeito (#3/#9)', async () => {
    // metadata com appliedAt setado → uma nova chamada NÃO pode reaplicar (duplicar
    // tarefas / reanexar notas). Rejeita antes de qualquer efeito colateral.
    prismaMock.interaction.findFirst.mockResolvedValue({
      id: 'int-1',
      dealId,
      metadata: { ...meetingMeta, appliedAt: '2026-07-05T09:00:00Z', appliedById: 'user-0' },
    } as never);

    await expect(
      meetingService.applyMeeting(
        tenantId,
        dealId,
        'int-1',
        { taskIds: ['t1'], fieldUpdates: { value: '2000' } },
        'user-1'
      )
    ).rejects.toMatchObject({ statusCode: 409, code: 'MEETING_ALREADY_APPLIED' });

    // Nada foi criado/atualizado.
    expect(taskCreateMock).not.toHaveBeenCalled();
    expect(dealUpdateMock).not.toHaveBeenCalled();
    expect(prismaMock.interaction.update).not.toHaveBeenCalled();
  });

  it('validação de campo falha ANTES de criar tarefa (stage inválido → 0 tarefas) (#4)', async () => {
    // Uma tarefa é aceita (t1) E um campo inválido (stage=WON) é enviado. A validação
    // do campo deve rejeitar ANTES de criar qualquer tarefa — senão um retry duplicaria.
    prismaMock.interaction.findFirst.mockResolvedValue({
      id: 'int-1',
      dealId,
      metadata: {
        ...meetingMeta,
        suggestedFields: [{ key: 'stage', current: 'CLOSING', suggested: 'WON' }],
      },
    } as never);

    await expect(
      meetingService.applyMeeting(
        tenantId,
        dealId,
        'int-1',
        { taskIds: ['t1'], fieldUpdates: { stage: 'WON' } },
        'user-1'
      )
    ).rejects.toMatchObject({ statusCode: 400, code: 'MEETING_FIELD_NOT_APPLICABLE' });

    // Nenhuma tarefa criada (a validação veio primeiro) e o deal não foi tocado.
    expect(taskCreateMock).not.toHaveBeenCalled();
    expect(dealUpdateMock).not.toHaveBeenCalled();
    expect(prismaMock.interaction.update).not.toHaveBeenCalled();
  });

  it('nada aceito → não cria tarefa nem atualiza deal', async () => {
    prismaMock.interaction.findFirst.mockResolvedValue({
      id: 'int-1',
      dealId,
      metadata: meetingMeta,
    } as never);
    prismaMock.interaction.update.mockResolvedValue({ id: 'int-1' } as never);

    const result = await meetingService.applyMeeting(
      tenantId,
      dealId,
      'int-1',
      { taskIds: [], fieldUpdates: {} },
      'user-1'
    );

    expect(taskCreateMock).not.toHaveBeenCalled();
    expect(dealUpdateMock).not.toHaveBeenCalled();
    expect(result.createdTaskIds).toHaveLength(0);
    expect(result.updatedFields).toHaveLength(0);
  });

  it('reunião de outro tenant / inexistente → 404', async () => {
    prismaMock.interaction.findFirst.mockResolvedValue(null as never);
    await expect(
      meetingService.applyMeeting(tenantId, dealId, 'int-x', { taskIds: [], fieldUpdates: {} })
    ).rejects.toMatchObject({ statusCode: 404, code: 'MEETING_NOT_FOUND' });
  });

  it('value inválido → 400 e não atualiza deal', async () => {
    prismaMock.interaction.findFirst.mockResolvedValue({
      id: 'int-1',
      dealId,
      metadata: meetingMeta,
    } as never);
    await expect(
      meetingService.applyMeeting(
        tenantId,
        dealId,
        'int-1',
        { taskIds: [], fieldUpdates: { value: 'abc' } },
        'user-1'
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(dealUpdateMock).not.toHaveBeenCalled();
  });

  it('stage=LOST → 400 MEETING_FIELD_NOT_APPLICABLE e não atualiza deal (#9)', async () => {
    // A sugestão precisa conter a chave "stage" para o apply chegar na coerção.
    prismaMock.interaction.findFirst.mockResolvedValue({
      id: 'int-1',
      dealId,
      metadata: {
        ...meetingMeta,
        suggestedFields: [{ key: 'stage', current: 'NEGOTIATION', suggested: 'LOST' }],
      },
    } as never);
    await expect(
      meetingService.applyMeeting(
        tenantId,
        dealId,
        'int-1',
        { taskIds: [], fieldUpdates: { stage: 'LOST' } },
        'user-1'
      )
    ).rejects.toMatchObject({ statusCode: 400, code: 'MEETING_FIELD_NOT_APPLICABLE' });
    expect(dealUpdateMock).not.toHaveBeenCalled();
  });

  it('stage=WON → 400 MEETING_FIELD_NOT_APPLICABLE (fluxo próprio de ganho) (#9)', async () => {
    prismaMock.interaction.findFirst.mockResolvedValue({
      id: 'int-1',
      dealId,
      metadata: {
        ...meetingMeta,
        suggestedFields: [{ key: 'stage', current: 'CLOSING', suggested: 'WON' }],
      },
    } as never);
    await expect(
      meetingService.applyMeeting(
        tenantId,
        dealId,
        'int-1',
        { taskIds: [], fieldUpdates: { stage: 'WON' } },
        'user-1'
      )
    ).rejects.toMatchObject({ statusCode: 400, code: 'MEETING_FIELD_NOT_APPLICABLE' });
    expect(dealUpdateMock).not.toHaveBeenCalled();
  });

  it('notes: ANEXA à nota atual do deal em vez de sobrescrever (#10)', async () => {
    prismaMock.interaction.findFirst.mockResolvedValue({
      id: 'int-1',
      dealId,
      metadata: meetingMeta,
    } as never);
    // Deal JÁ tem uma nota — a sugestão deve ser anexada, preservando a existente.
    prismaMock.deal.findFirst.mockResolvedValue({ notes: 'nota existente' } as never);
    dealUpdateMock.mockResolvedValue({ id: dealId });
    prismaMock.interaction.update.mockResolvedValue({ id: 'int-1' } as never);

    const result = await meetingService.applyMeeting(
      tenantId,
      dealId,
      'int-1',
      { taskIds: [], fieldUpdates: { notes: 'anotação nova' } },
      'user-1'
    );

    // A busca do deal atual é escopada por tenant (multi-tenant).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notesQuery = (prismaMock.deal.findFirst as any).mock.calls[0][0];
    expect(notesQuery.where).toMatchObject({ id: dealId, tenantId });

    // O update recebe nota_atual + \n\n + nota_sugerida (não substitui).
    expect(dealUpdateMock).toHaveBeenCalledOnce();
    const dealArg = dealUpdateMock.mock.calls[0][1];
    expect(dealArg.notes).toBe('nota existente\n\nanotação nova');
    expect(result.updatedFields).toEqual(['notes']);
  });
});
