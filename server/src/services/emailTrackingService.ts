import crypto from 'crypto';
import prisma from '../config/database.js';
import { scoringService } from './scoringService.js';
import { logger } from '../utils/logger.js';

const TRACKING_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export const emailTrackingService = {
  /**
   * Generate a tracking token and store it in the interaction metadata.
   * Call this BEFORE sending the email so we can inject the pixel.
   */
  async createTracking(interactionId: string): Promise<string> {
    const token = generateTrackingToken();

    const existing = await prisma.interaction.findUnique({
      where: { id: interactionId },
      select: { metadata: true },
    });
    const existingMeta = (existing?.metadata as Record<string, any>) || {};

    await prisma.interaction.update({
      where: { id: interactionId },
      data: {
        metadata: {
          ...existingMeta,
          trackingToken: token,
          opens: 0,
          clicks: 0,
          clickedUrls: [] as string[],
        },
      },
    });

    return token;
  },

  /**
   * Record an email open event.
   */
  async recordOpen(trackingToken: string, ipAddress?: string, userAgent?: string) {
    const interaction = await this.findByToken(trackingToken);
    if (!interaction) return;

    const meta = (interaction.metadata as Record<string, any>) || {};
    const opens = (meta.opens || 0) + 1;

    await prisma.interaction.update({
      where: { id: interaction.id },
      data: {
        metadata: {
          ...meta,
          opens,
          emailStatus: 'opened',
          lastOpenedAt: new Date().toISOString(),
          ...(opens === 1 ? { firstOpenedAt: new Date().toISOString() } : {}),
          ...(ipAddress ? { lastOpenIp: ipAddress } : {}),
        },
      },
    });

    // Trigger lead scoring (only on first open)
    if (opens === 1 && interaction.leadId) {
      scoringService.processEvent(
        interaction.tenantId,
        interaction.leadId,
        'EMAIL_OPENED' as any
      ).catch(err => logger.error('Failed to score EMAIL_OPENED', { err }));
    }
  },

  /**
   * Record a link click event and return the original URL.
   */
  async recordClick(trackingToken: string, url: string, ipAddress?: string, userAgent?: string): Promise<string | null> {
    const interaction = await this.findByToken(trackingToken);
    if (!interaction) return null;

    const meta = (interaction.metadata as Record<string, any>) || {};
    const clicks = (meta.clicks || 0) + 1;
    const clickedUrls: string[] = meta.clickedUrls || [];
    if (!clickedUrls.includes(url)) {
      clickedUrls.push(url);
    }

    await prisma.interaction.update({
      where: { id: interaction.id },
      data: {
        metadata: {
          ...meta,
          clicks,
          clickedUrls,
          emailStatus: 'clicked',
          lastClickedAt: new Date().toISOString(),
          ...(clicks === 1 ? { firstClickedAt: new Date().toISOString() } : {}),
          ...(ipAddress ? { lastClickIp: ipAddress } : {}),
        },
      },
    });

    // Trigger lead scoring (only on first click)
    if (clicks === 1 && interaction.leadId) {
      scoringService.processEvent(
        interaction.tenantId,
        interaction.leadId,
        'EMAIL_CLICKED' as any
      ).catch(err => logger.error('Failed to score EMAIL_CLICKED', { err }));
    }

    return url;
  },

  /**
   * Inject a tracking pixel into the HTML email body.
   */
  injectPixel(html: string, trackingToken: string, baseUrl?: string): string {
    const base = baseUrl || TRACKING_BASE_URL;
    const pixelUrl = `${base}/api/track/open/${trackingToken}`;
    const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

    // Case-insensitive match handles </BODY>, </Body>, </body > variants
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${pixel}</body>`);
    }
    return html + pixel;
  },

  /**
   * Rewrite all links in the HTML to go through the click tracker.
   */
  rewriteLinks(html: string, trackingToken: string, baseUrl?: string): string {
    const base = baseUrl || TRACKING_BASE_URL;
    // Match href="..." in anchor tags, skip mailto: and # links
    return html.replace(
      /(<a\s[^>]*href=["'])([^"'#][^"']*)(["'][^>]*>)/gi,
      (match, prefix, url, suffix) => {
        if (url.startsWith('mailto:') || url.startsWith('#') || url.startsWith('tel:')) {
          return match;
        }
        const trackedUrl = `${base}/api/track/click/${trackingToken}?url=${encodeURIComponent(url)}`;
        return `${prefix}${trackedUrl}${suffix}`;
      }
    );
  },

  /**
   * Apply all tracking (pixel + link rewriting) to an HTML email.
   */
  applyTracking(html: string, trackingToken: string, baseUrl?: string): string {
    let result = this.rewriteLinks(html, trackingToken, baseUrl);
    result = this.injectPixel(result, trackingToken, baseUrl);
    return result;
  },

  /**
   * Get the transparent GIF buffer for the open pixel response.
   */
  getPixelGif(): Buffer {
    return TRANSPARENT_GIF;
  },

  /**
   * Find interaction by tracking token.
   */
  async findByToken(trackingToken: string) {
    // Search interactions where metadata contains this tracking token
    const interactions = await prisma.interaction.findMany({
      where: {
        metadata: {
          path: ['trackingToken'],
          equals: trackingToken,
        },
      },
      take: 1,
    });

    return interactions[0] || null;
  },
};
