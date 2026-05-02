import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { getRecommendations } from '../services/recommendations.service.js';
import { fetchBasicMetadata, fetchDetailMetadata } from '../services/metadata.service.js';
import {
    upsertFeedback,
    deleteFeedback,
    invalidateCacheForFilter,
    getFeedbackForItem,
} from '../repositories/recommendations.repository.js';
import {
    MediaTypeSchema,
    FeedbackValueSchema,
    TmdbIdSchema,
    TmdbIdQuerySchema,
    parseBody,
    parseQuery,
} from '../middleware/validate.js';
import type { RecommendationFeedbackRequest } from 'shared/recommendations.models';

const RecommendationsQuerySchema = z.object({
    mediaType: MediaTypeSchema.optional(),
});

const FeedbackQuerySchema = z.object({
    tmdbId: TmdbIdQuerySchema,
    mediaType: MediaTypeSchema,
});

const FeedbackBodySchema = z.object({
    tmdbId: TmdbIdSchema,
    mediaType: MediaTypeSchema,
    feedback: FeedbackValueSchema,
}) satisfies z.ZodType<RecommendationFeedbackRequest>;

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).user;
    const query = parseQuery(RecommendationsQuerySchema, req.query, res);
    if (!query) return;

    try {
        const response = await getRecommendations(authUser.userId, query.mediaType ?? null);
        res.json({ ...response, canRefresh: authUser.admin ? response.canRefresh : false });
    } catch (err) {
        logger.error('Recommendations: GET error', { error: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

router.get('/feedback', requireAuth, async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const query = parseQuery(FeedbackQuerySchema, req.query, res);
    if (!query) return;

    try {
        const feedback = await getFeedbackForItem(userId, query.tmdbId, query.mediaType);
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
    const body = parseBody(FeedbackBodySchema, req.body, res);
    if (!body) return;

    const { metadata } = await fetchBasicMetadata({
        tmdbId: body.tmdbId,
        mediaType: body.mediaType,
        title: '',
        year: '',
        imdbId: '',
    });
    if (!metadata) {
        res.status(404).json({ error: 'Media not found' });
        return;
    }
    const detail = await fetchDetailMetadata(body.tmdbId, body.mediaType);
    const summary = [metadata.genre, metadata.year, detail?.plot ? detail.plot.slice(0, 120) : undefined]
        .filter(Boolean)
        .join(', ');

    try {
        await upsertFeedback(
            { tmdbId: body.tmdbId, mediaType: body.mediaType, title: metadata.title, summary, feedback: body.feedback },
            userId,
        );
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
    const query = parseQuery(FeedbackQuerySchema, req.query, res);
    if (!query) return;

    try {
        await deleteFeedback(userId, query.tmdbId, query.mediaType);
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
    const query = parseQuery(RecommendationsQuerySchema, req.query, res);
    if (!query) return;

    try {
        await invalidateCacheForFilter(userId, query.mediaType ?? null);
        const recommendations = await getRecommendations(userId, query.mediaType ?? null);
        res.json(recommendations);
    } catch (err) {
        logger.error('Recommendations: refresh error', { error: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'Failed to refresh recommendations' });
    }
});

export default router;
