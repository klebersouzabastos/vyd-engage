import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P0 (reqs 2 e 3): responder questionário dentro do deal
 * calcula o score (soma dos points das opções escolhidas; TEXT não pontua) e,
 * com a qualificação automática configurada (toggle + 5 maxScore), qualifica o
 * deal pela regra "menor level cujo maxScore >= score" (acima do maior → 5).
 *
 * Prisma mockado (padrão helpers/prismaMock) — sem banco.
 */
vi.mock('../../services/socketService.js', () => ({ emitToTenant: vi.fn() }));

import { emitToTenant } from '../../services/socketService.js';
import {
  questionnaireService,
  scoreAnswers,
  type QuestionnaireQuestion,
} from '../../services/questionnaireService.js';
import { respondSchema } from '../../routes/questionnaires.js';

const tenantId = 'tenant-1';
const dealId = '3f0e8a52-9c1d-4b7e-8f4a-2d6c1b0a9e77';
const questionnaireId = 'qq-1';

const questions: QuestionnaireQuestion[] = [
  {
    id: 'q1',
    text: 'Tem orçamento aprovado?',
    type: 'SINGLE',
    options: [
      { label: 'Sim', points: 10 },
      { label: 'Não', points: 0 },
    ],
  },
  {
    id: 'q2',
    text: 'Interesses',
    type: 'MULTI',
    options: [
      { label: 'Produto A', points: 5 },
      { label: 'Produto B', points: 3 },
    ],
  },
  { id: 'q3', text: 'Observações', type: 'TEXT' },
];

const answers = [
  { questionId: 'q1', optionLabels: ['Sim'] },
  { questionId: 'q2', optionLabels: ['Produto A', 'Produto B'] },
  { questionId: 'q3', text: 'Cliente pediu proposta ainda este mês' },
];

function qualificationSettings(maxScores: Array<number | null>, autoQualify: boolean) {
  return {
    qualification: {
      autoQualify,
      levels: maxScores.map((maxScore, i) => ({
        level: i + 1,
        name: `Nível ${i + 1}`,
        maxScore,
      })),
    },
  };
}

function mockRespondScenario(settings: Record<string, unknown>) {
  prismaMock.questionnaire.findFirst.mockResolvedValue({
    id: questionnaireId,
    tenantId,
    name: 'Qualificação padrão',
    active: true,
    questions,
  } as never);
  prismaMock.deal.findFirst.mockResolvedValue({ id: dealId } as never);
  prismaMock.questionnaireResponse.create.mockImplementation(
    (async (args: { data: Record<string, unknown> }) => ({
      id: 'resp-1',
      createdAt: new Date(),
      ...args.data,
    })) as never
  );
  prismaMock.tenant.findUnique.mockResolvedValue({ settings } as never);
  prismaMock.user.findMany.mockResolvedValue([{ id: 'user-1', name: 'Ana Vendedora' }] as never);
  prismaMock.deal.update.mockResolvedValue({ id: dealId, qualification: 2 } as never);
}

beforeEach(() => {
  vi.mocked(emitToTenant).mockClear();
});

describe('scoreAnswers — cálculo do score', () => {
  it('soma os points das opções escolhidas; TEXT não pontua', () => {
    expect(scoreAnswers(questions, answers)).toBe(18); // 10 + 5 + 3
  });

  it('resposta sem perguntas pontuadas → score 0 (caso extremo da spec)', () => {
    expect(scoreAnswers(questions, [{ questionId: 'q3', text: 'só observação' }])).toBe(0);
    expect(scoreAnswers(questions, [])).toBe(0);
  });

  it('rejeita opção que não pertence à pergunta', () => {
    expect(() =>
      scoreAnswers(questions, [{ questionId: 'q1', optionLabels: ['Talvez'] }])
    ).toThrowError(/Opção inválida/);
  });

  it('rejeita mais de uma opção em pergunta SINGLE', () => {
    expect(() =>
      scoreAnswers(questions, [{ questionId: 'q1', optionLabels: ['Sim', 'Não'] }])
    ).toThrowError(/apenas uma opção/);
  });

  it('rejeita resposta para pergunta inexistente', () => {
    expect(() => scoreAnswers(questions, [{ questionId: 'zzz' }])).toThrowError(
      /pergunta inexistente/
    );
  });
});

describe('respond — auto-qualificação LIGADA (toggle + 5 maxScore definidos)', () => {
  it('qualifica o deal no nível da faixa do score e emite deal:updated', async () => {
    mockRespondScenario(qualificationSettings([10, 20, 30, 40, 50], true));

    const result = await questionnaireService.respond(
      tenantId,
      questionnaireId,
      { dealId, answers },
      'user-1'
    );

    // score 18 → menor level com maxScore >= 18 é o nível 2 (maxScore 20).
    expect(result.response.score).toBe(18);
    expect(result.dealQualification).toBe(2);
    expect(prismaMock.deal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: dealId },
        data: { qualification: 2 },
      })
    );
    expect(emitToTenant).toHaveBeenCalledWith(tenantId, 'deal:updated', expect.anything());
    // Autor e questionário anexados à resposta (histórico do deal).
    expect(result.response.user).toEqual({ id: 'user-1', name: 'Ana Vendedora' });
    expect(result.response.questionnaire).toEqual({
      id: questionnaireId,
      name: 'Qualificação padrão',
    });
  });

  it('score acima do maior maxScore → nível 5', async () => {
    mockRespondScenario(qualificationSettings([1, 2, 3, 4, 5], true));
    prismaMock.deal.update.mockResolvedValue({ id: dealId, qualification: 5 } as never);

    const result = await questionnaireService.respond(tenantId, questionnaireId, {
      dealId,
      answers,
    });

    expect(result.dealQualification).toBe(5);
    expect(prismaMock.deal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { qualification: 5 } })
    );
  });
});

describe('respond — auto-qualificação DESLIGADA ou incompleta', () => {
  it('toggle desligado: grava a resposta mas NÃO altera a qualificação do deal', async () => {
    mockRespondScenario(qualificationSettings([10, 20, 30, 40, 50], false));

    const result = await questionnaireService.respond(tenantId, questionnaireId, {
      dealId,
      answers,
    });

    expect(result.response.score).toBe(18);
    expect(result.dealQualification).toBeNull();
    expect(prismaMock.deal.update).not.toHaveBeenCalled();
    expect(emitToTenant).not.toHaveBeenCalled();
  });

  it('toggle ligado mas maxScore incompleto: não qualifica (faixas indefinidas)', async () => {
    mockRespondScenario(qualificationSettings([10, null, 30, 40, 50], true));

    const result = await questionnaireService.respond(tenantId, questionnaireId, {
      dealId,
      answers,
    });

    expect(result.dealQualification).toBeNull();
    expect(prismaMock.deal.update).not.toHaveBeenCalled();
  });
});

describe('respond — guardas de tenant e estado', () => {
  it('questionário inativo → 400 QUESTIONNAIRE_INACTIVE (nada é gravado)', async () => {
    prismaMock.questionnaire.findFirst.mockResolvedValue({
      id: questionnaireId,
      tenantId,
      active: false,
      questions,
    } as never);

    await expect(
      questionnaireService.respond(tenantId, questionnaireId, { dealId, answers })
    ).rejects.toMatchObject({ statusCode: 400, code: 'QUESTIONNAIRE_INACTIVE' });
    expect(prismaMock.questionnaireResponse.create).not.toHaveBeenCalled();
  });

  it('deal inexistente no tenant → 404 DEAL_NOT_FOUND', async () => {
    prismaMock.questionnaire.findFirst.mockResolvedValue({
      id: questionnaireId,
      tenantId,
      active: true,
      questions,
    } as never);
    prismaMock.deal.findFirst.mockResolvedValue(null as never);

    await expect(
      questionnaireService.respond(tenantId, questionnaireId, { dealId, answers })
    ).rejects.toMatchObject({ statusCode: 404, code: 'DEAL_NOT_FOUND' });
    expect(prismaMock.questionnaireResponse.create).not.toHaveBeenCalled();
  });
});

describe('POST /questionnaires/:id/responses — validação do payload (respondSchema)', () => {
  it('rejeita dealId que não é uuid e aceita payload válido', () => {
    expect(respondSchema.safeParse({ dealId: 'abc', answers: [] }).success).toBe(false);
    expect(respondSchema.safeParse({ dealId, answers }).success).toBe(true);
  });
});
