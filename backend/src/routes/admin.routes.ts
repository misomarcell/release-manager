import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../db/connection.js';
import { qbittorrentService } from '../services/qbittorrent.service.js';
import { testConnection as testJellyfinConnection, runScheduledSync } from '../services/jellyfin.service.js';
import { getLastSyncStatus } from '../repositories/jellyfin.repository.js';
import { getLogs } from '../repositories/log.repository.js';
import { logger } from '../utils/logger.js';
import { parseQuery } from '../middleware/validate.js';

const LogsQuerySchema = z.object({
    level: z.enum(['info', 'warn', 'error']).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
});

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
        logger.error('Admin: failed to clear sessions', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to clear sessions' });
    }
});

router.get('/qbittorrent-test', async (_req: Request, res: Response) => {
    try {
        const result = await qbittorrentService.testConnection();
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
    const query_ = parseQuery(LogsQuerySchema, req.query, res);
    if (!query_) return;

    try {
        const result = await getLogs(query_.level ?? null, query_.limit, query_.offset);
        res.json(result);
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch logs' });
    }
});

export default router;
