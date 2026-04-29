import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../db/connection.js';
import { testConnection } from '../services/qbittorrent.service.js';
import { testConnection as testJellyfinConnection, runScheduledSync } from '../services/jellyfin.service.js';
import { getLastSyncStatus } from '../repositories/jellyfin.repository.js';
import { getLogs } from '../repositories/log.repository.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.delete('/metadata-cache', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM metadata_cache');
    const deleted = result.rowCount ?? 0;
    logger.info('Admin: metadata cache cleared', {
      deleted,
      by: (req as AuthenticatedRequest).user.username,
    });
    res.json({ deleted });
  } catch (error: unknown) {
    logger.error('Admin: failed to clear metadata cache', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to clear metadata cache' });
  }
});

router.delete('/expired-data', async (req: Request, res: Response) => {
  try {
    const challenges = await query('DELETE FROM challenges WHERE expires_at < NOW()');
    const sessions = await query('DELETE FROM sessions WHERE expires_at < NOW()');
    logger.info('Admin: expired data cleared', {
      challenges: challenges.rowCount ?? 0,
      sessions: sessions.rowCount ?? 0,
      by: (req as AuthenticatedRequest).user.username,
    });
    res.json({
      challenges: challenges.rowCount ?? 0,
      sessions: sessions.rowCount ?? 0,
    });
  } catch (error: unknown) {
    logger.error('Admin: failed to clear expired data', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to clear expired data' });
  }
});

router.delete('/sessions', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM sessions');
    const deleted = result.rowCount ?? 0;
    logger.warn('Admin: all sessions cleared', {
      deleted,
      by: (req as AuthenticatedRequest).user.username,
    });
    res.json({ deleted });
  } catch (error: unknown) {
    logger.error('Admin: failed to clear sessions', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to clear sessions' });
  }
});

router.get('/qbittorrent-test', async (_req: Request, res: Response) => {
  try {
    const result = await testConnection();
    res.json(result);
  } catch (error: unknown) {
    logger.error('Admin: qBittorrent connection test failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to reach qBittorrent' });
  }
});

router.get('/jellyfin-test', async (_req: Request, res: Response) => {
  try {
    const result = await testJellyfinConnection();
    res.json(result);
  } catch (error: unknown) {
    logger.error('Admin: Jellyfin connection test failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to reach Jellyfin' });
  }
});

router.get('/jellyfin-status', async (_req: Request, res: Response) => {
  try {
    const status = await getLastSyncStatus();
    res.json(status);
  } catch (error: unknown) {
    logger.error('Admin: failed to retrieve Jellyfin sync status', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to retrieve sync status' });
  }
});

router.post('/jellyfin-sync', async (req: Request, res: Response) => {
  logger.info('Admin: Jellyfin manual sync triggered', {
    by: (req as AuthenticatedRequest).user.username,
  });
  try {
    await runScheduledSync();
    const status = await getLastSyncStatus();
    res.json(status);
  } catch (error: unknown) {
    logger.error('Admin: Jellyfin manual sync failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({ error: error instanceof Error ? error.message : 'Jellyfin sync failed' });
  }
});

router.get('/logs', async (req: Request, res: Response) => {
  const level = (req.query['level'] as string) || null;
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '100', 10), 500);
  const offset = parseInt((req.query['offset'] as string) ?? '0', 10);

  const validLevels = ['info', 'warn', 'error'];
  if (level && !validLevels.includes(level)) {
    res.status(400).json({ error: 'Invalid level' });
    return;
  }

  try {
    const result = await getLogs(level, limit, offset);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch logs' });
  }
});

export default router;
