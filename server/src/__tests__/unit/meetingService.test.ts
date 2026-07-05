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
});
