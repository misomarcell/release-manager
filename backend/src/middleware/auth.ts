import type { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth.service.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.['session'] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const session = await validateSession(token);
  if (!session) {
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }

  (req as AuthenticatedRequest).user = session;
  next();
}

export interface AuthenticatedRequest extends Request {
  user: { userId: number; username: string };
}
