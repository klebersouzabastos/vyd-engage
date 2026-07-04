// Upgrade RD parity — P0 (contrato de API fixado em specs/upgrade-rd-parity.md).
// Tipos consumidos por src/services/api/client.ts e pelas telas de
// Configurações de vendas / Questionários / Multi-vendas.

// ── Qualificação de negociação ──────────────────────

export interface QualificationLevel {
  /** Nível 1–5 (estrelas). */
  level: number;
  /** Nome editável (padrão: Muito frio, Frio, Morno, Quente, Muito quente). */
  name: string;
  /** Pontuação máxima do nível (null = não definida; auto-qualify exige as 5). */
  maxScore: number | null;
}

export interface QualificationConfig {
  /** Sempre 5 níveis, ordenados por `level`. */
  levels: QualificationLevel[];
  /** Toggle "qualificação automática via questionários". */
  autoQualifyEnabled: boolean;
}

// ── Flags do tenant (Tenant.settings) ───────────────

export interface SalesFlags {
  /** Multi-vendas: oferecer agendamento de próxima negociação ao ganhar/perder. */
  multiSalesEnabled: boolean;
  /** Comemoração de venda ao marcar GANHO. */
  celebrationEnabled: boolean;
}

// ── Segmentos de empresas ───────────────────────────

export interface CompanySegment {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Informações pré-definidas (presets) ─────────────

export type PresetEntity = 'COMPANY' | 'CONTACT' | 'DEAL';

export interface FieldPreset {
  id: string;
  entity: PresetEntity;
  /** Campo padrão da entidade (ex.: COMPANY: 'industry'; CONTACT: 'position'). */
  field: string;
  /** Valores oferecidos como seleção nos formulários. */
  options: string[];
  /** Permite digitar valor fora da lista. */
  allowCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FieldPresetInput {
  entity: PresetEntity;
  field: string;
  options: string[];
  allowCustom?: boolean;
}

// ── Gatilhos gerenciais ─────────────────────────────

export type TriggerConditionType =
  | 'NO_INTERACTION'
  | 'STUCK_IN_STAGE'
  | 'DEAL_LOST'
  | 'BIG_SALE';

/**
 * Configuração da condição, por tipo:
 * - NO_INTERACTION: { days?, funnelColumnId?, useCoolingDays? }
 * - STUCK_IN_STAGE: { days, funnelColumnId? }
 * - DEAL_LOST: {}
 * - BIG_SALE: { minValue }
 */
export interface TriggerConditionConfig {
  days?: number;
  funnelColumnId?: string;
  useCoolingDays?: boolean;
  minValue?: number;
}

export interface ManagerTrigger {
  id: string;
  name: string;
  conditionType: TriggerConditionType;
  conditionConfig: TriggerConditionConfig;
  notifyOwner: boolean;
  notifyManagers: boolean;
  notifyUserIds: string[];
  emailEnabled: boolean;
  active: boolean;
  /** Gatilho padrão "Negociações esfriando" — não deletável (DELETE → 400). */
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerTriggerInput {
  name: string;
  conditionType: TriggerConditionType;
  conditionConfig: TriggerConditionConfig;
  notifyOwner?: boolean;
  notifyManagers?: boolean;
  notifyUserIds?: string[];
  emailEnabled?: boolean;
  active?: boolean;
}

// ── Questionários ───────────────────────────────────

export type QuestionnaireQuestionType = 'SINGLE' | 'MULTI' | 'TEXT';

export interface QuestionnaireOption {
  label: string;
  points: number;
}

export interface QuestionnaireQuestion {
  id: string;
  text: string;
  type: QuestionnaireQuestionType;
  /** Somente para SINGLE/MULTI; TEXT não pontua. */
  options?: QuestionnaireOption[];
}

export interface Questionnaire {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  questions: QuestionnaireQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionnaireInput {
  name: string;
  description?: string | null;
  active?: boolean;
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireAnswerInput {
  questionId: string;
  /** Rótulos escolhidos (SINGLE: 1 item; MULTI: n itens). */
  optionLabels?: string[];
  /** Resposta aberta (TEXT). */
  text?: string;
}

export interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  dealId: string;
  userId: string | null;
  answers: QuestionnaireAnswerInput[];
  score: number;
  createdAt: string;
  questionnaire?: { id: string; name: string };
  user?: { id: string; name: string } | null;
}

export interface RespondQuestionnaireResult {
  response: QuestionnaireResponse;
  /** Qualificação aplicada ao deal (1–5) ou null se auto-qualify não agiu. */
  dealQualification: number | null;
}

// ── Multi-vendas (negociações agendadas) ────────────

export type ScheduledDealType =
  | 'POS_VENDA'
  | 'CROSS_SELL'
  | 'UPSELL'
  | 'RECOMPRA'
  | 'RELACIONAMENTO'
  | 'OUTRO';

export type ScheduledDealStatus = 'PENDING' | 'CREATED' | 'CANCELLED';

export interface ScheduledDeal {
  id: string;
  originDealId: string;
  companyId: string | null;
  leadId: string | null;
  type: ScheduledDealType;
  scheduledFor: string;
  funnelId: string | null;
  funnelColumnId: string | null;
  estimatedValue: number | string | null;
  assignedTo: string | null;
  notes: string | null;
  status: ScheduledDealStatus;
  createdDealId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUser?: { id: string; name: string } | null;
  company?: { id: string; name: string } | null;
  lead?: { id: string; name: string } | null;
}

export interface CreateScheduledDealInput {
  originDealId: string;
  type: ScheduledDealType;
  /** ISO 8601 — data em que o job cria a negociação. */
  scheduledFor: string;
  funnelId?: string;
  funnelColumnId?: string;
  estimatedValue?: number;
  assignedTo?: string;
  notes?: string;
}

// ── E-mail 1:1 no deal ──────────────────────────────

export interface SendDealEmailInput {
  /** Modelo de e-mail (EmailTemplate) — opcional se subject/html forem enviados. */
  templateId?: string;
  subject?: string;
  html?: string;
  /** Destinatário (lead/contato) — padrão: contato principal do deal. */
  leadId?: string;
}

export interface SendDealEmailResult {
  sent: boolean;
  interactionId?: string;
}

// ── Comemoração de venda ────────────────────────────

export interface CelebrationStats {
  /** Vendas GANHAS do usuário no mês corrente. */
  monthWonCount: number;
  /** Valor total das vendas ganhas no mês corrente. */
  monthWonValue: number;
}

// ── Negociações sem tarefa ──────────────────────────

export interface DealWithoutTasks {
  id: string;
  name: string;
  value: number | string;
  funnelColumnId: string | null;
  funnelColumn?: { id: string; title: string } | null;
  company?: { id: string; name: string } | null;
  lead?: { id: string; name: string } | null;
  updatedAt: string;
}
