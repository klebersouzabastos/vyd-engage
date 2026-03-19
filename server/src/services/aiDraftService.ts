import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import {
  TemplateType,
  TemplateContext,
  generateStaticDraft,
  getAllTemplates,
} from './emailTemplates.js';

// ========================
// Types
// ========================

export interface DraftContext {
  leadName: string;
  leadEmail?: string;
  companyName?: string;
  stage?: string;
  lastInteraction?: string;
  templateType: TemplateType;
  customInstructions?: string;
  dealName?: string;
  dealValue?: string;
  userName?: string;
  daysSinceLastContact?: number;
}

export interface EmailDraft {
  subject: string;
  body: string;
  templateUsed: TemplateType;
  aiGenerated: boolean;
}

// ========================
// AI Provider Abstraction
// ========================

interface AIProvider {
  generateDraft(systemPrompt: string, userPrompt: string): Promise<string>;
}

class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || 'gpt-4o-mini';
  }

  async generateDraft(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} — ${(error as any)?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }
}

class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || 'claude-sonnet-4-20250514';
  }

  async generateDraft(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${response.status} — ${(error as any)?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json() as any;
    return data.content?.[0]?.text || '';
  }
}

// ========================
// Rate Limiting (in-memory)
// ========================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // max generations per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(tenantId: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(tenantId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(tenantId, { count: 1, resetAt: now + RATE_WINDOW });
    return;
  }

  if (entry.count >= RATE_LIMIT) {
    throw createError(
      `Limite de ${RATE_LIMIT} gerações por hora atingido. Tente novamente mais tarde.`,
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }

  entry.count++;
}

// ========================
// Provider Factory
// ========================

function getProvider(provider: string, apiKey: string, model?: string): AIProvider | null {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    default:
      return null;
  }
}

function resolveProviderConfig(): { provider: string; apiKey: string; model?: string } | null {
  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (provider && apiKey) {
    return { provider, apiKey, model };
  }

  // Fallback: check individual env vars
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY, model };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, model };
  }

  return null;
}

// ========================
// System Prompt
// ========================

const SYSTEM_PROMPT = `Você é um assistente de vendas profissional que escreve emails comerciais em português brasileiro.

Regras:
- Escreva de forma profissional mas amigável
- Seja conciso e direto
- Use o contexto fornecido sobre o lead/deal para personalizar o email
- Nunca invente informações que não foram fornecidas
- Formate o email com saudação, corpo e despedida
- Responda APENAS com o conteúdo do email (sem explicações adicionais)
- O email deve estar pronto para envio
- Use formatação de texto simples (sem HTML)

Formato de resposta (JSON):
{"subject": "assunto do email", "body": "corpo completo do email"}`;

function buildUserPrompt(context: DraftContext): string {
  const parts: string[] = [];

  parts.push(`Tipo de email: ${getTemplateLabel(context.templateType)}`);
  parts.push(`Nome do lead: ${context.leadName}`);

  if (context.leadEmail) parts.push(`Email do lead: ${context.leadEmail}`);
  if (context.companyName) parts.push(`Empresa: ${context.companyName}`);
  if (context.stage) parts.push(`Stage atual: ${context.stage}`);
  if (context.dealName) parts.push(`Nome do deal: ${context.dealName}`);
  if (context.dealValue) parts.push(`Valor do deal: ${context.dealValue}`);
  if (context.userName) parts.push(`Seu nome (remetente): ${context.userName}`);
  if (context.daysSinceLastContact !== undefined) {
    parts.push(`Dias desde último contato: ${context.daysSinceLastContact}`);
  }
  if (context.lastInteraction) {
    parts.push(`Última interação: ${context.lastInteraction}`);
  }
  if (context.customInstructions) {
    parts.push(`\nInstruções adicionais do usuário: ${context.customInstructions}`);
  }

  return parts.join('\n');
}

function getTemplateLabel(type: TemplateType): string {
  const labels: Record<TemplateType, string> = {
    initial_outreach: 'Primeiro contato',
    follow_up: 'Follow-up',
    proposal: 'Proposta comercial',
    thank_you: 'Agradecimento',
  };
  return labels[type] || type;
}

// ========================
// Service
// ========================

export const aiDraftService = {
  /**
   * Build context from lead/deal data
   */
  async buildContext(
    tenantId: string,
    userId: string,
    leadId?: string,
    dealId?: string,
  ): Promise<Partial<DraftContext>> {
    const context: Partial<DraftContext> = {};

    // Get user name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (user) context.userName = user.name;

    // Get lead data
    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, tenantId },
        select: {
          name: true,
          email: true,
          company: true,
          status: true,
          score: true,
        },
      });
      if (lead) {
        context.leadName = lead.name;
        context.leadEmail = lead.email || undefined;
        context.companyName = lead.company || undefined;
        context.stage = lead.status;
      }

      // Get last interaction
      const lastInteraction = await prisma.interaction.findFirst({
        where: { leadId, tenantId },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true, type: true },
      });
      if (lastInteraction) {
        const daysDiff = Math.floor(
          (Date.now() - lastInteraction.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        context.daysSinceLastContact = daysDiff;
        context.lastInteraction = lastInteraction.content.substring(0, 200);
      }
    }

    // Get deal data
    if (dealId) {
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, tenantId },
        select: {
          name: true,
          value: true,
          stage: true,
          lead: { select: { name: true, email: true, company: true, status: true } },
        },
      });
      if (deal) {
        context.dealName = deal.name;
        context.dealValue = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Number(deal.value));
        context.stage = deal.stage;

        // Fill lead data from deal if not already set
        if (!context.leadName && deal.lead) {
          context.leadName = deal.lead.name;
          context.leadEmail = deal.lead.email || undefined;
          context.companyName = deal.lead.company || undefined;
        }
      }
    }

    return context;
  },

  /**
   * Generate an email draft — uses AI if configured, falls back to static templates
   */
  async generateEmailDraft(
    tenantId: string,
    userId: string,
    templateType: TemplateType,
    leadId?: string,
    dealId?: string,
    customInstructions?: string,
  ): Promise<EmailDraft> {
    // Rate limit check
    checkRateLimit(tenantId);

    // Build context from database
    const dbContext = await this.buildContext(tenantId, userId, leadId, dealId);

    const context: DraftContext = {
      leadName: dbContext.leadName || 'Cliente',
      leadEmail: dbContext.leadEmail,
      companyName: dbContext.companyName,
      stage: dbContext.stage,
      lastInteraction: dbContext.lastInteraction,
      templateType,
      customInstructions,
      dealName: dbContext.dealName,
      dealValue: dbContext.dealValue,
      userName: dbContext.userName || 'Equipe',
      daysSinceLastContact: dbContext.daysSinceLastContact,
    };

    // Try AI generation
    const providerConfig = resolveProviderConfig();
    if (providerConfig) {
      try {
        const provider = getProvider(
          providerConfig.provider,
          providerConfig.apiKey,
          providerConfig.model,
        );

        if (provider) {
          const userPrompt = buildUserPrompt(context);
          const rawResponse = await provider.generateDraft(SYSTEM_PROMPT, userPrompt);

          // Try to parse JSON response
          try {
            // Extract JSON from response (may be wrapped in markdown code blocks)
            const jsonMatch = rawResponse.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return {
                subject: parsed.subject,
                body: parsed.body,
                templateUsed: templateType,
                aiGenerated: true,
              };
            }
          } catch {
            // If JSON parsing fails, use raw response as body
          }

          // Fallback: use raw text as body with a generated subject
          return {
            subject: `${getTemplateLabel(templateType)} — ${context.leadName}`,
            body: rawResponse,
            templateUsed: templateType,
            aiGenerated: true,
          };
        }
      } catch (error: any) {
        logger.warn('AI draft generation failed, falling back to template', {
          error: error.message,
          provider: providerConfig.provider,
        });
        // Fall through to static template
      }
    }

    // Fallback: static template
    const templateContext: import('./emailTemplates.js').TemplateContext = {
      leadName: context.leadName,
      leadEmail: context.leadEmail,
      companyName: context.companyName,
      userName: context.userName,
      stage: context.stage,
      daysSinceLastContact: context.daysSinceLastContact,
      lastInteractionSummary: context.lastInteraction,
      dealName: context.dealName,
      dealValue: context.dealValue,
    };

    const draft = generateStaticDraft(templateType, templateContext);

    return {
      ...draft,
      templateUsed: templateType,
      aiGenerated: false,
    };
  },

  /**
   * Test if the configured AI provider is reachable
   */
  async testConnection(): Promise<{ success: boolean; provider: string; error?: string }> {
    const config = resolveProviderConfig();
    if (!config) {
      return { success: false, provider: 'none', error: 'Nenhum provider de IA configurado' };
    }

    try {
      const provider = getProvider(config.provider, config.apiKey, config.model);
      if (!provider) {
        return { success: false, provider: config.provider, error: 'Provider inválido' };
      }

      await provider.generateDraft(
        'Responda apenas com: {"status":"ok"}',
        'Teste de conexão'
      );

      return { success: true, provider: config.provider };
    } catch (error: any) {
      return {
        success: false,
        provider: config.provider,
        error: error.message,
      };
    }
  },

  /**
   * Get available templates list
   */
  getTemplates() {
    return getAllTemplates();
  },

  /**
   * Get current AI configuration status (safe — no secrets exposed)
   */
  getAIConfig(): { provider: string; configured: boolean; model?: string } {
    const config = resolveProviderConfig();
    if (!config) {
      return { provider: 'none', configured: false };
    }
    return {
      provider: config.provider,
      configured: true,
      model: config.model,
    };
  },
};
