import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getLibrary } from '../repositories/jellyfin.repository.js';
import { fetchBasicMetadata } from '../services/metadata.service.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { config } from '../config.js';
import type { LibraryItem, LibraryResponse } from 'shared/jellyfin.models';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = (req.query['search'] as string) ?? '';
    const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt((req.query['perPage'] as string) ?? '30', 10)));

    const { items, total } = await getLibrary(search, page, perPage);

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
      page,
      perPage,
      jellyfinBaseUrl: config.jellyfin.url,
    };

    res.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Library fetch failed';
    res.status(500).json({ error: message });
  }
});

export default router;
