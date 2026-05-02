import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getLibrary } from '../repositories/jellyfin.repository.js';
import { fetchBasicMetadata } from '../services/metadata.service.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { config } from '../config.js';
import type { LibraryItem, LibraryResponse } from 'shared/jellyfin.models';
import { parseQuery } from '../middleware/validate.js';

const LibraryQuerySchema = z.object({
    search: z.string().max(200).default(''),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(30),
});

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
    const query = parseQuery(LibraryQuerySchema, req.query, res);
    if (!query) return;

    try {
        const { items, total } = await getLibrary(query.search, query.page, query.perPage);

        const enriched = await mapConcurrent(items, 6, async (item): Promise<LibraryItem> => {
            if (!item.tmdbId || !item.mediaType) return item;
            const { metadata } = await fetchBasicMetadata({
                tmdbId: item.tmdbId,
                mediaType: item.mediaType,
                title: item.title,
                year: item.year ?? '',
                imdbId: '',
            });
            if (!metadata) return item;
            return {
                ...item,
                poster: metadata.poster || null,
                genre: metadata.genre || null,
                rating: metadata.rating || null,
            };
        });

        const response: LibraryResponse = {
            items: enriched,
            total,
            page: query.page,
            perPage: query.perPage,
            jellyfinBaseUrl: config.jellyfin.url,
        };

        res.json(response);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Library fetch failed';
        res.status(500).json({ error: message });
    }
});

export default router;
