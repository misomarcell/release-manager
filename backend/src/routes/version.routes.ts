import { Router } from 'express';
import type { Request, Response } from 'express';
import { fetchLatestCommit } from '../services/github.service.js';

const router: Router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const version = await fetchLatestCommit();
    res.json(version);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch version';
    res.status(502).json({ error: message });
  }
});

export default router;
