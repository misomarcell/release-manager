import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getRecommendations } from '../services/recommendations.service.js';
import { upsertFeedback, invalidateCache } from '../repositories/recommendations.repository.js';
import type { RecommendationFeedbackRequest } from 'shared/recommendations.models';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const recommendations = await getRecommendations(userId);
    res.json(recommendations);
  } catch (err) {
    console.error('[Recommendations] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
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
    await invalidateCache(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Recommendations] feedback error:', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

router.post('/refresh', requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    await invalidateCache(userId);
    const recommendations = await getRecommendations(userId);
    res.json(recommendations);
  } catch (err) {
    console.error('[Recommendations] refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh recommendations' });
  }
});

export default router;
