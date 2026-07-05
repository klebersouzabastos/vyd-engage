/**
 * Tipos do contrato de API — Upgrade RD P3 (fundação, dono B1).
 *
 * Cobre: IA de reuniões (req 26), copiloto via WhatsApp (req 25) e resolução de
 * contato por telefone p/ a extensão Chrome (req 24). WhatsApp no deal/empresa
 * (req 23) reusa o payload de `sendWhatsAppMessage` estendido com dealId/companyId.
 *
 * GATING GRACIOSO: recursos de IA/WhatsApp só aparecem quando configurados
 * (aiProvider.isAIEnabled / conexão CONNECTED). Sem config → 503
 * AI_NOT_CONFIGURED / 400 WHATSAPP_NOT_CONFIGURED (nunca 500).
 */

// ── IA de reuniões (req 26) ─────────────────────────

/** Tarefa sugerida pela análise da reunião (checkbox na UI). */
export interface MeetingSuggestedTask {
  /** Índice estável usado no apply (`taskIds`). */
  id: string;
  title: string;
  description?: string;
  /** ISO date opcional. */
  dueDate?: string;
}

/** Chaves de campo do deal que a análise pode sugerir atualizar. */
export type MeetingSuggestedFieldKey = 'value' | 'stage' | 'notes';

/**
 * Sugestão de atualização de campo do deal (diff current × suggested). O apply é
 * NUNCA silencioso: o usuário escolhe quais aceitar; a coerção (value→number,
 * stage→DealStage) é feita no backend.
 */
export interface MeetingSuggestedField {
  key: MeetingSuggestedFieldKey;
  /** Valor atual no deal (string p/ exibição). */
  current: string | null;
  /** Valor proposto pela IA (string p/ exibição). */
  suggested: string | null;
  /** Justificativa curta em pt-BR. */
  reason?: string;
}

/** Análise da reunião persistida em Interaction.metadata (type MEETING). */
export interface MeetingAnalysis {
  summary: string;
  suggestedTasks: MeetingSuggestedTask[];
  suggestedFields: MeetingSuggestedField[];
}

/** Um item de reunião (Interaction MEETING) na timeline do deal. */
export interface Meeting {
  /** id da Interaction. */
  id: string;
  dealId: string;
  createdAt: string;
  /** id do Attachment do áudio (source=MEETING); null quando foi transcrição colada. */
  audioAttachmentId: string | null;
  transcript: string;
  summary: string;
  suggestedTasks: MeetingSuggestedTask[];
  suggestedFields: MeetingSuggestedField[];
  /** ISO timestamp de quando as sugestões foram aplicadas; null se ainda não. */
  appliedAt: string | null;
  appliedById: string | null;
}

/**
 * Corpo do apply (POST /deals/:id/meetings/:iid/apply): cria só as tarefas e
 * aplica só os campos ACEITOS pelo usuário.
 */
export interface ApplyMeetingInput {
  /** ids (MeetingSuggestedTask.id) das tarefas a criar. */
  taskIds: string[];
  /** subconjunto dos campos aceitos, por chave → valor bruto a aplicar. */
  fieldUpdates: Partial<Record<MeetingSuggestedFieldKey, string>>;
}

export interface ApplyMeetingResult {
  createdTaskIds: string[];
  updatedFields: MeetingSuggestedFieldKey[];
}

// ── Copiloto IA via WhatsApp (req 25) ───────────────

/** Config do copiloto de uma conexão WhatsApp (toggle isCopilot). */
export interface CopilotConfig {
  connectionId: string;
  isCopilot: boolean;
}

// ── Resolução de contato por telefone — extensão (req 24) ──

export interface ResolvedContactLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}

export interface ResolvedContactCompany {
  id: string;
  name: string;
  phone: string | null;
}

export interface ResolvedContactDeal {
  id: string;
  name: string;
  stage: string;
  status: string;
  value: string | number;
}

export interface ResolvedContactInteraction {
  id: string;
  type: string;
  direction: string;
  content: string;
  createdAt: string;
}

/** Resposta de GET /contacts/resolve?phone= (tenant do apiKey). */
export interface ResolvedContact {
  lead: ResolvedContactLead | null;
  company: ResolvedContactCompany | null;
  deals: ResolvedContactDeal[];
  lastInteractions: ResolvedContactInteraction[];
}
