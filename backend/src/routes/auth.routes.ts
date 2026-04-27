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
import { logger } from '../utils/logger.js';

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
    const trimmed = username?.trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 32) {
      res.status(400).json({ error: 'Username must be between 3 and 32 characters' });
      return;
    }
    const options = await startRegistration(trimmed, req.ip ?? req.socket.remoteAddress, req.headers['user-agent']);
    res.json(options);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration start failed';
    const status = message === 'Username is already taken' ? 409 : 500;
    if (status === 409) {
      logger.warn('Registration start: username already taken', {
        username: (req.body as { username?: string }).username,
      });
    } else {
      logger.error('Registration start failed', { error: message });
    }
    res.status(status).json({ error: message });
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
    logger.info('User registered', { username });
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    logger.warn('Registration finish failed', {
      username: (req.body as { username?: string }).username,
      error: message,
    });
    res.status(400).json({ error: message });
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
    logger.info('User logged in', { username: result.username });
    res.cookie('session', result.token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      expires: result.expiresAt,
      path: '/',
    });
    res.json({ username: result.username, admin: result.admin });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    logger.warn('Login failed', { error: message });
    res.status(401).json({ error: message });
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
  res.json({ username: session.username, admin: session.admin });
});

export default router;
