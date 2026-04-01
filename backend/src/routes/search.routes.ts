import { Router } from 'express';
import type { Request, Response } from 'express';
import { searchNcore } from '../services/ncore.service.js';
import { fetchOmdbMetadata } from '../services/omdb.service.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { requireAuth } from '../middleware/auth.js';
import type { NcoreResult, NcoreSearchResponse } from 'shared/ncore.models';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const category = (req.query['category'] as string) ?? 'movies';
    const search = (req.query['search'] as string) ?? '';
    const page = parseInt((req.query['page'] as string) ?? '1', 10);
    const perPage = parseInt((req.query['perPage'] as string) ?? '15', 10);

    const ncoreResult = await searchNcore({ category, search, page, perPage });

    // Enrich with OMDB metadata (6 concurrent)
    const enriched = await mapConcurrent(
      ncoreResult.results,
      6,
      async (result): Promise<NcoreResult> => {
        const omdbResult = await fetchOmdbMetadata(result.omdb_lookup);
        return {
          ...result,
          omdb: omdbResult.metadata,
          fromCache: omdbResult.fromCache,
        };
      },
    );

    const response: NcoreSearchResponse = {
      category: ncoreResult.category,
      results: enriched,
      totalResults: ncoreResult.totalResults,
      page: ncoreResult.page,
      perPage: ncoreResult.perPage,
    };

    res.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Search failed';
    res.status(502).json({ error: message });
  }
});

export default router;
