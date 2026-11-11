import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { recommendationsService } from '../services/recommendations.service.js';
import { getMetadata } from '../services/metadata.service.js';
import { upsertFeedback, deleteFeedback, getFeedbackForItem } from '../repositories/recommendations.repository.js';
import {
    MediaTypeSchema,
    FeedbackValueSchema,
    TmdbIdSchema,
    TmdbIdQuerySchema,
    parseBody,
    parseParams,
    parseQuery,
} from '../middleware/validate.js';
import type { RecommendationFeedbackRequest } from 'shared/recommendations.models';

const MediaTypeParamsSchema = z.object({
    mediaType: MediaTypeSchema,
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

const router: Router = Router();

router.get('/personalized/:mediaType', requireAuth, async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).user;
    const params = parseParams(MediaTypeParamsSchema, req.params, res);
    if (!params) return;

    try {
        const response = await recommendationsService.getPersonalizedRecommendations(authUser.userId, params.mediaType);
        res.json({ ...response, canRefresh: authUser.admin ? response.canRefresh : false });
    } catch (err) {
        logger.error('Recommendations: personalized GET error', {
            error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

router.get('/trending/:mediaType', requireAuth, async (req: Request, res: Response) => {
    const params = parseParams(MediaTypeParamsSchema, req.params, res);
    if (!params) return;

    try {
        const response = await recommendationsService.getTrendingRecommendations(params.mediaType);
        res.json(response);
    } catch (err) {
        logger.error('Recommendations: trending GET error', {
            error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: 'Failed to fetch trending recommendations' });
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

    try {
        const { metadata } = await getMetadata({
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
        await upsertFeedback(
            { tmdbId: body.tmdbId, mediaType: body.mediaType, title: metadata.title, feedback: body.feedback },
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

router.post('/personalized/:mediaType/refresh', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const params = parseParams(MediaTypeParamsSchema, req.params, res);
    if (!params) return;

    try {
        const recommendations = await recommendationsService.getPersonalizedRecommendations(
            userId,
            params.mediaType,
            true,
        );
        res.json(recommendations);
    } catch (err) {
        logger.error('Recommendations: refresh error', { error: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'Failed to refresh recommendations' });
    }
});

export default router;
