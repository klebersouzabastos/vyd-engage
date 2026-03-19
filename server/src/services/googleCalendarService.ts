import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';

// NOTE: googleapis package must be installed: cd server && npm install googleapis
// import { google } from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/integrations/google/callback';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/userinfo.email'];

/**
 * Lazy-load googleapis to avoid crash if not installed.
 * Returns null if the package is missing.
 */
async function loadGoogle() {
  try {
    const { google } = await import('googleapis');
    return google;
  } catch {
    logger.warn('googleapis package not installed — Google Calendar features disabled');
    return null;
  }
}

function createOAuth2Client(google: any) {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export const googleCalendarService = {
  /**
   * Generate Google OAuth2 consent URL
   */
  async getAuthUrl(userId: string, tenantId: string): Promise<string> {
    const google = await loadGoogle();
    if (!google) throw new Error('googleapis package not installed');

    const oauth2Client = createOAuth2Client(google);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: JSON.stringify({ userId, tenantId }),
    });
    return url;
  },

  /**
   * Handle OAuth2 callback: exchange code for tokens, store connection
   */
  async handleCallback(code: string, userId: string, tenantId: string) {
    const google = await loadGoogle();
    if (!google) throw new Error('googleapis package not installed');

    const oauth2Client = createOAuth2Client(google);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email || 'unknown';

    // Upsert calendar connection
    const connection = await prisma.calendarConnection.upsert({
      where: {
        tenantId_userId_provider: {
          tenantId,
          userId,
          provider: 'GOOGLE',
        },
      },
      update: {
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        email,
        syncEnabled: true,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        userId,
        provider: 'GOOGLE',
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        email,
        calendarId: 'primary',
        syncEnabled: true,
      },
    });

    logger.info(`Google Calendar connected for user ${userId}`, { email });
    return connection;
  },

  /**
   * Get connection status for a user
   */
  async getStatus(userId: string, tenantId: string) {
    const connection = await prisma.calendarConnection.findUnique({
      where: {
        tenantId_userId_provider: {
          tenantId,
          userId,
          provider: 'GOOGLE',
        },
      },
      select: {
        id: true,
        email: true,
        syncEnabled: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    if (!connection) {
      return { connected: false };
    }

    return {
      connected: true,
      email: connection.email,
      syncEnabled: connection.syncEnabled,
      lastSyncAt: connection.lastSyncAt,
      connectedAt: connection.createdAt,
    };
  },

  /**
   * Toggle sync on/off without disconnecting
   */
  async toggleSync(userId: string, tenantId: string, syncEnabled: boolean) {
    const connection = await prisma.calendarConnection.update({
      where: {
        tenantId_userId_provider: {
          tenantId,
          userId,
          provider: 'GOOGLE',
        },
      },
      data: { syncEnabled },
    });
    return connection;
  },

  /**
   * Disconnect Google Calendar (revoke + delete)
   */
  async disconnect(userId: string, tenantId: string) {
    const connection = await prisma.calendarConnection.findUnique({
      where: {
        tenantId_userId_provider: {
          tenantId,
          userId,
          provider: 'GOOGLE',
        },
      },
    });

    if (!connection) return;

    // Attempt to revoke token (best-effort)
    try {
      const google = await loadGoogle();
      if (google) {
        const oauth2Client = createOAuth2Client(google);
        oauth2Client.setCredentials({ access_token: connection.accessToken });
        await oauth2Client.revokeToken(connection.accessToken);
      }
    } catch (err) {
      logger.warn('Failed to revoke Google token (non-critical)', err);
    }

    await prisma.calendarConnection.delete({
      where: {
        tenantId_userId_provider: {
          tenantId,
          userId,
          provider: 'GOOGLE',
        },
      },
    });

    logger.info(`Google Calendar disconnected for user ${userId}`);
  },

  /**
   * Refresh the access token if expired. Returns updated oauth2Client.
   */
  async refreshTokenIfNeeded(connection: {
    id: string;
    accessToken: string;
    refreshToken: string;
  }) {
    const google = await loadGoogle();
    if (!google) return null;

    const oauth2Client = createOAuth2Client(google);
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
    });

    // Force refresh
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token && credentials.access_token !== connection.accessToken) {
        await prisma.calendarConnection.update({
          where: { id: connection.id },
          data: {
            accessToken: credentials.access_token,
            ...(credentials.refresh_token ? { refreshToken: credentials.refresh_token } : {}),
          },
        });
        oauth2Client.setCredentials(credentials);
      }
    } catch (err) {
      logger.error('Failed to refresh Google token', err);
      return null;
    }

    return oauth2Client;
  },

  /**
   * Create or update a Google Calendar event from a Task
   */
  async syncTask(task: {
    id: string;
    title: string;
    description?: string | null;
    dueDate?: Date | null;
    status?: string;
    googleEventId?: string | null;
  }, connection: {
    id: string;
    accessToken: string;
    refreshToken: string;
    calendarId: string;
  }) {
    // Only sync tasks that have a dueDate
    if (!task.dueDate) return;

    const google = await loadGoogle();
    if (!google) return;

    const oauth2Client = await this.refreshTokenIfNeeded(connection);
    if (!oauth2Client) return;

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const isCompleted = task.status === 'COMPLETED';
    const eventTitle = isCompleted ? `[Concluida] ${task.title}` : task.title;
    const dueDate = new Date(task.dueDate);

    const eventBody: any = {
      summary: eventTitle,
      description: task.description || '',
      start: {
        dateTime: dueDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
        timeZone: 'America/Sao_Paulo',
      },
      // Green for completed, blue for pending
      colorId: isCompleted ? '10' : '9',
    };

    try {
      let googleEventId = task.googleEventId;

      if (googleEventId) {
        // Update existing event
        await calendar.events.update({
          calendarId: connection.calendarId,
          eventId: googleEventId,
          requestBody: eventBody,
        });
        logger.debug(`Updated Google Calendar event ${googleEventId} for task ${task.id}`);
      } else {
        // Create new event
        const res = await calendar.events.insert({
          calendarId: connection.calendarId,
          requestBody: eventBody,
        });
        googleEventId = res.data.id;
        logger.debug(`Created Google Calendar event ${googleEventId} for task ${task.id}`);
      }

      // Store googleEventId on the task
      if (googleEventId) {
        await prisma.task.update({
          where: { id: task.id },
          data: { googleEventId },
        });
      }

      // Update lastSyncAt
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: new Date() },
      });
    } catch (err: any) {
      // Retry logic with exponential backoff (max 3 attempts)
      if (err?.code === 429 || err?.code === 503) {
        logger.warn(`Google Calendar rate limited for task ${task.id}, will retry`, { code: err.code });
        await this.retryWithBackoff(async () => {
          if (task.googleEventId) {
            await calendar.events.update({
              calendarId: connection.calendarId,
              eventId: task.googleEventId,
              requestBody: eventBody,
            });
          } else {
            await calendar.events.insert({
              calendarId: connection.calendarId,
              requestBody: eventBody,
            });
          }
        }, 3);
      } else {
        logger.error(`Failed to sync task ${task.id} to Google Calendar`, err);
      }
    }
  },

  /**
   * Delete a Google Calendar event
   */
  async deleteEvent(googleEventId: string, connection: {
    id: string;
    accessToken: string;
    refreshToken: string;
    calendarId: string;
  }) {
    const google = await loadGoogle();
    if (!google) return;

    const oauth2Client = await this.refreshTokenIfNeeded(connection);
    if (!oauth2Client) return;

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      await calendar.events.delete({
        calendarId: connection.calendarId,
        eventId: googleEventId,
      });
      logger.debug(`Deleted Google Calendar event ${googleEventId}`);
    } catch (err: any) {
      // 404/410 = already deleted, that's fine
      if (err?.code === 404 || err?.code === 410) {
        logger.debug(`Google Calendar event ${googleEventId} already deleted`);
        return;
      }
      logger.error(`Failed to delete Google Calendar event ${googleEventId}`, err);
    }
  },

  /**
   * Fire-and-forget sync for a task — called from taskService hooks
   */
  async syncTaskForUser(userId: string, tenantId: string, task: {
    id: string;
    title: string;
    description?: string | null;
    dueDate?: Date | null;
    status?: string;
    googleEventId?: string | null;
  }) {
    try {
      const connection = await prisma.calendarConnection.findUnique({
        where: {
          tenantId_userId_provider: {
            tenantId,
            userId,
            provider: 'GOOGLE',
          },
        },
      });

      if (!connection || !connection.syncEnabled) return;

      await this.syncTask(task, connection);
    } catch (err) {
      logger.error(`Calendar sync failed for task ${task.id}`, err);
    }
  },

  /**
   * Fire-and-forget delete for a task — called from taskService hooks
   */
  async deleteEventForUser(userId: string, tenantId: string, googleEventId: string | null | undefined) {
    if (!googleEventId) return;

    try {
      const connection = await prisma.calendarConnection.findUnique({
        where: {
          tenantId_userId_provider: {
            tenantId,
            userId,
            provider: 'GOOGLE',
          },
        },
      });

      if (!connection || !connection.syncEnabled) return;

      await this.deleteEvent(googleEventId, connection);
    } catch (err) {
      logger.error(`Calendar event delete failed for event ${googleEventId}`, err);
    }
  },

  /**
   * Retry helper with exponential backoff
   */
  async retryWithBackoff(fn: () => Promise<void>, maxRetries: number) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fn();
        return;
      } catch (err) {
        if (attempt === maxRetries) {
          logger.error(`Failed after ${maxRetries} retries`, err);
          return;
        }
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  },

  /**
   * Manual sync: sync all tasks with dueDate for a user
   */
  async syncAllTasks(userId: string, tenantId: string) {
    const connection = await prisma.calendarConnection.findUnique({
      where: {
        tenantId_userId_provider: {
          tenantId,
          userId,
          provider: 'GOOGLE',
        },
      },
    });

    if (!connection || !connection.syncEnabled) {
      throw new Error('No active Google Calendar connection');
    }

    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        dueDate: { not: null },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        googleEventId: true,
      },
    });

    let synced = 0;
    for (const task of tasks) {
      try {
        await this.syncTask(task, connection);
        synced++;
      } catch (err) {
        logger.error(`Failed to sync task ${task.id} during bulk sync`, err);
      }
    }

    return { synced, total: tasks.length };
  },
};
