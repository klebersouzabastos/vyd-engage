import { Router } from 'express';
import { emailTrackingService } from '../services/emailTrackingService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Open pixel - returns 1x1 transparent GIF and records the open
router.get('/open/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    // Record open asynchronously - don't block the response
    emailTrackingService.recordOpen(token, ipAddress, userAgent).catch(err => {
      logger.error('Failed to record email open', { token, err: err.message });
    });

    // Always return the pixel, even if tracking fails
    const gif = emailTrackingService.getPixelGif();
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': String(gif.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(gif);
  } catch {
    // Fail silently - always return a valid image
    const gif = emailTrackingService.getPixelGif();
    res.set('Content-Type', 'image/gif');
    res.end(gif);
  }
});

// Click redirect - records the click and redirects to the original URL
router.get('/click/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing url parameter');
    }

    // Validate URL to prevent open redirect attacks
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).send('Invalid URL');
      }
    } catch {
      return res.status(400).send('Invalid URL');
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    // Record click asynchronously - don't block the redirect
    emailTrackingService.recordClick(token, url, ipAddress, userAgent).catch(err => {
      logger.error('Failed to record email click', { token, url, err: err.message });
    });

    // Redirect to the original URL
    res.redirect(302, url);
  } catch {
    // If anything fails, try to redirect anyway
    const { url } = req.query;
    if (url && typeof url === 'string') {
      res.redirect(302, url);
    } else {
      res.status(500).send('Tracking error');
    }
  }
});

export default router;
