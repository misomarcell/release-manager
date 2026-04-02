import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { getAllUsers, setUserValid, deleteUser } from '../repositories/user.repository.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error: unknown) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Failed to load users' });
  }
});

router.patch('/:id/valid', async (req: Request, res: Response) => {
  const userId = parseInt(req.params['id'] as string, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  const { valid } = req.body as { valid?: boolean };
  if (typeof valid !== 'boolean') {
    res.status(400).json({ error: 'Valid must be a boolean' });
    return;
  }

  const currentUser = (req as AuthenticatedRequest).user;
  if (currentUser.userId === userId) {
    res.status(403).json({ error: 'Cannot change your own validity' });
    return;
  }

  try {
    const updated = await setUserValid(userId, valid);
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Update failed' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = parseInt(req.params['id'] as string, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  const currentUser = (req as AuthenticatedRequest).user;
  if (currentUser.userId === userId) {
    res.status(403).json({ error: 'Cannot delete yourself' });
    return;
  }

  try {
    const deleted = await deleteUser(userId);
    if (!deleted) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Delete failed' });
  }
});

export default router;
