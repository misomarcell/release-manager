import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { parseBody } from '../middleware/validate.js';
import { getSettings, updateSettings } from '../services/settings.service.js';

const UpdateBodySchema = z.object({
    values: z.record(z.string().max(64), z.string().max(4096).nullable()),
});

const router: Router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/', (_req: Request, res: Response) => {
    res.json(getSettings());
});

router.put('/', async (req: Request, res: Response) => {
    const body = parseBody(UpdateBodySchema, req.body, res);
    if (!body) return;

    await updateSettings(body.values, (req as AuthenticatedRequest).user.username);
    res.json(getSettings());
});

export default router;
