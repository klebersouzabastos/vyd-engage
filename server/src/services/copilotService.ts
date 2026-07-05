import { z } from 'zod';
import { generateText, tool, stepCountIs, type ToolSet } from 'ai';
import { InteractionType, InteractionDirection, TaskStatus, DealStage, type Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';
import { getActiveModel, resolveProviderConfig, isAIEnabled, logAiUsage } from './aiProvider.js';
import { permissionService, type PermissionUser } from './permissionService.js';
import { whatsappMessagingService } from './whatsappMessagingService.js';

/**
 * copilotService — Copiloto IA via WhatsApp (Upgrade RD P3, req 25).
 *
 * PRINCÍPIOS DE SEGURANÇA (inegociáveis):
 *  - GATING GRACIOSO: só roteia quando `isAIEnabled()` E a conexão é `isCopilot`.
 *    Sem IA → apenas loga (nunca 500); o webhook segue seu fluxo normal de log.
 *  - AUTORIZAÇÃO POR NÚMERO: só um `User.whatsappNumber` conhecido do tenant pode
 *    comandar. Remetente desconhecido → responde "número não autorizado" e ignora
 *    (não executa nada, não vaza dados).
 *  - ESCOPO POR USUÁRIO: as tools de LEITURA filtram por `tenantId` + o
 *    `visibilityScope` efetivo do usuário (P1). O copiloto nunca vê além do que o
 *    próprio usuário veria na UI.
 *  - ESCRITA COM ACEITE: as tools de ESCRITA (criar tarefa / atualizar deal) NÃO
 *    executam direto — o copiloto PROPÕE a ação e guarda um estado pendente
 *    (Interaction.metadata do thread). Só executa após a próxima mensagem de
 *    confirmação explícita ("sim"/"confirmar"). NUNCA exclui nada.
 *  - LOG DE TOOL CALLS: toda tool chamada é logada (userId + entidade).
 *
 * O estado de confirmação pendente vive em `Interaction.metadata.copilotPending`
 * (WHATSAPP INBOUND, userId do comandante) — sem tabela nova (design fixado).
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Conexão mínima aceita (subset de WhatsAppConnection) para responder pelo copiloto. */
export interface CopilotConnection {
  id: string;
  tenantId: string;
  isCopilot: boolean;
}

/** Ação de escrita proposta, aguardando confirmação do usuário. */
interface PendingAction {
  kind: 'criar_tarefa' | 'atualizar_deal';
  args: Record<string, unknown>;
  /** Resumo em pt-BR mostrado ao usuário para o aceite. */
  summary: string;
}

/** Resultado do handler — texto respondido (ou null quando ignorado sem resposta). */
export interface CopilotResult {
  handled: boolean;
  reply: string | null;
  /** Para observabilidade/testes: nomes das tools de leitura acionadas nesta volta. */
  toolsUsed: string[];
  /** Ação de escrita proposta e persistida como pendente (se houver). */
  pending?: PendingAction | null;
}

/**
 * `tool()` com o tipo de saída ERASADO. O AI SDK infere `Tool<INPUT, OUTPUT>` a partir
 * do `inputSchema` (Zod) e do retorno do `execute`; como aqui o `execute` devolve
 * resultados do Prisma (tipos enormes), a combinação `tool()` + `ToolSet` + `generateText`
 * dispara instanciação de tipo recursiva (instantiateType_DepthLimit) que estoura a memória
 * do tsc. Fixando o retorno em `ToolSet[string]` mantemos a tipagem ÚTIL (o input via
 * `z.infer`) sem inflar o grafo de tipos. Comportamento em runtime: idêntico a `tool()`.
 */
type CopilotTool = ToolSet[string];
const defineTool = tool as unknown as <I extends z.ZodTypeAny>(def: {
  description: string;
  inputSchema: I;
  execute: (input: z.infer<I>) => Promise<unknown>;
}) => CopilotTool;

// ── Confirmação ──────────────────────────────────────────────────────────────

const CONFIRM_WORDS = new Set(['sim', 'confirmar', 'confirmo', 'ok', 'pode', 'isso', 'confirma']);
const CANCEL_WORDS = new Set(['não', 'nao', 'cancelar', 'cancela', 'para', 'esquece']);

function normalizeWord(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!,;]+$/g, '');
}

function isConfirmation(text: string): boolean {
  return CONFIRM_WORDS.has(normalizeWord(text));
}

function isCancellation(text: string): boolean {
  return CANCEL_WORDS.has(normalizeWord(text));
}

// ── Resolução do remetente → usuário comandante ──────────────────────────────

/** Mantém apenas dígitos de um telefone. */
function digitsOnly(raw: string): string {
  return (raw || '').replace(/\D+/g, '');
}

/**
 * Resolve o número do remetente para um `User` do tenant com `whatsappNumber`
 * cadastrado, casando pelos últimos 8 dígitos (tolera DDI/máscara). Só usuários
 * ATIVOS comandam. Retorna null se nenhum número conhecido casar.
 */
async function resolveCommandingUser(tenantId: string, from: string) {
  const suffix = digitsOnly(from).slice(-8);
  if (suffix.length < 6) return null;

  const candidates = await prisma.user.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      whatsappNumber: { not: null },
    },
    select: {
      id: true,
      name: true,
      role: true,
      teamId: true,
      permissionProfileId: true,
      whatsappNumber: true,
    },
  });

  return (
    candidates.find((u) => digitsOnly(u.whatsappNumber || '').endsWith(suffix)) || null
  );
}

// ── Estado pendente (Interaction.metadata) ───────────────────────────────────

/**
 * Busca a última ação de escrita pendente do usuário nesta conexão de copiloto
 * (dentro de uma janela de 30 min, para não ressuscitar propostas antigas).
 */
async function findPendingAction(
  tenantId: string,
  connectionId: string,
  userId: string
): Promise<{ interactionId: string; action: PendingAction } | null> {
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const rows = await prisma.interaction.findMany({
    where: {
      tenantId,
      userId,
      type: InteractionType.WHATSAPP,
      direction: InteractionDirection.INBOUND,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, metadata: true },
  });

  for (const row of rows) {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const pending = meta.copilotPending as
      | (PendingAction & { connectionId?: string; resolved?: boolean })
      | undefined;
    if (pending && pending.connectionId === connectionId && pending.resolved !== true) {
      return { interactionId: row.id, action: pending };
    }
  }
  return null;
}

/** Marca uma proposta pendente como resolvida (aceita ou cancelada) para não reexecutar. */
async function resolvePending(interactionId: string): Promise<void> {
  const row = await prisma.interaction.findUnique({
    where: { id: interactionId },
    select: { metadata: true },
  });
  const meta = (row?.metadata || {}) as Record<string, unknown>;
  const pending = (meta.copilotPending || {}) as Record<string, unknown>;
  await prisma.interaction.update({
    where: { id: interactionId },
    data: { metadata: { ...meta, copilotPending: { ...pending, resolved: true } } },
  });
}

/**
 * Persiste a mensagem INBOUND do comandante como Interaction WHATSAPP, opcionalmente
 * carregando a ação de escrita pendente em `metadata.copilotPending`.
 */
async function recordInbound(
  tenantId: string,
  connectionId: string,
  userId: string,
  from: string,
  text: string,
  pending?: PendingAction | null
) {
  const metadata: Record<string, unknown> = {
    from,
    connectionId,
    copilot: true,
  };
  if (pending) {
    metadata.copilotPending = { ...pending, connectionId, resolved: false };
  }
  return prisma.interaction.create({
    data: {
      tenantId,
      userId,
      type: InteractionType.WHATSAPP,
      direction: InteractionDirection.INBOUND,
      content: text,
      metadata: metadata as unknown as Prisma.InputJsonValue,
    },
  });
}

// ── Execução das ações de escrita (após aceite) ──────────────────────────────

async function executePending(
  tenantId: string,
  user: { id: string },
  action: PendingAction
): Promise<string> {
  const { taskService } = await import('./taskService.js');
  const { dealService } = await import('./dealService.js');

  if (action.kind === 'criar_tarefa') {
    const args = action.args as { title: string; description?: string; dueDate?: string };
    const task = await taskService.create(tenantId, {
      title: args.title,
      description: args.description,
      assignedTo: user.id,
      status: TaskStatus.PENDING,
      dueDate: args.dueDate,
    });
    logger.info('Copilot tool executed', {
      tool: 'criar_tarefa',
      userId: user.id,
      tenantId,
      entity: 'task',
      entityId: task.id,
    });
    return `Tarefa "${task.title}" criada.`;
  }

  // atualizar_deal
  const args = action.args as { dealId: string; stage?: string; value?: number; notes?: string };
  const updated = await dealService.update(tenantId, {
    id: args.dealId,
    ...(args.stage ? { stage: args.stage as DealStage } : {}),
    ...(typeof args.value === 'number' ? { value: args.value } : {}),
    ...(args.notes ? { notes: args.notes } : {}),
  });
  logger.info('Copilot tool executed', {
    tool: 'atualizar_deal',
    userId: user.id,
    tenantId,
    entity: 'deal',
    entityId: args.dealId,
  });
  return `Negociação "${updated.name}" atualizada.`;
}

// ── Handler principal ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o copiloto comercial da VYD Engage, operando por WhatsApp em português do Brasil.
Responda de forma curta e objetiva. Use as ferramentas de LEITURA para consultar dados reais do CRM
(tarefas, negociações, contatos) antes de responder — nunca invente dados.
Para AÇÕES DE ESCRITA (criar tarefa, atualizar negociação), use a ferramenta correspondente para PROPOR
a ação; ela não executa direto. O sistema pedirá a confirmação do usuário. Nunca proponha excluir nada.
Se o usuário não pediu nada acionável, apenas responda com o que sabe.`;

export const copilotService = {
  /**
   * Roteia uma mensagem recebida ao copiloto. Só deve ser chamado quando a conexão
   * é `isCopilot`. Aplica o gating de IA, autoriza o remetente, executa a
   * confirmação pendente ou dispara o modelo com tools.
   *
   * @param tenantId   tenant da conexão
   * @param connection conexão do copiloto (id + isCopilot)
   * @param from       telefone do remetente (com DDI)
   * @param text       corpo textual da mensagem
   */
  async handleCopilotMessage(
    tenantId: string,
    connection: CopilotConnection,
    from: string,
    text: string
  ): Promise<CopilotResult> {
    // Gating: sem IA configurada → não roteia (apenas loga). Nunca 500.
    if (!isAIEnabled()) {
      logger.info('Copilot: IA não configurada — mensagem não roteada', { tenantId });
      return { handled: false, reply: null, toolsUsed: [] };
    }

    const body = (text || '').trim();
    if (!body) {
      return { handled: false, reply: null, toolsUsed: [] };
    }

    // Autorização: só números conhecidos comandam.
    const user = await resolveCommandingUser(tenantId, from);
    if (!user) {
      const reply = 'Número não autorizado. Peça a um administrador para cadastrar seu WhatsApp no VYD Engage.';
      await this.reply(tenantId, connection.id, from, reply).catch(() => {});
      logger.warn('Copilot: remetente desconhecido — ignorado', { tenantId, from: digitsOnly(from).slice(-4) });
      return { handled: false, reply, toolsUsed: [] };
    }

    const permUser: PermissionUser = {
      userId: user.id,
      tenantId,
      role: user.role,
      teamId: user.teamId,
      permissionProfileId: user.permissionProfileId,
    };

    // ── Fluxo de confirmação: se há proposta pendente e o texto é "sim"/"não" ──
    const pendingHit = await findPendingAction(tenantId, connection.id, user.id);
    if (pendingHit) {
      if (isConfirmation(body)) {
        await resolvePending(pendingHit.interactionId);
        await recordInbound(tenantId, connection.id, user.id, from, body);
        let reply: string;
        try {
          reply = await executePending(tenantId, user, pendingHit.action);
        } catch (err: unknown) {
          logger.error('Copilot: falha ao executar ação confirmada', {
            tenantId,
            userId: user.id,
            err: err instanceof Error ? err.message : String(err),
          });
          reply = 'Não consegui concluir a ação agora. Tente novamente em instantes.';
        }
        await this.reply(tenantId, connection.id, from, reply).catch(() => {});
        return { handled: true, reply, toolsUsed: [] };
      }
      if (isCancellation(body)) {
        await resolvePending(pendingHit.interactionId);
        await recordInbound(tenantId, connection.id, user.id, from, body);
        const reply = 'Ok, cancelei a ação.';
        await this.reply(tenantId, connection.id, from, reply).catch(() => {});
        return { handled: true, reply, toolsUsed: [] };
      }
      // Qualquer outra mensagem: expira a proposta e segue como nova consulta.
      await resolvePending(pendingHit.interactionId);
    }

    // ── Volta normal: dispara o modelo com tools ───────────────────────────────
    const model = getActiveModel();
    if (!model) {
      logger.info('Copilot: modelo indisponível apesar de IA habilitada', { tenantId });
      return { handled: false, reply: null, toolsUsed: [] };
    }

    const toolsUsed: string[] = [];
    let proposal: PendingAction | null = null;

    const tools = this.buildTools(tenantId, permUser, {
      onRead: (name) => toolsUsed.push(name),
      onPropose: (p) => {
        proposal = p;
      },
    });

    let replyText = '';
    try {
      const startedAt = Date.now();
      // O genérico de `generateText` sobre um `ToolSet` dispara instanciação de tipo
      // recursiva (instantiateType_DepthLimit) que estoura a memória do tsc — o mesmo
      // motivo pelo qual `meetingService` chama `generateObject` sem tipar. Invocamos
      // por uma assinatura enxuta: o comportamento em runtime é idêntico e o schema de
      // cada tool continua tipado dentro de `tool()`.
      const runGenerateText = generateText as unknown as (
        opts: Record<string, unknown>
      ) => Promise<{
        text?: string;
        usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number };
      }>;
      const result = await runGenerateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: body,
        tools,
        stopWhen: stepCountIs(5),
        temperature: 0.2,
        maxOutputTokens: 500,
      });
      replyText = (result.text || '').trim();
      logAiUsage({
        feature: 'copilot',
        tenantId,
        latencyMs: Date.now() - startedAt,
        tokens: result.usage?.totalTokens,
        promptTokens: result.usage?.inputTokens,
        completionTokens: result.usage?.outputTokens,
        provider: resolveProviderConfig()?.provider,
      });
    } catch (err: unknown) {
      logger.error('Copilot: erro no modelo', {
        tenantId,
        userId: user.id,
        err: err instanceof Error ? err.message : String(err),
      });
      const reply = 'O assistente está indisponível no momento. Tente novamente em instantes.';
      await this.reply(tenantId, connection.id, from, reply).catch(() => {});
      return { handled: true, reply, toolsUsed };
    }

    // Se o modelo propôs uma escrita, persiste a proposta e pede confirmação.
    if (proposal) {
      const p = proposal as PendingAction;
      const confirmMsg = `${p.summary}\n\nResponda "sim" para confirmar ou "não" para cancelar.`;
      await recordInbound(tenantId, connection.id, user.id, from, body, p);
      await this.reply(tenantId, connection.id, from, confirmMsg).catch(() => {});
      return { handled: true, reply: confirmMsg, toolsUsed, pending: p };
    }

    const reply = replyText || 'Não encontrei nada para responder.';
    await recordInbound(tenantId, connection.id, user.id, from, body);
    await this.reply(tenantId, connection.id, from, reply).catch(() => {});
    return { handled: true, reply, toolsUsed, pending: null };
  },

  /**
   * Monta o conjunto de tools do copiloto. LEITURA executa direto (escopado);
   * ESCRITA apenas registra a proposta via `onPropose` (não muta o banco).
   */
  buildTools(
    tenantId: string,
    user: PermissionUser,
    hooks: { onRead: (name: string) => void; onPropose: (p: PendingAction) => void }
  ): ToolSet {
    return {
      // ── LEITURA ──────────────────────────────────────────────────────────
      minhas_tarefas_hoje: defineTool({
        description: 'Lista as tarefas pendentes do usuário com vencimento até hoje.',
        inputSchema: z.object({}),
        execute: async () => {
          hooks.onRead('minhas_tarefas_hoje');
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          const tasks = await prisma.task.findMany({
            where: {
              tenantId,
              assignedTo: user.userId, // sempre as PRÓPRIAS tarefas do comandante
              deletedAt: null,
              status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
              OR: [{ dueDate: null }, { dueDate: { lte: endOfToday } }],
            },
            select: { id: true, title: true, dueDate: true, status: true },
            orderBy: { dueDate: 'asc' },
            take: 20,
          });
          logger.info('Copilot tool call', { tool: 'minhas_tarefas_hoje', userId: user.userId, tenantId, count: tasks.length });
          return { tasks };
        },
      }),

      status_do_deal: defineTool({
        description: 'Consulta o status de uma negociação pelo nome (busca parcial). Respeita a visibilidade do usuário.',
        inputSchema: z.object({
          nome: z.string().min(1).describe('Nome ou parte do nome da negociação'),
        }),
        execute: async ({ nome }) => {
          hooks.onRead('status_do_deal');
          const owner = await permissionService.visibilityScope(user, 'deals');
          const deals = await prisma.deal.findMany({
            where: {
              tenantId,
              deletedAt: null,
              name: { contains: nome, mode: 'insensitive' },
              // owner: string (PROPRIA) | {in:[...]} (EQUIPE) | undefined (GERAL, sem filtro)
              ...(owner === undefined ? {} : { assignedTo: owner }),
            },
            select: { id: true, name: true, stage: true, status: true, value: true, expectedCloseDate: true },
            orderBy: { updatedAt: 'desc' },
            take: 5,
          });
          logger.info('Copilot tool call', { tool: 'status_do_deal', userId: user.userId, tenantId, count: deals.length });
          return { deals };
        },
      }),

      buscar_contato: defineTool({
        description: 'Busca um contato (lead) por nome, e-mail ou telefone. Respeita a visibilidade do usuário.',
        inputSchema: z.object({
          termo: z.string().min(1).describe('Nome, e-mail ou telefone do contato'),
        }),
        execute: async ({ termo }) => {
          hooks.onRead('buscar_contato');
          const owner = await permissionService.visibilityScope(user, 'contacts');
          const leads = await prisma.lead.findMany({
            where: {
              tenantId,
              deletedAt: null,
              // owner: string (PROPRIA) | {in:[...]} (EQUIPE) | undefined (GERAL, sem filtro)
              ...(owner === undefined ? {} : { assignedTo: owner }),
              OR: [
                { name: { contains: termo, mode: 'insensitive' } },
                { email: { contains: termo, mode: 'insensitive' } },
                { phone: { contains: termo } },
              ],
            },
            select: { id: true, name: true, email: true, phone: true, company: true, status: true },
            orderBy: { updatedAt: 'desc' },
            take: 5,
          });
          logger.info('Copilot tool call', { tool: 'buscar_contato', userId: user.userId, tenantId, count: leads.length });
          return { leads };
        },
      }),

      // ── ESCRITA (propõe; NÃO executa) ─────────────────────────────────────
      criar_tarefa: defineTool({
        description:
          'PROPÕE a criação de uma tarefa para o usuário. NÃO cria imediatamente — o sistema pedirá confirmação.',
        inputSchema: z.object({
          title: z.string().min(1).describe('Título da tarefa'),
          description: z.string().optional(),
          dueDate: z.string().optional().describe('Data de vencimento ISO (opcional)'),
        }),
        execute: async ({ title, description, dueDate }) => {
          logger.info('Copilot tool call', { tool: 'criar_tarefa(proposta)', userId: user.userId, tenantId, entity: 'task' });
          hooks.onPropose({
            kind: 'criar_tarefa',
            args: { title, description, dueDate },
            summary: `Vou criar a tarefa: "${title}"${dueDate ? ` (vence em ${dueDate})` : ''}.`,
          });
          return { proposed: true, title };
        },
      }),

      atualizar_deal: defineTool({
        description:
          'PROPÕE a atualização de uma negociação (etapa/valor/notas). NÃO altera imediatamente — o sistema pedirá confirmação. Nunca exclui.',
        inputSchema: z.object({
          dealId: z.string().min(1).describe('ID da negociação (use buscar/status para obter)'),
          stage: z
            .enum(['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSING', 'WON', 'LOST'])
            .optional(),
          value: z.number().optional(),
          notes: z.string().optional(),
        }),
        execute: async ({ dealId, stage, value, notes }) => {
          // Valida que o deal existe no tenant E é visível ao usuário antes de propor.
          const owner = await permissionService.visibilityScope(user, 'deals');
          const deal = await prisma.deal.findFirst({
            where: {
              id: dealId,
              tenantId,
              deletedAt: null,
              // owner: string (PROPRIA) | {in:[...]} (EQUIPE) | undefined (GERAL, sem filtro)
              ...(owner === undefined ? {} : { assignedTo: owner }),
            },
            select: { id: true, name: true },
          });
          if (!deal) {
            return { proposed: false, error: 'Negociação não encontrada ou sem acesso.' };
          }
          const changes: string[] = [];
          if (stage) changes.push(`etapa → ${stage}`);
          if (typeof value === 'number') changes.push(`valor → ${value}`);
          if (notes) changes.push('notas atualizadas');
          logger.info('Copilot tool call', { tool: 'atualizar_deal(proposta)', userId: user.userId, tenantId, entity: 'deal', entityId: dealId });
          hooks.onPropose({
            kind: 'atualizar_deal',
            args: { dealId, stage, value, notes },
            summary: `Vou atualizar "${deal.name}": ${changes.join(', ') || 'sem mudanças'}.`,
          });
          return { proposed: true, dealName: deal.name };
        },
      }),
    };
  },

  /** Envia a resposta do copiloto pela própria conexão (texto). */
  async reply(tenantId: string, connectionId: string, to: string, content: string): Promise<void> {
    await whatsappMessagingService.sendMessage(tenantId, {
      connectionId,
      to,
      type: 'text',
      content,
    });
  },
};

export default copilotService;
