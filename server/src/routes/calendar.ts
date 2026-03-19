import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { googleCalendarService } from '../services/googleCalendarService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// All calendar routes require authentication
router.use(authenticate);
router.use(tenantScope);

/**
 * GET /api/integrations/google/auth-url
 * Returns Google OAuth2 consent URL
 */
router.get('/google/auth-url', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const url = await googleCalendarService.getAuthUrl(req.user.userId, req.user.tenantId);
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/integrations/google/callback
 * Handles OAuth2 callback with authorization code
 */
router.get('/google/callback', async (req, res, next) => {
  try {
    const code = req.query.code as string;
    const stateRaw = req.query.state as string;

    if (!code) {
      return next(createError('Authorization code is required', 400));
    }

    let userId: string;
    let tenantId: string;

    if (stateRaw) {
      try {
        const state = JSON.parse(stateRaw);
        userId = state.userId;
        tenantId = state.tenantId;
      } catch {
        return next(createError('Invalid state parameter', 400));
      }
    } else if (req.user) {
      userId = req.user.userId;
      tenantId = req.user.tenantId;
    } else {
      return next(createError('Unable to determine user context', 400));
    }

    await googleCalendarService.handleCallback(code, userId, tenantId);

    // Redirect back to settings page with success indicator
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/app/settings?tab=integrations&google=connected`);
  } catch (error) {
    logger.error('Google Calendar callback failed', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/app/settings?tab=integrations&google=error`);
  }
});

/**
 * GET /api/integrations/google/status
 * Check connection status for current user
 */
router.get('/google/status', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const status = await googleCalendarService.getStatus(req.user.userId, req.user.tenantId);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/integrations/google/sync-toggle
 * Toggle sync on/off without disconnecting
 */
router.put('/google/sync-toggle', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { syncEnabled } = req.body;
    if (typeof syncEnabled !== 'boolean') {
      return next(createError('syncEnabled (boolean) is required', 400));
    }

    await googleCalendarService.toggleSync(req.user.userId, req.user.tenantId, syncEnabled);
    res.json({ syncEnabled });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/integrations/google/sync
 * Manual sync trigger — syncs all tasks with dueDate
 */
router.post('/google/sync', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const result = await googleCalendarService.syncAllTasks(req.user.userId, req.user.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/integrations/google/disconnect
 * Revoke tokens and remove connection
 */
router.delete('/google/disconnect', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await googleCalendarService.disconnect(req.user.userId, req.user.tenantId);
    res.json({ disconnected: true });
  } catch (error) {
    next(error);
  }
});

export default router;
