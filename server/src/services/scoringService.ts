import prisma from '../config/database.js';
import { ScoreEvent } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

export interface CreateScoreRuleData {
  name: string;
  eventType: ScoreEvent;
  points: number;
  description?: string;
  conditions?: Record<string, any>;
}

export interface UpdateScoreRuleData {
  name?: string;
  eventType?: ScoreEvent;
  points?: number;
  description?: string | null;
  active?: boolean;
  conditions?: Record<string, any> | null;
}

// Default scoring rules seeded for new tenants
const DEFAULT_RULES: Omit<CreateScoreRuleData, 'name'>[] = [
  { eventType: ScoreEvent.LEAD_CREATED, points: 10, description: 'Lead criado no sistema' },
  { eventType: ScoreEvent.STATUS_CHANGED, points: 5, description: 'Status do lead alterado' },
  { eventType: ScoreEvent.TAG_ADDED, points: 3, description: 'Tag adicionada ao lead' },
  { eventType: ScoreEvent.INTERACTION_CREATED, points: 5, description: 'Interação registrada' },
  { eventType: ScoreEvent.EMAIL_OPENED, points: 8, description: 'Email aberto pelo lead' },
  { eventType: ScoreEvent.EMAIL_CLICKED, points: 15, description: 'Link clicado no email' },
  { eventType: ScoreEvent.WHATSAPP_REPLIED, points: 20, description: 'Lead respondeu no WhatsApp' },
  { eventType: ScoreEvent.FORM_SUBMITTED, points: 25, description: 'Formulário enviado pelo lead' },
];

export const scoringService = {
  // ========================
  // Score Rule CRUD
  // ========================

  async findAll(tenantId: string) {
    return prisma.scoreRule.findMany({
      where: { tenantId },
      orderBy: { eventType: 'asc' },
    });
  },

  async findById(tenantId: string, id: string) {
    const rule = await prisma.scoreRule.findFirst({
      where: { id, tenantId },
    });
    if (!rule) {
      throw createError('Score rule not found', 404, 'SCORE_RULE_NOT_FOUND');
    }
    return rule;
  },

  async create(tenantId: string, data: CreateScoreRuleData) {
    return prisma.scoreRule.create({
      data: {
        tenantId,
        name: data.name,
        eventType: data.eventType,
        points: data.points,
        description: data.description,
        conditions: data.conditions || undefined,
      },
    });
  },

  async update(tenantId: string, id: string, data: UpdateScoreRuleData) {
    await this.findById(tenantId, id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.eventType !== undefined) updateData.eventType = data.eventType;
    if (data.points !== undefined) updateData.points = data.points;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;

    return prisma.scoreRule.update({
      where: { id },
      data: updateData,
    });
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.scoreRule.delete({ where: { id } });
    return { deleted: true };
  },

  // ========================
  // Default Rules Seeding
  // ========================

  async ensureDefaultRules(tenantId: string) {
    const existing = await prisma.scoreRule.count({ where: { tenantId } });
    if (existing > 0) {
      return this.findAll(tenantId);
    }

    const rules = await Promise.all(
      DEFAULT_RULES.map((rule, index) =>
        prisma.scoreRule.create({
          data: {
            tenantId,
            name: `${rule.eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}`,
            eventType: rule.eventType,
            points: rule.points,
            description: rule.description,
          },
        })
      )
    );

    return rules;
  },

  // ========================
  // Event-Driven Scoring
  // ========================

  /**
   * Process a scoring event for a lead.
   * Looks up active rules matching the event, sums points, updates lead score.
   */
  async processEvent(tenantId: string, leadId: string, eventType: ScoreEvent, conditions?: Record<string, any>) {
    // Get all active rules matching this event type
    const rules = await prisma.scoreRule.findMany({
      where: {
        tenantId,
        eventType,
        active: true,
      },
    });

    if (rules.length === 0) return 0;

    // Calculate total points from matching rules
    let totalPoints = 0;
    for (const rule of rules) {
      // If rule has conditions, check if they match
      if (rule.conditions && conditions) {
        const ruleConditions = rule.conditions as Record<string, any>;
        const matches = Object.entries(ruleConditions).every(
          ([key, value]) => conditions[key] === value
        );
        if (!matches) continue;
      }
      totalPoints += rule.points;
    }

    if (totalPoints === 0) return 0;

    // Update lead score atomically
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        score: { increment: totalPoints },
      },
      select: { score: true },
    });

    return updated.score;
  },

  /**
   * Recalculate full score for a lead based on all past interactions.
   * Used for manual recalculation or when rules change.
   */
  async recalculateLeadScore(tenantId: string, leadId: string) {
    // Get all active rules
    const rules = await prisma.scoreRule.findMany({
      where: { tenantId, active: true },
    });

    if (rules.length === 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { score: 0 },
      });
      return 0;
    }

    // Count events for this lead
    const interactionCount = await prisma.interaction.count({
      where: { leadId, tenantId },
    });

    const tagCount = await prisma.leadTag.count({
      where: { leadId },
    });

    // Build event counts map
    const eventCounts: Partial<Record<ScoreEvent, number>> = {
      [ScoreEvent.LEAD_CREATED]: 1, // Lead always gets creation points
      [ScoreEvent.INTERACTION_CREATED]: interactionCount,
      [ScoreEvent.TAG_ADDED]: tagCount,
    };

    // Calculate total score
    let totalScore = 0;
    for (const rule of rules) {
      const count = eventCounts[rule.eventType] || 0;
      totalScore += rule.points * count;
    }

    // Update lead score
    await prisma.lead.update({
      where: { id: leadId },
      data: { score: totalScore },
    });

    return totalScore;
  },

  /**
   * Recalculate scores for all leads in a tenant.
   * Used when scoring rules change significantly.
   */
  async recalculateAllScores(tenantId: string) {
    const leads = await prisma.lead.findMany({
      where: { tenantId },
      select: { id: true },
    });

    let updated = 0;
    for (const lead of leads) {
      await this.recalculateLeadScore(tenantId, lead.id);
      updated++;
    }

    return { updated };
  },
};
