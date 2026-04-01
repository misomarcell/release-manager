import { Router } from 'express';
import type { Request, Response } from 'express';
import { searchNcore, fetchNfo } from '../services/ncore.service.js';
import { fetchOmdbMetadata } from '../services/omdb.service.js';
import { addTorrent } from '../services/qbittorrent.service.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { requireAuth } from '../middleware/auth.js';
import type {
  NcoreResult,
  NcoreSearchResponse,
  DownloadRequest,
  DownloadResponse,
} from 'shared/ncore.models';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const category = (req.query['category'] as string) ?? 'movies';
    const search = (req.query['search'] as string) ?? '';
    const page = parseInt((req.query['page'] as string) ?? '1', 10);
    const perPage = parseInt((req.query['perPage'] as string) ?? '100', 10);
    const uhd = req.query['uhd'] === 'true';

    const ncoreResult = await searchNcore({ category, search, page, perPage, uhd });

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

router.get('/nfo/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const html = await fetchNfo(req.params['id'] as string);
    res.type('html').send(html);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'NFO fetch failed';
    res.status(502).json({ error: message });
  }
});

router.post('/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const { downloadUrl, savePath, category } = req.body as DownloadRequest;
    if (!downloadUrl || !savePath || !category) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }
    if (category !== 'movies' && category !== 'tv') {
      res.status(400).json({ success: false, message: 'Invalid category' });
      return;
    }

    await addTorrent(downloadUrl, savePath, category);
    const response: DownloadResponse = { success: true, message: 'Torrent sent to qBittorrent' };
    res.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Download failed';
    res.status(502).json({ success: false, message } satisfies DownloadResponse);
  }
});

export default router;
