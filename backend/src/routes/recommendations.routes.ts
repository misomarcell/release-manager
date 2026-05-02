import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getRecommendations } from '../services/recommendations.service.js';
import {
    upsertFeedback,
    deleteFeedback,
    invalidateCacheForFilter,
    getFeedbackForItem,
} from '../repositories/recommendations.repository.js';
import type { RecommendationFeedbackRequest } from 'shared/recommendations.models';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).user;
    const rawFilter = req.query['mediaType'];
    const filter = rawFilter === 'movie' || rawFilter === 'tv' ? rawFilter : null;
    try {
        const response = await getRecommendations(authUser.userId, filter);
        res.json({ ...response, canRefresh: authUser.admin ? response.canRefresh : false });
    } catch (err) {
        logger.error('Recommendations: GET error', { error: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

router.get('/feedback', requireAuth, async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const tmdbId = Number(req.query['tmdbId']);
    const mediaType = req.query['mediaType'];
    if (!Number.isFinite(tmdbId) || tmdbId <= 0 || (mediaType !== 'movie' && mediaType !== 'tv')) {
        res.status(400).json({ error: 'Invalid parameters' });
        return;
    }
    try {
        const feedback = await getFeedbackForItem(userId, tmdbId, mediaType);
        res.json({ feedback });
    } catch (err) {
        logger.error('Recommendations: feedback GET error', {
            error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

router.post('/feedback', requireAuth, async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const body = req.body as Partial<RecommendationFeedbackRequest>;

    if (
        typeof body.tmdbId !== 'number' ||
        !body.mediaType ||
        !['movie', 'tv'].includes(body.mediaType) ||
        typeof body.title !== 'string' ||
        typeof body.summary !== 'string' ||
        !body.feedback ||
        !['like', 'dislike'].includes(body.feedback)
    ) {
        res.status(400).json({ error: 'Invalid feedback payload' });
        return;
    }

    try {
        await upsertFeedback(body as RecommendationFeedbackRequest, userId);
        res.json({ ok: true });
    } catch (err) {
        logger.error('Recommendations: feedback save error', {
            error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

router.delete('/feedback', requireAuth, async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const tmdbId = Number(req.query['tmdbId']);
    const mediaType = req.query['mediaType'];
    if (!Number.isFinite(tmdbId) || tmdbId <= 0 || (mediaType !== 'movie' && mediaType !== 'tv')) {
        res.status(400).json({ error: 'Invalid parameters' });
        return;
    }
    try {
        await deleteFeedback(userId, tmdbId, mediaType);
        res.json({ ok: true });
    } catch (err) {
        logger.error('Recommendations: feedback DELETE error', {
            error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Failed to delete feedback' });
    }
});

router.post('/refresh', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const rawFilter = req.query['mediaType'];
    const filter = rawFilter === 'movie' || rawFilter === 'tv' ? rawFilter : null;
    try {
        await invalidateCacheForFilter(userId, filter);
        const recommendations = await getRecommendations(userId, filter);
        res.json(recommendations);
    } catch (err) {
        logger.error('Recommendations: refresh error', { error: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'Failed to refresh recommendations' });
    }
});

export default router;
