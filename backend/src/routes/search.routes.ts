import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { searchNcore, fetchNfo } from '../services/ncore.service.js';
import { fetchBasicMetadata, getCacheKey, fetchDetailMetadata } from '../services/metadata.service.js';
import { addTorrent } from '../services/qbittorrent.service.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { DOWNLOAD_CATEGORIES } from 'shared/constants';
import type { NcoreResult, NcoreSearchResponse } from 'shared/ncore.models';
import type { DownloadResponse } from 'shared/download.models';
import type { MetadataLookup } from 'shared/tmdb.models';
import { logger } from '../utils/logger.js';
import { MediaTypeSchema, parseBody, parseParams, parseQuery } from '../middleware/validate.js';

const SearchQuerySchema = z.object({
    category: z.enum(['all', 'movies', 'tv']).default('all'),
    search: z.string().default(''),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(200).default(100),
    uhd: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
});

const MetadataParamsSchema = z.object({
    tmdbId: z.coerce.number().int().positive('TMDB ID must be a positive integer'),
});

const MetadataQuerySchema = z.object({
    type: MediaTypeSchema,
});

const NfoParamsSchema = z.object({
    id: z.string().min(1, 'NFO ID is required'),
});

const DownloadBodySchema = z.object({
    downloadUrl: z.url('Invalid download URL'),
    savePath: z.string().min(1, 'Save path is required'),
    category: z.enum(DOWNLOAD_CATEGORIES),
});

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
    const query = parseQuery(SearchQuerySchema, req.query, res);
    if (!query) return;

    try {
        const ncoreResult = await searchNcore(query);

        // Deduplicate by metadata lookup key
        const uniqueLookups = new Map<string, MetadataLookup>();
        for (const result of ncoreResult.results) {
            const key = getCacheKey(result.metadata_lookup);
            if (!uniqueLookups.has(key)) {
                uniqueLookups.set(key, result.metadata_lookup);
            }
        }

        // Fetch basic metadata once per unique key (6 concurrent)
        const metadataMap = new Map<string, { metadata: NcoreResult['metadata']; fromCache: boolean }>();
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
        logger.error('nCore search failed', { error: message });
        res.status(502).json({ error: message });
    }
});

router.get('/metadata/:tmdbId', requireAuth, async (req: Request, res: Response) => {
    const params = parseParams(MetadataParamsSchema, req.params, res);
    if (!params) return;
    const query = parseQuery(MetadataQuerySchema, req.query, res);
    if (!query) return;

    try {
        const detail = await fetchDetailMetadata(params.tmdbId, query.type);
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
    const params = parseParams(NfoParamsSchema, req.params, res);
    if (!params) return;

    try {
        const html = await fetchNfo(params.id);
        res.type('html').send(html);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'NFO fetch failed';
        res.status(502).json({ error: message });
    }
});

router.post('/download', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const body = parseBody(DownloadBodySchema, req.body, res);
    if (!body) return;

    try {
        await addTorrent(body.downloadUrl, body.savePath, body.category);
        const response: DownloadResponse = { success: true, message: 'Torrent sent to qBittorrent' };
        res.json(response);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Download failed';
        logger.error('Torrent download failed', { error: message });
        res.status(502).json({ success: false, message } satisfies DownloadResponse);
    }
});

export default router;
