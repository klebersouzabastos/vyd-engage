import { randomUUID } from 'crypto';
import prisma from '../config/database.js';
import { Prisma } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { emitToTenant } from './socketService.js';
import {
  normalizeQualificationConfig,
  resolveQualificationLevel,
} from './salesConfigService.js';

/**
 * Questionários de qualificação (Upgrade RD parity — P0).
 *
 * Perguntas vivem em Questionnaire.questions (Json):
 *   [{ id, text, type: 'SINGLE'|'MULTI'|'TEXT', options?: [{ label, points }] }]
 *
 * O score de uma resposta é a soma dos points das opções escolhidas (lookup
 * server-side por label — o cliente nunca envia pontos); TEXT não pontua.
 * Com settings.qualification.autoQualify=true e os 5 maxScore definidos, salvar
 * uma resposta qualifica o deal automaticamente (regra em salesConfigService).
 */

export type QuestionnaireQuestionType = 'SINGLE' | 'MULTI' | 'TEXT';

export interface QuestionnaireOption {
  label: string;
  points: number;
}

export interface QuestionnaireQuestion {
  id: string;
  text: string;
  type: QuestionnaireQuestionType;
  options?: QuestionnaireOption[];
}

export interface QuestionnaireInput {
  name: string;
  description?: string | null;
  active?: boolean;
  questions: Array<Omit<QuestionnaireQuestion, 'id'> & { id?: string }>;
}

export interface QuestionnaireAnswerInput {
  questionId: string;
  optionLabels?: string[];
  text?: string;
}

// Include do payload de socket 'deal:updated' — idêntico ao dealInclude do
// dealService para o front atualizar o cache sem distinguir a origem do evento.
const dealSocketInclude = {
  lead: { select: { id: true, name: true, email: true } },
  assignedUser: { select: { id: true, name: true, email: true } },
} as const;

/** Garante id em toda pergunta (o builder do front pode omitir em perguntas novas). */
function withQuestionIds(
  questions: QuestionnaireInput['questions']
): QuestionnaireQuestion[] {
  return questions.map((q) => ({
    id: q.id && q.id.trim() !== '' ? q.id : randomUUID(),
    text: q.text.trim(),
    type: q.type,
    // TEXT não pontua — opções são descartadas para não induzir score.
    options: q.type === 'TEXT' ? undefined : q.options,
  }));
}

/**
 * Valida as respostas contra as perguntas do questionário e calcula o score.
 * Regras: pergunta deve existir; SINGLE aceita no máximo 1 opção; opções devem
 * pertencer à pergunta; TEXT não pontua. Exportada para testes.
 */
export function scoreAnswers(
  questions: QuestionnaireQuestion[],
  answers: QuestionnaireAnswerInput[]
): number {
  const byId = new Map(questions.map((q) => [q.id, q]));
  let score = 0;

  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question) {
      throw createError(
        'Resposta para pergunta inexistente no questionário',
        400,
        'INVALID_QUESTION',
        { questionId: answer.questionId }
      );
    }

    if (question.type === 'TEXT') continue;

    const labels = [...new Set(answer.optionLabels ?? [])];
    if (question.type === 'SINGLE' && labels.length > 1) {
      throw createError(
        `A pergunta "${question.text}" aceita apenas uma opção`,
        400,
        'SINGLE_CHOICE_VIOLATION',
        { questionId: question.id }
      );
    }

    const optionsByLabel = new Map((question.options ?? []).map((o) => [o.label, o]));
    for (const label of labels) {
      const option = optionsByLabel.get(label);
      if (!option) {
        throw createError(
          `Opção inválida para a pergunta "${question.text}"`,
          400,
          'INVALID_OPTION',
          { questionId: question.id, optionLabel: label }
        );
      }
      score += option.points;
    }
  }

  return score;
}

/** Anexa { id, name } dos autores às respostas (QuestionnaireResponse.userId não tem relation). */
async function attachAuthors<T extends { userId: string | null }>(responses: T[]) {
  const userIds = [...new Set(responses.map((r) => r.userId).filter((id): id is string => !!id))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return responses.map((r) => ({ ...r, user: r.userId ? (byId.get(r.userId) ?? null) : null }));
}

export const questionnaireService = {
  async findAll(tenantId: string, includeInactive = false) {
    return prisma.questionnaire.findMany({
      where: { tenantId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(tenantId: string, data: QuestionnaireInput) {
    return prisma.questionnaire.create({
      data: {
        tenantId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        active: data.active ?? true,
        questions: withQuestionIds(data.questions) as unknown as Prisma.InputJsonValue,
      },
    });
  },

  async update(tenantId: string, id: string, data: Partial<QuestionnaireInput>) {
    const existing = await prisma.questionnaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw createError('Questionário não encontrado', 404, 'QUESTIONNAIRE_NOT_FOUND');
    }
    return prisma.questionnaire.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        description:
          data.description !== undefined ? data.description?.trim() || null : undefined,
        active: data.active,
        questions:
          data.questions !== undefined
            ? (withQuestionIds(data.questions) as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });
  },

  async delete(tenantId: string, id: string) {
    const existing = await prisma.questionnaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw createError('Questionário não encontrado', 404, 'QUESTIONNAIRE_NOT_FOUND');
    }
    // Cascade remove as respostas (histórico do questionário morre com ele).
    await prisma.questionnaire.delete({ where: { id } });
    return { deleted: true };
  },

  /**
   * Responde um questionário dentro de um deal: valida deal/questionário do
   * tenant, calcula o score, grava a resposta e — se a qualificação automática
   * estiver configurada — qualifica o deal e emite 'deal:updated'.
   * Retorna { response, dealQualification } (contrato fixado).
   */
  async respond(
    tenantId: string,
    questionnaireId: string,
    input: { dealId: string; answers: QuestionnaireAnswerInput[] },
    userId?: string
  ) {
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: questionnaireId, tenantId },
    });
    if (!questionnaire) {
      throw createError('Questionário não encontrado', 404, 'QUESTIONNAIRE_NOT_FOUND');
    }
    if (!questionnaire.active) {
      throw createError('Questionário inativo não pode ser respondido', 400, 'QUESTIONNAIRE_INACTIVE');
    }

    const deal = await prisma.deal.findFirst({
      where: { id: input.dealId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!deal) {
      throw createError('Negociação não encontrada', 404, 'DEAL_NOT_FOUND');
    }

    const questions = (questionnaire.questions as unknown as QuestionnaireQuestion[]) ?? [];
    const score = scoreAnswers(questions, input.answers);

    const created = await prisma.questionnaireResponse.create({
      data: {
        tenantId,
        questionnaireId,
        dealId: input.dealId,
        userId: userId ?? null,
        answers: input.answers as unknown as Prisma.InputJsonValue,
        score,
      },
    });

    // Qualificação automática (req 3): só age com toggle ligado E 5 maxScore
    // definidos; caso contrário dealQualification=null e o deal não muda.
    let dealQualification: number | null = null;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const qualification = normalizeQualificationConfig(
      ((tenant?.settings as Record<string, unknown> | null) ?? {}).qualification
    );
    const level = resolveQualificationLevel(qualification, score);
    if (level !== null) {
      const updatedDeal = await prisma.deal.update({
        where: { id: input.dealId },
        data: { qualification: level },
        include: dealSocketInclude,
      });
      dealQualification = level;
      emitToTenant(tenantId, 'deal:updated', { deal: updatedDeal });
    }

    const [response] = await attachAuthors([created]);
    return {
      response: {
        ...response,
        questionnaire: { id: questionnaire.id, name: questionnaire.name },
      },
      dealQualification,
    };
  },

  /** Histórico de respostas de um deal, com nome do questionário e autor. */
  async listResponses(tenantId: string, dealId: string) {
    const responses = await prisma.questionnaireResponse.findMany({
      where: { tenantId, dealId },
      include: { questionnaire: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return attachAuthors(responses);
  },
};
