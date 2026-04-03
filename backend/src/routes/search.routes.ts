import { Router } from 'express';
import type { Request, Response } from 'express';
import { searchNcore, fetchNfo } from '../services/ncore.service.js';
import { fetchBasicMetadata, getCacheKey, fetchDetailMetadata } from '../services/tmdb.service.js';
import { addTorrent } from '../services/qbittorrent.service.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { requireAuth } from '../middleware/auth.js';
import {
  DOWNLOAD_CATEGORIES,
  type NcoreResult,
  type NcoreSearchResponse,
  type DownloadRequest,
  type DownloadResponse,
  type MetadataLookup,
} from 'shared/ncore.models';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const category = (req.query['category'] as string) ?? 'all';
    const search = (req.query['search'] as string) ?? '';
    const page = parseInt((req.query['page'] as string) ?? '1', 10);
    const perPage = parseInt((req.query['perPage'] as string) ?? '100', 10);
    const uhd = req.query['uhd'] === 'true';

    const ncoreResult = await searchNcore({ category, search, page, perPage, uhd });

    // Deduplicate by metadata lookup key
    const uniqueLookups = new Map<string, MetadataLookup>();
    for (const result of ncoreResult.results) {
      const key = getCacheKey(result.metadata_lookup);
      if (!uniqueLookups.has(key)) {
        uniqueLookups.set(key, result.metadata_lookup);
      }
    }

    // Fetch basic metadata once per unique key (6 concurrent)
    const metadataMap = new Map<
      string,
      { metadata: NcoreResult['metadata']; fromCache: boolean }
    >();
    await mapConcurrent([...uniqueLookups.entries()], 6, async ([key, lookup]) => {
      const result = await fetchBasicMetadata(lookup);
      metadataMap.set(key, { metadata: result.metadata, fromCache: result.fromCache });
    });

    // Apply metadata to all results
    const enriched: NcoreResult[] = ncoreResult.results.map((result) => {
      const key = getCacheKey(result.metadata_lookup);
      const meta = metadataMap.get(key);
      return {
        ...result,
        metadata: meta?.metadata ?? null,
        fromCache: meta?.fromCache ?? false,
      };
    });

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

router.get('/metadata/:tmdbId', requireAuth, async (req: Request, res: Response) => {
  try {
    const tmdbId = parseInt(req.params['tmdbId'] as string, 10);
    const mediaType = req.query['type'] as string;

    if (!tmdbId || isNaN(tmdbId)) {
      res.status(400).json({ error: 'Invalid TMDB ID' });
      return;
    }
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      res.status(400).json({ error: 'Invalid type' });
      return;
    }

    const detail = await fetchDetailMetadata(tmdbId, mediaType);
    if (!detail) {
      res.status(404).json({ error: 'Detail metadata not found' });
      return;
    }

    res.json(detail);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Metadata fetch failed';
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
    if (!(DOWNLOAD_CATEGORIES as readonly string[]).includes(category)) {
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
