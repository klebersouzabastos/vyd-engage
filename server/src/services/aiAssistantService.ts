import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';
import { DealStage, LeadStatus, TaskStatus } from '@prisma/client';
import { generateText, streamText } from 'ai';
import {
  getActiveModel,
  isAIEnabled,
  logAiUsage,
  aiUnavailableError,
  resolveProviderConfig,
} from './aiProvider.js';

/**
 * AI Sales Assistant — lead summary (AI-1.1) and contextual chat (AI-2.2).
 *
 * Both ground their output in the lead's REAL data: last 10 interactions,
 * active deals, pending tasks and current score. No invented information.
 */

const MAX_INTERACTIONS = 10; // spec: only the 10 most recent interactions
const MAX_CHAT_HISTORY = 20; // truncate session history to bound payload (edge case)

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface LeadContext {
  lead: {
    name: string;
    email: string | null;
    company: string | null;
    phone: string | null;
    status: LeadStatus;
    score: number;
    createdAt: Date;
  };
  interactions: { createdAt: Date; type: string; direction: string; subject: string | null; content: string }[];
  deals: { name: string; value: unknown; stage: DealStage; probability: number; expectedCloseDate: Date | null }[];
  pendingTasks: { title: string; dueDate: Date | null }[];
}

/** Aggregate the lead's real data used to ground both summary and chat. */
async function buildLeadContext(tenantId: string, leadId: string): Promise<LeadContext | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId },
    select: {
      name: true,
      email: true,
      company: true,
      phone: true,
      status: true,
      score: true,
      createdAt: true,
    },
  });
  if (!lead) return null;

  const [interactions, deals, pendingTasks] = await Promise.all([
    prisma.interaction.findMany({
      where: { leadId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: MAX_INTERACTIONS,
      select: { createdAt: true, type: true, direction: true, subject: true, content: true },
    }),
    prisma.deal.findMany({
      where: { leadId, tenantId, deletedAt: null, stage: { notIn: [DealStage.WON, DealStage.LOST] } },
      orderBy: { updatedAt: 'desc' },
      select: { name: true, value: true, stage: true, probability: true, expectedCloseDate: true },
    }),
    prisma.task.findMany({
      where: {
        leadId,
        tenantId,
        deletedAt: null,
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: { title: true, dueDate: true },
    }),
  ]);

  return { lead, interactions, deals, pendingTasks };
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return 'sem data';
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Derive a grounded engagement-trend signal from the lead's real interactions:
 * count interactions in the last 7 days vs the prior 7–14 day window. Used so the
 * summary can state a score "tendência" without inventing data (spec req 3).
 */
function renderTrendFact(interactions: LeadContext['interactions']): string {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  let last7 = 0;
  let prev7 = 0;
  for (const i of interactions) {
    const ageMs = now - new Date(i.createdAt).getTime();
    if (ageMs < 7 * DAY) last7 += 1;
    else if (ageMs < 14 * DAY) prev7 += 1;
  }
  const delta = last7 - prev7;
  let label: string;
  if (delta > 0) label = 'engajamento subindo';
  else if (delta < 0) label = 'engajamento caindo';
  else label = 'engajamento estável';
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  return `Tendência: ${label} (${last7} interações nos últimos 7 dias vs ${prev7} no período anterior, ${sign} vs período anterior)`;
}

function fmtBRL(value: unknown): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

/** Render the aggregated context into a compact, grounded text block. */
function renderContextFacts(ctx: LeadContext): string {
  const { lead, interactions, deals, pendingTasks } = ctx;
  const parts: string[] = [];

  parts.push(`Lead: ${lead.name}${lead.company ? ` (${lead.company})` : ''}`);
  if (lead.email) parts.push(`Email: ${lead.email}`);
  if (lead.phone) parts.push(`Telefone: ${lead.phone}`);
  parts.push(`Status atual: ${lead.status}`);
  parts.push(`Score atual: ${lead.score}`);
  parts.push(renderTrendFact(interactions));

  if (interactions.length > 0) {
    parts.push('\nÚltimas interações (mais recentes primeiro):');
    for (const i of interactions) {
      parts.push(
        `- ${fmtDate(i.createdAt)} [${i.type}/${i.direction}]${i.subject ? ` ${i.subject}:` : ':'} ${i.content.slice(0, 200)}`
      );
    }
  } else {
    parts.push('\nNenhuma interação registrada para este lead.');
  }

  if (deals.length > 0) {
    parts.push('\nDeals abertos:');
    for (const d of deals) {
      parts.push(
        `- ${d.name}: ${fmtBRL(d.value)}, estágio ${d.stage}, probabilidade ${d.probability}%, fechamento previsto ${fmtDate(d.expectedCloseDate)}`
      );
    }
  } else {
    parts.push('\nNenhum deal aberto.');
  }

  if (pendingTasks.length > 0) {
    parts.push('\nTarefas pendentes:');
    for (const t of pendingTasks) {
      parts.push(`- ${t.title} (vencimento: ${fmtDate(t.dueDate)})`);
    }
  } else {
    parts.push('\nNenhuma tarefa pendente.');
  }

  return parts.join('\n');
}

// ========================
// AI-1.1 — Lead Summary
// ========================

const SUMMARY_SYSTEM_PROMPT = `Você é um assistente de vendas que resume o contexto de um lead em português brasileiro, de forma objetiva, para que o vendedor retome o contexto em segundos.
Estruture o resumo cobrindo, quando houver dados: a última interação (data e descrição), a situação dos deals abertos, a próxima tarefa pendente, e o score atual com a tendência.
Regras:
- Use SOMENTE os dados fornecidos. Nunca invente informações.
- Se não houver histórico, diga claramente que o lead ainda não tem histórico registrado.
- Seja conciso (no máximo ~120 palavras). Responda apenas com o resumo.`;

export interface AISummaryResult {
  summary: string;
  aiGenerated: boolean;
  score: number;
  generatedAt: string;
}

export const aiAssistantService = {
  /**
   * Generate the contextual lead summary (spec req 8).
   * Handles a lead with no history (returns text, not an error — edge case).
   * Throws a 503 only when the AI provider is configured but failing.
   */
  async generateLeadSummary(tenantId: string, leadId: string): Promise<AISummaryResult> {
    const ctx = await buildLeadContext(tenantId, leadId);
    if (!ctx) {
      // Lead not found is a 404-style condition handled by the route via null check.
      throw Object.assign(new Error('Lead não encontrado'), { statusCode: 404, isOperational: true });
    }

    const facts = renderContextFacts(ctx);

    const model = getActiveModel();
    if (!model) {
      // AI disabled: deterministic fallback so a summary still renders if reached.
      return {
        summary: facts,
        aiGenerated: false,
        score: ctx.lead.score,
        generatedAt: new Date().toISOString(),
      };
    }

    try {
      const startedAt = Date.now();
      const result = await generateText({
        model,
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: facts,
        temperature: 0.5,
        maxOutputTokens: 400,
      });

      logAiUsage({
        feature: 'lead-summary',
        tenantId,
        leadId,
        latencyMs: Date.now() - startedAt,
        tokens: result.usage?.totalTokens,
        promptTokens: result.usage?.inputTokens,
        completionTokens: result.usage?.outputTokens,
        provider: resolveProviderConfig()?.provider,
      });

      return {
        summary: result.text?.trim() || facts,
        aiGenerated: true,
        score: ctx.lead.score,
        generatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.warn('Lead summary AI generation failed', { leadId, error: error?.message });
      throw aiUnavailableError();
    }
  },

  // ========================
  // AI-2.2 — Contextual Chat (streaming)
  // ========================

  /**
   * Stream a chat answer grounded in the lead's real data (spec req 30).
   * Returns the Vercel AI SDK streamText result so the route can pipe tokens.
   * Throws 404 if the lead is missing, 503 if AI is not configured.
   */
  async streamLeadChat(
    tenantId: string,
    leadId: string,
    message: string,
    history: ChatMessage[]
  ) {
    if (!isAIEnabled()) throw aiUnavailableError();

    const ctx = await buildLeadContext(tenantId, leadId);
    if (!ctx) {
      throw Object.assign(new Error('Lead não encontrado'), { statusCode: 404, isOperational: true });
    }

    const model = getActiveModel();
    if (!model) throw aiUnavailableError();

    const facts = renderContextFacts(ctx);

    const systemPrompt = `Você é um assistente de vendas que responde perguntas sobre UM lead específico em português brasileiro.
Use SOMENTE os dados reais do lead abaixo. Nunca invente informações; se a resposta não estiver nos dados, diga que não há registro.
Sempre que possível, referencie dados concretos (datas, canais, anotações, valores).

DADOS DO LEAD:
${facts}`;

    // Truncate session history to bound the payload (edge case: long sessions).
    const trimmed = history.slice(-MAX_CHAT_HISTORY).map((m) => ({
      role: m.role,
      content: String(m.content || '').slice(0, 2000),
    }));

    const messages = [...trimmed, { role: 'user' as const, content: message }];

    const startedAt = Date.now();
    // streamText's generic inference (model + messages) can trigger TS2589 under
    // moduleResolution:node — call untyped, runtime behavior unchanged.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (streamText as any)({
      model,
      system: systemPrompt,
      messages,
      temperature: 0.4,
      maxOutputTokens: 700,
      // Log metadata only (tokens, latency, lead_id) — never the content (reqs 34, 36).
      onFinish: (event: { usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number } }) => {
        logAiUsage({
          feature: 'lead-chat',
          tenantId,
          leadId,
          latencyMs: Date.now() - startedAt,
          tokens: event.usage?.totalTokens,
          promptTokens: event.usage?.inputTokens,
          completionTokens: event.usage?.outputTokens,
          provider: resolveProviderConfig()?.provider,
        });
      },
    });

    return result;
  },
};
