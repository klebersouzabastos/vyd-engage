import crypto from 'crypto';

/**
 * Zapier-compatible webhook payload builder and sample payloads.
 *
 * Payload format follows Zapier REST Hook specification:
 * - Flat `data` object (no unnecessary nesting)
 * - DateTime fields in ISO 8601
 * - Decimal fields as string
 * - Tags as array of strings
 * - Custom fields as flat key-value object
 */

export const API_VERSION = '2026-03';

export interface WebhookPayload {
  id: string;
  event: string;
  created_at: string;
  api_version: string;
  data: Record<string, unknown>;
}

/**
 * Build a Zapier-compatible webhook payload for a business event.
 */
export function buildWebhookPayload(
  event: string,
  data: Record<string, unknown>,
): WebhookPayload {
  return {
    id: `evt_${crypto.randomUUID()}`,
    event,
    created_at: new Date().toISOString(),
    api_version: API_VERSION,
    data,
  };
}

/**
 * Flatten a lead entity into Zapier-friendly data.
 */
export function flattenLeadData(lead: Record<string, any>): Record<string, unknown> {
  const tags: string[] = [];
  if (Array.isArray(lead.tags)) {
    for (const t of lead.tags) {
      if (typeof t === 'string') {
        tags.push(t);
      } else if (t?.tag?.name) {
        tags.push(t.tag.name);
      } else if (t?.name) {
        tags.push(t.name);
      }
    }
  }

  const customFields: Record<string, unknown> = {};
  if (lead.customFields && typeof lead.customFields === 'object') {
    for (const [key, value] of Object.entries(lead.customFields)) {
      customFields[`custom_${key}`] = value;
    }
  }

  // Extra fields (e.g., previous_status for status_changed events)
  const extra: Record<string, unknown> = {};
  if (lead._extra && typeof lead._extra === 'object') {
    Object.assign(extra, lead._extra);
  }

  return {
    id: lead.id,
    name: lead.name || null,
    email: lead.email || null,
    phone: lead.phone || null,
    company: lead.company || null,
    position: lead.position || null,
    status: lead.status || null,
    source: lead.source || null,
    score: lead.score ?? 0,
    assigned_to: lead.assignedTo || null,
    notes: lead.notes || null,
    tags,
    ...customFields,
    ...extra,
    created_at: lead.createdAt ? new Date(lead.createdAt).toISOString() : null,
    updated_at: lead.updatedAt ? new Date(lead.updatedAt).toISOString() : null,
  };
}

/**
 * Flatten a deal entity into Zapier-friendly data.
 */
export function flattenDealData(
  deal: Record<string, any>,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: deal.id,
    name: deal.name || null,
    value: deal.value != null ? String(deal.value) : '0',
    stage: deal.stage || null,
    probability: deal.probability ?? 0,
    expected_close_date: deal.expectedCloseDate
      ? new Date(deal.expectedCloseDate).toISOString()
      : null,
    lead_id: deal.leadId || null,
    lead_name: deal.lead?.name || null,
    assigned_to: deal.assignedTo || null,
    assigned_to_name: deal.assignedUser?.name || null,
    notes: deal.notes || null,
    lost_reason: deal.lostReason || null,
    closed_at: deal.closedAt ? new Date(deal.closedAt).toISOString() : null,
    created_at: deal.createdAt ? new Date(deal.createdAt).toISOString() : null,
    updated_at: deal.updatedAt ? new Date(deal.updatedAt).toISOString() : null,
    ...extra,
  };
}

/**
 * Flatten a task entity into Zapier-friendly data.
 */
export function flattenTaskData(task: Record<string, any>): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title || null,
    description: task.description || null,
    status: task.status || null,
    priority: task.priority || null,
    due_date: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    assigned_to: task.assignedTo || null,
    lead_id: task.leadId || null,
    deal_id: task.dealId || null,
    created_at: task.createdAt ? new Date(task.createdAt).toISOString() : null,
    updated_at: task.updatedAt ? new Date(task.updatedAt).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Sample payloads for test webhook — realistic fake data
// ---------------------------------------------------------------------------

const SAMPLE_LEAD = {
  id: 'lead_sample_001',
  name: 'Maria Silva',
  email: 'maria.silva@example.com',
  phone: '+5511999990000',
  company: 'Acme Corp',
  position: 'Diretora de Marketing',
  status: 'NEW',
  source: 'WEBSITE',
  score: 45,
  assigned_to: null,
  notes: null,
  tags: ['inbound', 'marketing'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SAMPLE_DEAL = {
  id: 'deal_sample_001',
  name: 'Contrato Acme Corp 2026',
  value: '85000.00',
  stage: 'PROPOSAL',
  probability: 40,
  expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  lead_id: 'lead_sample_001',
  lead_name: 'Maria Silva',
  assigned_to: null,
  assigned_to_name: null,
  notes: 'Proposta enviada, aguardando retorno',
  lost_reason: null,
  closed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SAMPLE_TASK = {
  id: 'task_sample_001',
  title: 'Follow up com Maria Silva',
  description: 'Ligar para confirmar recebimento da proposta',
  status: 'PENDING',
  priority: 'HIGH',
  due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  assigned_to: null,
  lead_id: 'lead_sample_001',
  deal_id: 'deal_sample_001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Get a realistic sample payload for a given event type.
 * Returns a complete WebhookPayload ready to send.
 */
export function getSamplePayload(event: string): WebhookPayload {
  let data: Record<string, unknown>;

  switch (event) {
    case 'lead.created':
      data = { ...SAMPLE_LEAD };
      break;
    case 'lead.updated':
      data = { ...SAMPLE_LEAD, status: 'CONTACTED', score: 55 };
      break;
    case 'lead.deleted':
      data = { id: SAMPLE_LEAD.id, name: SAMPLE_LEAD.name, email: SAMPLE_LEAD.email };
      break;
    case 'lead.status_changed':
      data = { ...SAMPLE_LEAD, status: 'QUALIFIED', previous_status: 'NEW' };
      break;

    case 'deal.created':
      data = { ...SAMPLE_DEAL };
      break;
    case 'deal.updated':
      data = { ...SAMPLE_DEAL, probability: 60 };
      break;
    case 'deal.stage_changed':
      data = { ...SAMPLE_DEAL, stage: 'NEGOTIATION', previous_stage: 'PROPOSAL' };
      break;
    case 'deal.won':
      data = {
        ...SAMPLE_DEAL,
        stage: 'WON',
        probability: 100,
        closed_at: new Date().toISOString(),
      };
      break;
    case 'deal.lost':
      data = {
        ...SAMPLE_DEAL,
        stage: 'LOST',
        probability: 0,
        lost_reason: 'Orcamento excedido',
        closed_at: new Date().toISOString(),
      };
      break;

    case 'task.created':
      data = { ...SAMPLE_TASK };
      break;
    case 'task.completed':
      data = { ...SAMPLE_TASK, status: 'COMPLETED' };
      break;

    case 'automation.triggered':
      data = {
        automation_id: 'auto_sample_001',
        automation_name: 'Welcome Email',
        lead_id: SAMPLE_LEAD.id,
        lead_name: SAMPLE_LEAD.name,
        triggered_at: new Date().toISOString(),
      };
      break;

    case 'payment.approved':
      data = {
        payment_id: 'pay_sample_001',
        amount: '199.90',
        status: 'APPROVED',
        method: 'CREDIT_CARD',
        paid_at: new Date().toISOString(),
      };
      break;
    case 'payment.failed':
      data = {
        payment_id: 'pay_sample_002',
        amount: '199.90',
        status: 'FAILED',
        method: 'CREDIT_CARD',
        error: 'Cartao recusado',
        failed_at: new Date().toISOString(),
      };
      break;

    default:
      // Generic test payload (fallback)
      data = {
        message: 'This is a test webhook from VYD Engage',
        timestamp: new Date().toISOString(),
      };
      break;
  }

  return buildWebhookPayload(event || 'test', data);
}
