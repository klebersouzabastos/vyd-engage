import prisma from '../config/database.js';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Email Campaigns service
//
// Authoritative for rendering campaign bodies to email HTML (blocksToHtml),
// audience segmentation (buildAudienceLeadIds / previewAudience), tracking
// injection (rewriteLinksForTracking) and stats aggregation.
//
// Shared contract with the frontend (campaign body is `blocks: Block[]`):
//   text    -> { id, type:'text', content }
//   image   -> { id, type:'image', url, alt? }
//   button  -> { id, type:'button', label, href }
//   divider -> { id, type:'divider' }
//   spacer  -> { id, type:'spacer', height? }
// ============================================================================

export type Block =
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'image'; url: string; alt?: string }
  | { id: string; type: 'button'; label: string; href: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; height?: number };

export interface MergeTagContext {
  name?: string | null;
  company?: string | null;
  email?: string | null;
}

export interface AudienceFilters {
  status?: string;
  tagId?: string;
  assignedTo?: string;
  source?: string;
  minScore?: number;
  maxScore?: number;
  lastInteractionBefore?: string; // ISO date
  lastInteractionAfter?: string; // ISO date
  noInteractionDays?: number; // leads with no interaction in the last N days
}

// ----------------------------------------------------------------------------
// HTML sanitization (allowlist) — prevents XSS in user-inserted content (req 11).
// No external dependency: we escape everything, then re-allow a fixed set of
// safe inline/structural tags we ourselves emit in blocksToHtml. User content
// is escaped before being placed inside those tags, so no attacker markup
// survives.
// ----------------------------------------------------------------------------

/** Escape HTML special chars so user text can never inject markup. */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize an href/src URL: only http(s) and mailto/tel are allowed.
 * Anything else (javascript:, data:, vbscript:, ...) becomes '#'.
 */
export function sanitizeUrl(raw: string | undefined | null): string {
  const url = String(raw ?? '').trim();
  if (!url) return '#';
  // Strip whitespace/control chars (0x00-0x20) that can smuggle a scheme.
  // Valid URLs do not contain raw control characters.
  const cleaned = url.replace(new RegExp('[\u0000-\u0020]', 'g'), '');
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (/^mailto:/i.test(cleaned)) return cleaned;
  if (/^tel:/i.test(cleaned)) return cleaned;
  return '#';
}

/**
 * Final guard: strip <script>/<style>/<iframe> blocks, event handler attributes
 * and javascript: URLs from compiled HTML. blocksToHtml already escapes user
 * content; this is defense-in-depth on the assembled document (req 11).
 */
export function sanitizeHtml(html: string): string {
  let out = html;
  // Drop dangerous element blocks entirely (including their content).
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '');
  // Strip inline event handlers (onclick=, onerror=, ...).
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Neutralize javascript:/vbscript: in any remaining attribute.
  out = out.replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript|data):[^"']*\2/gi, '$1=$2#$2');
  return out;
}

// ----------------------------------------------------------------------------
// Merge tags — {{lead.name}}, {{lead.company}}, {{lead.email}}.
// Missing value -> empty string (edge case). Values are HTML-escaped here so
// callers can drop the result straight into HTML.
// ----------------------------------------------------------------------------

const MERGE_FIELDS: Record<string, keyof MergeTagContext> = {
  'lead.name': 'name',
  'lead.company': 'company',
  'lead.email': 'email',
};

/** Replace merge tags in a plain string (no HTML escaping — for subject). */
export function applyMergeTags(template: string | null | undefined, ctx: MergeTagContext): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z._-]+)\s*\}\}/g, (match, rawKey: string) => {
    const field = MERGE_FIELDS[rawKey.toLowerCase()];
    if (!field) return match; // unknown tag preserved
    const value = ctx[field];
    return value != null && value !== '' ? String(value) : '';
  });
}

/** Replace merge tags inside HTML content, escaping substituted values. */
function applyMergeTagsHtml(template: string, ctx: MergeTagContext): string {
  return template.replace(/\{\{\s*([a-zA-Z._-]+)\s*\}\}/g, (match, rawKey: string) => {
    const field = MERGE_FIELDS[rawKey.toLowerCase()];
    if (!field) return match;
    const value = ctx[field];
    return value != null && value !== '' ? escapeHtml(String(value)) : '';
  });
}

// ----------------------------------------------------------------------------
// blocksToHtml — authoritative renderer (req for shared contract).
// Renders Block[] -> email HTML, substitutes merge tags and sanitizes output.
// ----------------------------------------------------------------------------

function renderBlock(block: Block, ctx: MergeTagContext): string {
  switch (block.type) {
    case 'text': {
      // Merge-tag + escape the raw content, preserve line breaks.
      const content = applyMergeTagsHtml(escapeHtml(block.content ?? ''), ctx).replace(/\n/g, '<br/>');
      return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;margin:0 0 16px;">${content}</div>`;
    }
    case 'image': {
      const url = sanitizeUrl((block as any).url);
      const alt = escapeHtml(applyMergeTags((block as any).alt ?? '', ctx));
      return `<div style="margin:0 0 16px;"><img src="${url}" alt="${alt}" style="max-width:100%;height:auto;display:block;border:0;" /></div>`;
    }
    case 'button': {
      const href = sanitizeUrl((block as any).href);
      const label = applyMergeTagsHtml(escapeHtml((block as any).label ?? ''), ctx);
      return `<div style="margin:0 0 16px;text-align:center;"><a href="${href}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#ffffff;text-decoration:none;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;">${label}</a></div>`;
    }
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />`;
    case 'spacer': {
      const height = Math.max(0, Math.min(200, Number((block as any).height) || 24));
      return `<div style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</div>`;
    }
    default:
      return '';
  }
}

/**
 * Render a campaign body (Block[]) to a full, sanitized email HTML document
 * with merge tags substituted for the given lead context.
 */
export function blocksToHtml(blocks: unknown, ctx: MergeTagContext): string {
  const list: Block[] = Array.isArray(blocks) ? (blocks as Block[]) : [];
  const body = list.map((b) => renderBlock(b, ctx)).join('\n');
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head><body style="margin:0;padding:0;background:#f3f4f6;"><div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">${body}</div></body></html>`;
  return sanitizeHtml(doc);
}

// ----------------------------------------------------------------------------
// Tracking base URL — mirrors emailMessagingService resolution.
// ----------------------------------------------------------------------------

export function getTrackingBaseUrl(): string {
  return (
    process.env.EXTERNAL_BASE_URL ||
    process.env.API_URL ||
    process.env.FRONTEND_URL?.replace(':5173', ':3001') ||
    'http://localhost:3001'
  );
}

/** base64url-encode a string (for the click ?u= original-URL param). */
export function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a base64url string back to UTF-8. */
export function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * Rewrite the compiled email for a specific recipient (req 19, 20, 23):
 *  - every link -> tracking redirect carrying the original URL as ?u=base64url
 *  - inject the 1x1 open pixel
 *  - append the unsubscribe footer link
 *
 * `token` is the recipient's public token. Returns ready-to-send HTML.
 */
export function rewriteLinksForTracking(html: string, token: string, baseUrl?: string): string {
  const base = (baseUrl || getTrackingBaseUrl()).replace(/\/$/, '');

  // 1) Rewrite links (skip mailto/tel/anchors and the unsubscribe placeholder).
  let result = html.replace(
    /(<a\s[^>]*href=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix: string, url: string, suffix: string) => {
      if (/^(mailto:|tel:|#)/i.test(url)) return match;
      const clickUrl = `${base}/api/v1/track/campaign-click/${token}?u=${base64UrlEncode(url)}`;
      return `${prefix}${clickUrl}${suffix}`;
    }
  );

  // 2) Unsubscribe footer (LGPD — req 23, 27).
  const unsubUrl = `${base}/api/v1/track/unsubscribe/${token}`;
  const footer = `<div style="max-width:600px;margin:16px auto 0;padding:0 24px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;text-align:center;">Se você não deseja mais receber estes emails, <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline;">descadastre-se aqui</a>.</div>`;

  // 3) Open pixel (req 19) — unique per recipient via token.
  const pixelUrl = `${base}/api/v1/track/campaign-open/${token}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  const inject = `${footer}${pixel}`;
  if (/<\/body>/i.test(result)) {
    result = result.replace(/<\/body>/i, `${inject}</body>`);
  } else {
    result += inject;
  }
  return result;
}

// ----------------------------------------------------------------------------
// Audience segmentation (req 12, 14, 17).
// ----------------------------------------------------------------------------

/**
 * Resolve the audience filters to a concrete list of lead ids for a tenant.
 * Always excludes leads with unsubscribed = true (LGPD — req 14) and
 * soft-deleted leads. Requires a non-null email (campaigns send email).
 */
export async function buildAudienceLeadIds(tenantId: string, filters: AudienceFilters): Promise<string[]> {
  const where: Prisma.LeadWhereInput = {
    tenantId,
    deletedAt: null,
    unsubscribed: false,
    email: { not: null },
  };

  if (filters.status) where.status = filters.status as any;
  if (filters.source) where.source = filters.source as any;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.tagId) where.tags = { some: { tagId: filters.tagId } };

  if (filters.minScore != null || filters.maxScore != null) {
    where.score = {};
    if (filters.minScore != null) (where.score as Prisma.IntFilter).gte = filters.minScore;
    if (filters.maxScore != null) (where.score as Prisma.IntFilter).lte = filters.maxScore;
  }

  // Last interaction before / after — filter on the related interactions.
  if (filters.lastInteractionAfter) {
    where.interactions = {
      ...(where.interactions as object),
      some: { createdAt: { gte: new Date(filters.lastInteractionAfter) } },
    };
  }
  if (filters.lastInteractionBefore) {
    // "last interaction before X" => the lead's most recent interaction predates X,
    // i.e. there is at least one interaction and none on/after X.
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { interactions: { some: {} } },
      { interactions: { none: { createdAt: { gte: new Date(filters.lastInteractionBefore) } } } },
    ];
  }

  // No interaction in the last N days — exclude leads with any recent interaction.
  if (filters.noInteractionDays != null && filters.noInteractionDays > 0) {
    const cutoff = new Date(Date.now() - filters.noInteractionDays * 86400000);
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { interactions: { none: { createdAt: { gte: cutoff } } } },
    ];
  }

  const leads = await prisma.lead.findMany({ where, select: { id: true } });
  return leads.map((l) => l.id);
}

/**
 * Preview audience (req 13, 17): count + up to 5 sample {name, email}.
 */
export async function previewAudience(
  tenantId: string,
  filters: AudienceFilters
): Promise<{ count: number; sample: Array<{ name: string; email: string }> }> {
  const ids = await buildAudienceLeadIds(tenantId, filters);
  const sampleLeads = ids.length
    ? await prisma.lead.findMany({
        where: { id: { in: ids.slice(0, 5) }, tenantId },
        select: { name: true, email: true },
      })
    : [];
  return {
    count: ids.length,
    sample: sampleLeads.map((l) => ({ name: l.name, email: l.email ?? '' })),
  };
}

// ----------------------------------------------------------------------------
// Stats aggregation (req 29-32, 34).
// ----------------------------------------------------------------------------

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  openRate: number;
  ctr: number;
  unsubRate: number;
  timeline: Array<{ hour: number; opens: number }>;
  recipients: Array<{
    leadId: string;
    name: string;
    email: string;
    status: string;
    openedAt: string | null;
  }>;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Aggregate CampaignEvent + CampaignRecipient into the stats payload.
 * Opened/clicked are UNIQUE counts (per recipient). Timeline = opens per hour
 * for the first 48h after sentAt.
 */
export async function getCampaignStats(tenantId: string, campaignId: string): Promise<CampaignStats> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    select: { id: true, sentAt: true },
  });
  if (!campaign) {
    return {
      sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, bounced: 0,
      openRate: 0, ctr: 0, unsubRate: 0, timeline: [], recipients: [],
    };
  }

  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, tenantId },
    select: { leadId: true, name: true, email: true, status: true, openedAt: true, sentAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const sent = recipients.filter((r) => r.sentAt != null).length;

  // Unique opens/clicks via distinct recipientId per event type.
  const events = await prisma.campaignEvent.findMany({
    where: { campaignId, tenantId },
    select: { recipientId: true, type: true, createdAt: true },
  });

  const openersSet = new Set<string>();
  const clickersSet = new Set<string>();
  const unsubSet = new Set<string>();
  const bouncedSet = new Set<string>();
  for (const e of events) {
    if (e.type === 'OPENED') openersSet.add(e.recipientId);
    else if (e.type === 'CLICKED') clickersSet.add(e.recipientId);
    else if (e.type === 'UNSUBSCRIBED') unsubSet.add(e.recipientId);
    else if (e.type === 'BOUNCED') bouncedSet.add(e.recipientId);
  }

  const opened = openersSet.size;
  const clicked = clickersSet.size;
  const unsubscribed = unsubSet.size;
  const bounced = bouncedSet.size;
  // Delivered = sent minus bounced (no separate delivery receipt source).
  const delivered = Math.max(0, sent - bounced);

  // Timeline: opens per hour for first 48h after send.
  const timeline: Array<{ hour: number; opens: number }> = Array.from({ length: 48 }, (_, hour) => ({ hour, opens: 0 }));
  if (campaign.sentAt) {
    const start = campaign.sentAt.getTime();
    for (const e of events) {
      if (e.type !== 'OPENED') continue;
      const diffH = Math.floor((e.createdAt.getTime() - start) / 3600000);
      if (diffH >= 0 && diffH < 48) timeline[diffH].opens += 1;
    }
  }

  return {
    sent,
    delivered,
    opened,
    clicked,
    unsubscribed,
    bounced,
    openRate: sent > 0 ? round((opened / sent) * 100) : 0,
    ctr: sent > 0 ? round((clicked / sent) * 100) : 0,
    unsubRate: sent > 0 ? round((unsubscribed / sent) * 100) : 0,
    timeline,
    recipients: recipients.map((r) => ({
      leadId: r.leadId,
      name: r.name ?? '',
      email: r.email,
      status: r.status.toLowerCase(),
      openedAt: r.openedAt ? r.openedAt.toISOString() : null,
    })),
  };
}

// ----------------------------------------------------------------------------
// Tracking event recording (used by public routes).
// ----------------------------------------------------------------------------

/** Record an OPENED event (idempotent per recipient). Silent on bad token. */
export async function recordOpen(token: string): Promise<void> {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { token },
    select: { id: true, campaignId: true, tenantId: true, leadId: true, openedAt: true, status: true },
  });
  if (!recipient) return;

  // Idempotent: only the first open creates an event / sets openedAt.
  const already = await prisma.campaignEvent.findFirst({
    where: { recipientId: recipient.id, type: 'OPENED' },
    select: { id: true },
  });
  if (already) return;

  await prisma.campaignEvent.create({
    data: {
      campaignId: recipient.campaignId,
      recipientId: recipient.id,
      tenantId: recipient.tenantId,
      leadId: recipient.leadId,
      type: 'OPENED',
    },
  });

  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: {
      openedAt: recipient.openedAt ?? new Date(),
      // Don't downgrade a CLICKED/UNSUBSCRIBED/BOUNCED recipient back to OPENED.
      ...(recipient.status === 'SENT' || recipient.status === 'PENDING' ? { status: 'OPENED' } : {}),
    },
  });
}

/** Record a CLICKED event with the original URL. Silent on bad token. */
export async function recordClick(token: string, url: string): Promise<void> {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { token },
    select: { id: true, campaignId: true, tenantId: true, leadId: true, status: true },
  });
  if (!recipient) return;

  await prisma.campaignEvent.create({
    data: {
      campaignId: recipient.campaignId,
      recipientId: recipient.id,
      tenantId: recipient.tenantId,
      leadId: recipient.leadId,
      type: 'CLICKED',
      url,
    },
  });

  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: {
      ...(recipient.status === 'UNSUBSCRIBED' || recipient.status === 'BOUNCED' ? {} : { status: 'CLICKED' }),
    },
  });
}

/**
 * Process the unsubscribe link (req 23, 27): set lead.unsubscribed + record
 * an UNSUBSCRIBED event. Idempotent. Returns true if a recipient was found.
 */
export async function recordUnsubscribe(token: string): Promise<boolean> {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { token },
    select: { id: true, campaignId: true, tenantId: true, leadId: true },
  });
  if (!recipient) return false;

  await prisma.lead.update({
    where: { id: recipient.leadId },
    data: { unsubscribed: true, unsubscribedAt: new Date() },
  });

  const already = await prisma.campaignEvent.findFirst({
    where: { recipientId: recipient.id, type: 'UNSUBSCRIBED' },
    select: { id: true },
  });
  if (!already) {
    await prisma.campaignEvent.create({
      data: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        tenantId: recipient.tenantId,
        leadId: recipient.leadId,
        type: 'UNSUBSCRIBED',
      },
    });
  }

  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: { status: 'UNSUBSCRIBED' },
  });
  return true;
}

/**
 * Record a BOUNCED event for a recipient identified by email within a tenant
 * (req 24). Does NOT touch unsubscribe state (edge case: bounce on an already
 * unsubscribed lead must not duplicate UNSUBSCRIBED).
 */
export async function recordBounceByEmail(email: string): Promise<number> {
  const recipients = await prisma.campaignRecipient.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, campaignId: true, tenantId: true, leadId: true },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  let recorded = 0;
  for (const recipient of recipients) {
    const already = await prisma.campaignEvent.findFirst({
      where: { recipientId: recipient.id, type: 'BOUNCED' },
      select: { id: true },
    });
    if (already) continue;
    await prisma.campaignEvent.create({
      data: {
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        tenantId: recipient.tenantId,
        leadId: recipient.leadId,
        type: 'BOUNCED',
      },
    });
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'BOUNCED' },
    });
    recorded++;
  }
  return recorded;
}
