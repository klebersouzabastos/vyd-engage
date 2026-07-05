/**
 * meetingService — IA de reuniões no deal (Upgrade RD P3, req 26).
 *
 * Fluxo:
 *  1. Entrada: ÁUDIO (multipart) OU transcrição COLADA (texto).
 *     - Áudio → exige OpenAI (Whisper `whisper-1`) para transcrever. Sem OpenAI → 503.
 *     - Transcrição colada → NÃO exige Whisper (só a análise).
 *  2. Análise: `generateObject` (schema Zod) com o modelo ativo (aiProvider.getActiveModel)
 *     → { summary, suggestedTasks[], suggestedFields[] }. Sem IA → 503.
 *  3. Persistência: grava o áudio como Attachment (source=MEETING) via storageService
 *     (quando houver áudio) + uma Interaction (type MEETING, audioAttachmentId,
 *     direction OUTBOUND, metadata { transcript, summary, suggestedTasks, suggestedFields }).
 *  4. apply: cria só as Tasks aceitas (taskService, vinculadas ao deal) + atualiza só os
 *     campos aceitos do deal (dealService.update — respeita as guardas P1) e marca
 *     appliedAt/appliedBy no metadata. NUNCA aplica silenciosamente.
 *
 * GATING GRACIOSO: sem `aiProvider.isAIEnabled()` → 503 AI_NOT_CONFIGURED (nunca 500).
 * Multi-tenant: todo acesso é escopado por tenantId; a rota valida o deal do tenant +
 * acesso (visibilityScope P1) antes de chamar este service.
 */
import { z } from 'zod';
import { generateObject, experimental_transcribe as transcribe } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import prisma from '../config/database.js';
import { InteractionType, InteractionDirection, DealStage, type Prisma } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import {
  resolveProviderConfig,
  isAIEnabled,
  getModel,
  logAiUsage,
} from './aiProvider.js';
import { storageService } from './storageService.js';
import { taskService } from './taskService.js';
import { dealService } from './dealService.js';

// ========================
// Types
// ========================

/** Chaves de campo do deal que a análise pode sugerir atualizar. */
export type SuggestedFieldKey = 'value' | 'stage' | 'notes';

export interface SuggestedTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
}

export interface SuggestedField {
  key: SuggestedFieldKey;
  current: string | null;
  suggested: string | null;
  reason?: string;
}

export interface MeetingAnalysis {
  summary: string;
  suggestedTasks: SuggestedTask[];
  suggestedFields: SuggestedField[];
}

export interface ApplyMeetingInput {
  taskIds: string[];
  fieldUpdates: Partial<Record<SuggestedFieldKey, string>>;
}

// ========================
// Análise (schema de saída da IA)
// ========================

// O modelo devolve as tarefas SEM id (o id estável é atribuído por nós); os campos
// vêm com chave restrita a value|stage|notes. `current` é preenchido por nós a partir
// do deal (o modelo não sabe o valor atual), então aqui pedimos só o `suggested`.
const analysisSchema = z.object({
  summary: z.string(),
  suggestedTasks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        dueDate: z.string().optional(),
      })
    )
    .default([]),
  suggestedFields: z
    .array(
      z.object({
        key: z.enum(['value', 'stage', 'notes']),
        suggested: z.string(),
        reason: z.string().optional(),
      })
    )
    .default([]),
});

const SYSTEM_PROMPT = `Você é um assistente comercial que analisa transcrições de reuniões de vendas em português do Brasil.
A partir da transcrição, produza:
- summary: um resumo objetivo da reunião (3 a 6 frases), em pt-BR.
- suggestedTasks: próximas ações concretas de follow-up (title curto no imperativo; description opcional; dueDate ISO 8601 opcional só quando a reunião citar prazo claro).
- suggestedFields: atualizações sugeridas para o negócio, SOMENTE quando a reunião indicar. Chaves permitidas:
    "value" (novo valor numérico do negócio, sem símbolo de moeda),
    "stage" (uma de: QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSING). NUNCA sugira WON nem LOST em "stage": ganho e perda têm fluxo próprio e não podem ser aplicados por aqui.
    "notes" (anotações relevantes a acrescentar).
  Para cada campo, "suggested" é o novo valor e "reason" a justificativa curta.
Não invente informações que não estejam na transcrição.`;

const MEETING_AUDIO_MIME_PREFIX = 'audio/';

// ========================
// Service
// ========================

export const meetingService = {
  /** Gating: lança 503 AI_NOT_CONFIGURED quando a IA não está configurada. */
  assertAIEnabled() {
    if (!isAIEnabled()) {
      throw createError(
        'Recurso de IA não configurado. Configure um provedor de IA para usar reuniões.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }
  },

  /**
   * Transcreve um áudio de reunião via Whisper (OpenAI). Exige que o provedor OpenAI
   * esteja configurado (whisper-1 é da OpenAI) — sem ele → 503. Retorna o texto.
   */
  async transcribeAudio(tenantId: string, buffer: Buffer, mimeType: string): Promise<string> {
    this.assertAIEnabled();

    if (!mimeType.startsWith(MEETING_AUDIO_MIME_PREFIX)) {
      throw createError(
        `Tipo de arquivo de áudio não suportado: ${mimeType}.`,
        415,
        'UNSUPPORTED_AUDIO_TYPE'
      );
    }

    // Whisper é específico da OpenAI. Só transcrevemos se houver uma API key OpenAI —
    // seja via AI_PROVIDER=openai, seja via OPENAI_API_KEY legado.
    const config = resolveProviderConfig();
    const openaiApiKey =
      config?.provider === 'openai' ? config.apiKey : process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw createError(
        'Transcrição de áudio exige o provedor OpenAI (Whisper). Cole a transcrição do texto ou configure a OpenAI.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }

    const started = Date.now();
    const openai = createOpenAI({ apiKey: openaiApiKey });
    // A inferência genérica do transcribe pode disparar TS2589 sob node16 —
    // chamamos sem tipar e validamos o formato do retorno em runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
    try {
      // Uma falha de runtime do provedor (timeout, 429, rede, credencial revogada
      // mid-flight) sobe como erro cru SEM statusCode → viraria 500. Convertemos em
      // 503 AI_PROVIDER_UNAVAILABLE, espelhando o que analyzeTranscript faz com
      // generateObject — "NUNCA 500 no caminho de IA".
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = await (transcribe as any)({
        model: openai.transcription('whisper-1'),
        audio: new Uint8Array(buffer),
      });
    } catch (err: unknown) {
      logger.warn('Falha na transcrição da reunião (IA).', err as Error);
      throw createError(
        'O serviço de transcrição está temporariamente indisponível. Tente novamente em instantes.',
        503,
        'AI_PROVIDER_UNAVAILABLE'
      );
    }
    logAiUsage({
      feature: 'meeting_transcription',
      tenantId,
      latencyMs: Date.now() - started,
      provider: 'openai',
    });
    return String(result?.text ?? '');
  },

  /**
   * Analisa a transcrição via generateObject e devolve resumo + sugestões. O
   * `current` de cada campo é preenchido a partir do deal (o modelo não o conhece).
   */
  async analyzeTranscript(
    tenantId: string,
    dealId: string,
    transcript: string
  ): Promise<MeetingAnalysis> {
    this.assertAIEnabled();

    const providerConfig = resolveProviderConfig();
    const model = providerConfig
      ? getModel(providerConfig.provider, providerConfig.apiKey, providerConfig.model)
      : null;
    if (!model) {
      throw createError(
        'Recurso de IA não configurado. Configure um provedor de IA para usar reuniões.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }

    // Valores atuais do deal para o diff dos campos sugeridos.
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId, deletedAt: null },
      select: { value: true, stage: true, notes: true },
    });
    const currentByKey: Record<SuggestedFieldKey, string | null> = {
      value: deal?.value != null ? String(Number(deal.value)) : null,
      stage: deal?.stage ?? null,
      notes: deal?.notes ?? null,
    };

    const started = Date.now();
    let object: z.infer<typeof analysisSchema>;
    try {
      // generateObject dispara TS2589 sob node16 — chamamos sem tipar e o schema
      // Zod valida em runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (generateObject as any)({
        model,
        schema: analysisSchema,
        system: SYSTEM_PROMPT,
        prompt: `Transcrição da reunião:\n\n${transcript}`,
        temperature: 0.2,
      });
      object = result.object as z.infer<typeof analysisSchema>;
    } catch (err: unknown) {
      logger.warn('Falha na análise da reunião (IA).', err as Error);
      throw createError(
        'O serviço de IA está temporariamente indisponível. Tente novamente em instantes.',
        503,
        'AI_PROVIDER_UNAVAILABLE'
      );
    }
    logAiUsage({
      feature: 'meeting_analysis',
      tenantId,
      dealId,
      latencyMs: Date.now() - started,
      provider: providerConfig?.provider,
    });

    // Atribui ids estáveis às tarefas (usados no apply) e preenche o `current` dos campos.
    const suggestedTasks: SuggestedTask[] = object.suggestedTasks.map((t, i) => ({
      id: `t${i}`,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
    }));
    const suggestedFields: SuggestedField[] = object.suggestedFields.map((f) => ({
      key: f.key,
      current: currentByKey[f.key] ?? null,
      suggested: f.suggested,
      reason: f.reason,
    }));

    return { summary: object.summary, suggestedTasks, suggestedFields };
  },

  /**
   * Cria uma reunião no deal: (opcional) grava o áudio como Attachment(source=MEETING),
   * transcreve (se áudio), analisa e persiste a Interaction MEETING. Retorna o DTO.
   */
  async createMeeting(
    tenantId: string,
    dealId: string,
    input: {
      audio?: { buffer: Buffer; mimeType: string; filename: string } | null;
      transcript?: string | null;
      userId?: string;
    }
  ) {
    this.assertAIEnabled();

    let transcript = input.transcript?.trim() || '';

    if (input.audio) {
      // Transcreve primeiro (falha cedo se não houver Whisper). Só persistimos o áudio
      // DEPOIS de garantir que há transcrição E análise bem-sucedida — evita Attachment
      // órfão tanto num áudio mudo quanto numa falha de análise (#15).
      transcript = (
        await this.transcribeAudio(tenantId, input.audio.buffer, input.audio.mimeType)
      ).trim();
      if (!transcript) {
        throw createError(
          'Não foi possível transcrever o áudio (sem fala detectada).',
          422,
          'MEETING_TRANSCRIPTION_EMPTY'
        );
      }
    }

    if (!transcript) {
      throw createError(
        'Envie um áudio da reunião (campo "audio") ou cole a transcrição.',
        400,
        'MEETING_INPUT_REQUIRED'
      );
    }

    // Analisa ANTES de persistir o áudio: se a análise falhar, não deixamos um
    // Attachment(source=MEETING) órfão (#15).
    const analysis = await this.analyzeTranscript(tenantId, dealId, transcript);

    let audioAttachmentId: string | null = null;
    if (input.audio) {
      const attachment = await storageService.put(tenantId, {
        name: input.audio.filename || 'reuniao.audio',
        mimeType: input.audio.mimeType,
        buffer: input.audio.buffer,
        dealId,
        source: 'MEETING',
        uploadedById: input.userId ?? null,
      });
      audioAttachmentId = attachment.id;
    }

    const interaction = await prisma.interaction.create({
      data: {
        tenantId,
        dealId,
        type: InteractionType.MEETING,
        direction: InteractionDirection.OUTBOUND,
        subject: 'Reunião analisada por IA',
        content: analysis.summary,
        audioAttachmentId,
        userId: input.userId ?? null,
        metadata: {
          transcript,
          summary: analysis.summary,
          suggestedTasks: analysis.suggestedTasks,
          suggestedFields: analysis.suggestedFields,
          appliedAt: null,
          appliedById: null,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toDTO(interaction, dealId);
  },

  /** Lista as reuniões (Interaction MEETING) de um deal, mais recentes primeiro. */
  async listMeetings(tenantId: string, dealId: string) {
    const interactions = await prisma.interaction.findMany({
      where: { tenantId, dealId, type: InteractionType.MEETING, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return interactions.map((i) => this.toDTO(i, dealId));
  },

  /** Detalhe de uma reunião por id da Interaction (escopado por tenant). */
  async getMeeting(tenantId: string, interactionId: string) {
    const interaction = await prisma.interaction.findFirst({
      where: {
        id: interactionId,
        tenantId,
        type: InteractionType.MEETING,
        deletedAt: null,
      },
    });
    if (!interaction) {
      throw createError('Reunião não encontrada', 404, 'MEETING_NOT_FOUND');
    }
    return this.toDTO(interaction, interaction.dealId ?? '');
  },

  /**
   * Aplica as sugestões ACEITAS de uma reunião: cria só as Tasks marcadas (vinculadas
   * ao deal) e atualiza só os campos aceitos do deal (nunca silencioso). Marca
   * appliedAt/appliedBy no metadata. Coerção: value→number, stage→DealStage.
   */
  async applyMeeting(
    tenantId: string,
    dealId: string,
    interactionId: string,
    input: ApplyMeetingInput,
    userId?: string
  ) {
    const interaction = await prisma.interaction.findFirst({
      where: {
        id: interactionId,
        tenantId,
        dealId,
        type: InteractionType.MEETING,
        deletedAt: null,
      },
    });
    if (!interaction) {
      throw createError('Reunião não encontrada', 404, 'MEETING_NOT_FOUND');
    }

    const meta = (interaction.metadata as Record<string, unknown>) || {};

    // ── Idempotência: uma reunião já aplicada não pode ser reaplicada (#3/#9). ──
    // Sem esta guarda, uma chamada direta à API reaplicaria tudo — duplicando tarefas
    // e reanexando notas. Rejeita ANTES de qualquer efeito colateral.
    if (meta.appliedAt != null) {
      throw createError('Reunião já aplicada.', 409, 'MEETING_ALREADY_APPLIED');
    }

    const suggestedTasks = (meta.suggestedTasks as SuggestedTask[]) || [];
    const suggestedFields = (meta.suggestedFields as SuggestedField[]) || [];

    // ── Campos: valida/coage TODOS os fieldUpdates ANTES de criar qualquer tarefa (#4). ──
    // Se uma coerção falhar (ex.: stage=WON/LOST → 400), as tarefas NÃO podem já ter sido
    // criadas: um retry as duplicaria. Por isso a validação vem primeiro, e só depois
    // criamos tarefas / atualizamos o deal / marcamos appliedAt.
    const suggestedKeys = new Set(suggestedFields.map((f) => f.key));
    const updatedFields: SuggestedFieldKey[] = [];
    const dealUpdate: {
      id: string;
      value?: number;
      stage?: DealStage;
      notes?: string;
    } = { id: dealId };

    const fieldUpdates = input.fieldUpdates || {};
    if (fieldUpdates.value !== undefined && suggestedKeys.has('value')) {
      const num = Number(fieldUpdates.value);
      if (!Number.isFinite(num) || num < 0) {
        throw createError('Valor sugerido inválido para o campo "value".', 400, 'VALIDATION_ERROR');
      }
      dealUpdate.value = num;
      updatedFields.push('value');
    }
    if (fieldUpdates.stage !== undefined && suggestedKeys.has('stage')) {
      const stage = fieldUpdates.stage as DealStage;
      if (!Object.values(DealStage).includes(stage)) {
        throw createError('Etapa sugerida inválida para o campo "stage".', 400, 'VALIDATION_ERROR');
      }
      // LOST/WON têm fluxo próprio (markLost exige lostReason; markWon tem guarda de
      // transição). Aplicar esses estágios por aqui contornaria essas regras — rejeita.
      if (stage === DealStage.LOST || stage === DealStage.WON) {
        throw createError(
          'Etapa LOST/WON exige o fluxo próprio de ganho/perda; ajuste manualmente na negociação.',
          400,
          'MEETING_FIELD_NOT_APPLICABLE'
        );
      }
      dealUpdate.stage = stage;
      updatedFields.push('stage');
    }
    if (fieldUpdates.notes !== undefined && suggestedKeys.has('notes')) {
      // A IA devolve só o texto "a acrescentar" (não o conteúdo completo). ANEXA ao
      // valor atual do deal em vez de sobrescrever — evita apagar notas existentes.
      const currentDeal = await prisma.deal.findFirst({
        where: { id: dealId, tenantId },
        select: { notes: true },
      });
      const currentNotes = currentDeal?.notes ?? '';
      const suggested = fieldUpdates.notes;
      dealUpdate.notes = currentNotes ? `${currentNotes}\n\n${suggested}` : suggested;
      updatedFields.push('notes');
    }

    // ── Tarefas: só cria as sugeridas cujos ids foram aceitos (após a validação). ──
    const acceptedTaskIds = new Set(input.taskIds || []);
    const createdTaskIds: string[] = [];
    for (const st of suggestedTasks) {
      if (!acceptedTaskIds.has(st.id)) continue;
      const task = await taskService.create(tenantId, {
        title: st.title,
        description: st.description,
        dueDate: st.dueDate ? new Date(st.dueDate) : undefined,
        dealId,
      });
      createdTaskIds.push(task.id);
    }

    // Só chama o update se houver algum campo aceito (respeita as guardas de dealService).
    if (updatedFields.length > 0) {
      await dealService.update(tenantId, dealUpdate);
    }

    // Marca a reunião como aplicada (metadata), preservando o restante.
    const appliedAt = new Date().toISOString();
    await prisma.interaction.update({
      where: { id: interactionId },
      data: {
        metadata: {
          ...meta,
          appliedAt,
          appliedById: userId ?? null,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return { createdTaskIds, updatedFields };
  },

  /** Monta o DTO de reunião (Meeting) a partir de uma Interaction MEETING. */
  toDTO(
    interaction: {
      id: string;
      createdAt: Date;
      audioAttachmentId: string | null;
      metadata: unknown;
    },
    dealId: string
  ) {
    const meta = (interaction.metadata as Record<string, unknown>) || {};
    return {
      id: interaction.id,
      dealId,
      createdAt: interaction.createdAt.toISOString(),
      audioAttachmentId: interaction.audioAttachmentId,
      transcript: (meta.transcript as string) ?? '',
      summary: (meta.summary as string) ?? '',
      suggestedTasks: (meta.suggestedTasks as SuggestedTask[]) ?? [],
      suggestedFields: (meta.suggestedFields as SuggestedField[]) ?? [],
      appliedAt: (meta.appliedAt as string | null) ?? null,
      appliedById: (meta.appliedById as string | null) ?? null,
    };
  },
};
