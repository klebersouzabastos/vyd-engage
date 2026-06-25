import { Router } from 'express';
import { logger } from '../utils/logger.js';
import {
  recordOpen,
  recordClick,
  recordUnsubscribe,
  base64UrlDecode,
} from '../services/campaignService.js';

// ============================================================================
// PUBLIC campaign tracking routes (no auth, no CSRF). Mounted at /track on the
// v1 router in index.ts (canonical) and also under the public router, giving:
//   GET /api/v1/track/campaign-open/:token          (canonical)
//   GET /api/v1/track/campaign-click/:token?u=<base64url(url)>
//   GET /api/v1/track/unsubscribe/:token
//   GET /api/v1/public/track/...                     (backward-compat alias)
// The canonical /api/v1/track/* paths are what
// campaignService.rewriteLinksForTracking emits.
// ============================================================================

const router = Router();

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function sendPixel(res: import('express').Response): void {
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(TRANSPARENT_GIF.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(TRANSPARENT_GIF);
}

// GET /track/campaign-open/:token — records OPENED (idempotent), returns pixel.
// Invalid token still returns the GIF silently (edge case).
router.get('/campaign-open/:token', async (req, res) => {
  const { token } = req.params;
  // Record asynchronously; never block or fail the pixel response.
  recordOpen(token).catch((err) => {
    logger.error('Failed to record campaign open', { token, err: err?.message });
  });
  try {
    sendPixel(res);
  } catch {
    res.set('Content-Type', 'image/gif');
    res.end(TRANSPARENT_GIF);
  }
});

// GET /track/campaign-click/:token?u=<base64url(originalUrl)> — records CLICKED
// with the decoded URL, then 302 redirects to it.
router.get('/campaign-click/:token', async (req, res) => {
  const { token } = req.params;
  const u = req.query.u;

  let originalUrl = '';
  try {
    if (typeof u === 'string' && u.length > 0) {
      originalUrl = base64UrlDecode(u);
    }
  } catch {
    originalUrl = '';
  }

  // Validate decoded URL — only http(s) redirects (prevent open redirect).
  let safeUrl: string | null = null;
  if (originalUrl) {
    try {
      const parsed = new URL(originalUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        safeUrl = originalUrl;
      }
    } catch {
      safeUrl = null;
    }
  }

  if (!safeUrl) {
    return res.status(400).send('Invalid URL');
  }

  // Record asynchronously; don't block the redirect.
  recordClick(token, safeUrl).catch((err) => {
    logger.error('Failed to record campaign click', { token, err: err?.message });
  });

  return res.redirect(302, safeUrl);
});

// GET /track/unsubscribe/:token — sets lead.unsubscribed + unsubscribedAt and
// returns a confirmation page. Invalid/used token -> confirmation page without
// leaking errors (edge case).
router.get('/unsubscribe/:token', async (req, res) => {
  const { token } = req.params;
  try {
    await recordUnsubscribe(token);
  } catch (err: any) {
    // Swallow errors — never expose details on the public confirmation page.
    logger.error('Failed to process unsubscribe', { token, err: err?.message });
  }

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>Descadastro confirmado</title></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:480px;margin:64px auto;padding:32px;background:#ffffff;border-radius:8px;text-align:center;"><h1 style="font-size:20px;color:#111827;margin:0 0 12px;">Descadastro confirmado</h1><p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0;">Você foi removido(a) da nossa lista de emails e não receberá mais campanhas. Caso tenha sido um engano, entre em contato com a empresa que lhe enviou esta mensagem.</p></div></body></html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

export default router;
