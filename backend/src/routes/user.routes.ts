import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { getAllUsers, setUserValid, setUserAdmin, deleteUser } from '../repositories/user.repository.js';
import { logger } from '../utils/logger.js';
import { parseBody, parseParams } from '../middleware/validate.js';

const UserIdParamsSchema = z.object({
    id: z.coerce.number().int().positive('Invalid user ID'),
});

const SetValidBodySchema = z.object({
    valid: z.boolean(),
});

const SetAdminBodySchema = z.object({
    admin: z.boolean(),
});

const router: Router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/', async (_req: Request, res: Response) => {
    try {
        const users = await getAllUsers();
        res.json(users);
    } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load users' });
    }
});

router.patch('/:id/valid', async (req: Request, res: Response) => {
    const params = parseParams(UserIdParamsSchema, req.params, res);
    if (!params) return;
    const body = parseBody(SetValidBodySchema, req.body, res);
    if (!body) return;

    const currentUser = (req as AuthenticatedRequest).user;
    if (currentUser.userId === params.id) {
        res.status(403).json({ error: 'Cannot change your own validity' });
        return;
    }

    try {
        const updated = await setUserValid(params.id, body.valid);
        if (!updated) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        logger.info('Admin: user validity changed', { userId: params.id, valid: body.valid, by: currentUser.username });
        res.json({ ok: true });
    } catch (error: unknown) {
        logger.error('Admin: failed to update user validity', {
            userId: params.id,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: error instanceof Error ? error.message : 'Update failed' });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    const params = parseParams(UserIdParamsSchema, req.params, res);
    if (!params) return;

    const currentUser = (req as AuthenticatedRequest).user;
    if (currentUser.userId === params.id) {
        res.status(403).json({ error: 'Cannot delete yourself' });
        return;
    }

    try {
        const deleted = await deleteUser(params.id);
        if (!deleted) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        logger.warn('Admin: user deleted', { userId: params.id, by: currentUser.username });
        res.json({ ok: true });
    } catch (error: unknown) {
        logger.error('Admin: failed to delete user', {
            userId: params.id,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: error instanceof Error ? error.message : 'Delete failed' });
    }
});

router.patch('/:id/admin', async (req: Request, res: Response) => {
    const params = parseParams(UserIdParamsSchema, req.params, res);
    if (!params) return;
    const body = parseBody(SetAdminBodySchema, req.body, res);
    if (!body) return;

    const currentUser = (req as AuthenticatedRequest).user;
    if (currentUser.userId === params.id) {
        res.status(403).json({ error: 'Cannot change your own admin status' });
        return;
    }

    try {
        const updated = await setUserAdmin(params.id, body.admin);
        if (!updated) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        logger.warn('Admin: user admin status changed', {
            userId: params.id,
            admin: body.admin,
            by: currentUser.username,
        });
        res.json({ ok: true });
    } catch (error: unknown) {
        logger.error('Admin: failed to update user admin status', {
            userId: params.id,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: error instanceof Error ? error.message : 'Update failed' });
    }
});

export default router;
