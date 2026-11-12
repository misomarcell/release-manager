import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { normalizeKeywords, watchlistService } from '../services/watchlist.service.js';
import {
    deleteWatchlistItem,
    getWatchlistItem,
    getWatchlistItems,
    markWatchlistItemRead,
    updateWatchlistKeywords,
} from '../repositories/watchlist.repository.js';
import { MediaTypeSchema, TmdbIdSchema, parseBody, parseParams } from '../middleware/validate.js';
import {
    WATCHLIST_MAX_KEYWORDS,
    WATCHLIST_MAX_KEYWORD_LENGTH,
    type WatchlistAddRequest,
    type WatchlistCheckResponse,
    type WatchlistResponse,
    type WatchlistUpdateRequest,
} from 'shared/watchlist.models';

const KeywordsSchema = z
    .array(z.string().trim().min(1, 'Keyword cannot be empty').max(WATCHLIST_MAX_KEYWORD_LENGTH, 'Keyword is too long'))
    .max(WATCHLIST_MAX_KEYWORDS, `At most ${WATCHLIST_MAX_KEYWORDS} keywords are allowed`);

const AddBodySchema = z.object({
    tmdbId: TmdbIdSchema,
    mediaType: MediaTypeSchema,
    keywords: KeywordsSchema.default([]),
}) satisfies z.ZodType<WatchlistAddRequest>;

const UpdateBodySchema = z.object({
    keywords: KeywordsSchema,
}) satisfies z.ZodType<WatchlistUpdateRequest>;

const ItemParamsSchema = z.object({
    id: z.coerce.number().int().positive('Invalid watchlist item id'),
});

const router: Router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;

    try {
        res.json({ items: await getWatchlistItems(userId) } satisfies WatchlistResponse);
    } catch (err) {
        sendError(res, 'Watchlist: GET error', 'Failed to fetch watchlist', err);
    }
});

router.post('/', async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const body = parseBody(AddBodySchema, req.body, res);
    if (!body) return;

    try {
        const item = await watchlistService.addItem(userId, body);
        if (!item) {
            res.status(404).json({ error: 'Media not found' });
            return;
        }
        res.json(item);
    } catch (err) {
        sendError(res, 'Watchlist: add error', 'Failed to add to watchlist', err);
    }
});

router.post('/check', async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;

    try {
        res.json((await watchlistService.checkUser(userId)) satisfies WatchlistCheckResponse);
    } catch (err) {
        sendError(res, 'Watchlist: check error', 'Failed to check watchlist', err);
    }
});

router.patch('/:id', async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const params = parseParams(ItemParamsSchema, req.params, res);
    if (!params) return;
    const body = parseBody(UpdateBodySchema, req.body, res);
    if (!body) return;

    try {
        await updateWatchlistKeywords(userId, params.id, normalizeKeywords(body.keywords));
        const item = await getWatchlistItem(userId, params.id);
        if (!item) {
            res.status(404).json({ error: 'Watchlist item not found' });
            return;
        }
        res.json(item);
    } catch (err) {
        sendError(res, 'Watchlist: update error', 'Failed to update watchlist item', err);
    }
});

router.post('/:id/read', async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const params = parseParams(ItemParamsSchema, req.params, res);
    if (!params) return;

    try {
        await markWatchlistItemRead(userId, params.id);
        res.json({ ok: true });
    } catch (err) {
        sendError(res, 'Watchlist: mark read error', 'Failed to mark watchlist item as read', err);
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    const { userId } = (req as AuthenticatedRequest).user;
    const params = parseParams(ItemParamsSchema, req.params, res);
    if (!params) return;

    try {
        await deleteWatchlistItem(userId, params.id);
        res.json({ ok: true });
    } catch (err) {
        sendError(res, 'Watchlist: delete error', 'Failed to remove watchlist item', err);
    }
});

function sendError(res: Response, logMessage: string, message: string, err: unknown): void {
    logger.error(logMessage, { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: message });
}

export default router;
