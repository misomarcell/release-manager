import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/connection.js';
import { testConnection } from '../services/qbittorrent.service.js';

const router = Router();

router.use(requireAuth);

router.delete('/metadata-cache', async (_req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM metadata_cache');
    res.json({ deleted: result.rowCount ?? 0 });
  } catch (error: unknown) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Failed to clear metadata cache' });
  }
});

router.delete('/expired-data', async (_req: Request, res: Response) => {
  try {
    const challenges = await query('DELETE FROM challenges WHERE expires_at < NOW()');
    const sessions = await query('DELETE FROM sessions WHERE expires_at < NOW()');
    res.json({
      challenges: challenges.rowCount ?? 0,
      sessions: sessions.rowCount ?? 0,
    });
  } catch (error: unknown) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Failed to clear expired data' });
  }
});

router.get('/qbittorrent-test', async (_req: Request, res: Response) => {
  try {
    const result = await testConnection();
    res.json(result);
  } catch (error: unknown) {
    res
      .status(502)
      .json({ error: error instanceof Error ? error.message : 'Failed to reach qBittorrent' });
  }
});

export default router;
