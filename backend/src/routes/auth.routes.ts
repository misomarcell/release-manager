import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
    startRegistration,
    finishRegistration,
    startAuthentication,
    finishAuthentication,
    logout,
    validateSession,
} from '../services/auth.service.js';
import { logger } from '../utils/logger.js';
import { parseBody } from '../middleware/validate.js';

const RegisterStartSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters')
        .max(32, 'Username must be at most 32 characters')
        .regex(/^[a-zA-Z0-9_\- ]+$/, 'Username may only contain letters, numbers, spaces, hyphens and underscores'),
});

const RegisterFinishSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    response: z.record(z.string(), z.unknown()),
});

const LoginFinishSchema = z.object({
    response: z.record(z.string(), z.unknown()),
});

const router: Router = Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
});

router.use(authLimiter);

router.post('/register/start', async (req: Request, res: Response) => {
    const body = parseBody(RegisterStartSchema, req.body, res);
    if (!body) return;

    try {
        const options = await startRegistration(body.username, req.ip, req.headers['user-agent']);
        res.json(options);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Registration start failed';
        const status = message === 'Username is already taken' ? 409 : 500;
        if (status === 409) {
            logger.warn('Registration start: username already taken', { username: body.username });
        } else {
            logger.error('Registration start failed', { error: message });
        }
        res.status(status).json({ error: message });
    }
});

router.post('/register/finish', async (req: Request, res: Response) => {
    const body = parseBody(RegisterFinishSchema, req.body, res);
    if (!body) return;

    try {
        const result = await finishRegistration(body.username, body.response as never);
        logger.info('User registered', { username: body.username });
        res.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Registration failed';
        logger.warn('Registration finish failed', { username: body.username, error: message });
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
    const body = parseBody(LoginFinishSchema, req.body, res);
    if (!body) return;

    try {
        const result = await finishAuthentication(body.response as never, req.ip, req.headers['user-agent']);
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
    if (!token || token.length > 512) {
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
