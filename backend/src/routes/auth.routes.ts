import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
  logout,
  validateSession,
} from '../services/auth.service.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

router.use(authLimiter);

router.post('/register/start', async (req: Request, res: Response) => {
  try {
    const { username } = req.body as { username?: string };
    if (!username?.trim()) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }
    const options = await startRegistration(username.trim());
    res.json(options);
  } catch (error: unknown) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Registration start failed' });
  }
});

router.post('/register/finish', async (req: Request, res: Response) => {
  try {
    const { username, response } = req.body as { username?: string; response?: unknown };
    if (!username || !response) {
      res.status(400).json({ error: 'Username and response are required' });
      return;
    }
    const result = await finishRegistration(username, response as never);
    res.json(result);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Registration failed' });
  }
});

router.post('/login/start', async (_req: Request, res: Response) => {
  try {
    const options = await startAuthentication();
    res.json(options);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Login start failed' });
  }
});

router.post('/login/finish', async (req: Request, res: Response) => {
  try {
    const { response } = req.body as { response?: unknown };
    if (!response) {
      res.status(400).json({ error: 'Response is required' });
      return;
    }
    const result = await finishAuthentication(response as never);
    res.cookie('session', result.token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      expires: result.expiresAt,
      path: '/',
    });
    res.json({ username: result.username });
  } catch (error: unknown) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'Login failed' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.['session'] as string | undefined;
  if (token) await logout(token);
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.['session'] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const session = await validateSession(token);
  if (!session) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }
  res.json({ username: session.username });
});

export default router;
