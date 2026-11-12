import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getMetadata } from '../services/metadata.service.js';
import { tmdbService } from '../services/tmdb.service.js';
import { trackerService } from '../services/tracker.service.js';
import { isInLibrary } from '../repositories/jellyfin.repository.js';
import { qbittorrentService } from '../services/qbittorrent.service.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { DOWNLOAD_CATEGORIES } from 'shared/constants';
import { isTrackerId, type TitleReleasesResponse, type TrackerId } from 'shared/tracker.models';
import type { DownloadRequest, DownloadResponse } from 'shared/download.models';
import type { TitleSearchResponse } from 'shared/tmdb.models';
import { logger } from '../utils/logger.js';
import { sanitizeImdbId } from '../utils/release-parser.js';
import { MediaTypeSchema, parseBody, parseParams, parseQuery } from '../middleware/validate.js';

const TrackerSchema = z.custom<TrackerId>(isTrackerId, 'Unknown tracker');

const TrackerListSchema = z
    .string()
    .max(200)
    .default('')
    .transform((value) => value.split(',').filter(isTrackerId));

const SearchQuerySchema = z.object({
    category: z.enum(['all', 'movies', 'tv']).default('all'),
    search: z.string().max(200).default(''),
    page: z.coerce.number().int().min(1).default(1),
    uhd: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
    trackers: TrackerListSchema,
});

const TitleReleasesQuerySchema = z
    .object({
        imdbId: z.string().max(20).default('').transform(sanitizeImdbId),
        title: z.string().trim().max(200).default(''),
        year: z.string().max(4).default(''),
        type: MediaTypeSchema,
        trackers: TrackerListSchema,
    })
    .refine((query) => query.imdbId || query.title, 'An IMDb ID or a title is required');

const MetadataParamsSchema = z.object({
    tmdbId: z.coerce.number().int().positive('TMDB ID must be a positive integer'),
});

const MetadataQuerySchema = z.object({
    type: MediaTypeSchema,
});

const TitleSearchQuerySchema = z.object({
    q: z.string().trim().min(1, 'Search query is required').max(200),
    type: MediaTypeSchema.optional(),
});

const NfoParamsSchema = z.object({
    tracker: TrackerSchema,
    id: z.string().regex(/^\w{1,64}$/, 'Invalid NFO ID'),
});

const DownloadBodySchema = z.object({
    tracker: TrackerSchema,
    downloadRef: z.string().min(1, 'Download reference is required').max(2000),
    savePath: z
        .string()
        .min(1, 'Save path is required')
        .refine((p) => !p.includes('..'), 'Path traversal not allowed'),
    category: z.enum(DOWNLOAD_CATEGORIES),
}) satisfies z.ZodType<DownloadRequest>;

const router: Router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
    const query = parseQuery(SearchQuerySchema, req.query, res);
    if (!query) return;

    try {
        res.json(await trackerService.search(query));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Search failed';
        logger.error('Release search failed', { error: message });
        res.status(502).json({ error: message });
    }
});

router.get('/releases', requireAuth, async (req: Request, res: Response) => {
    const query = parseQuery(TitleReleasesQuerySchema, req.query, res);
    if (!query) return;

    const { releases, failures } = await trackerService.findTitle(
        { imdbId: query.imdbId, title: query.title, year: query.year, mediaType: query.type },
        query.trackers,
    );
    res.json({ releases, failures } satisfies TitleReleasesResponse);
});

router.get('/metadata/:tmdbId', requireAuth, async (req: Request, res: Response) => {
    const params = parseParams(MetadataParamsSchema, req.params, res);
    if (!params) return;
    const query = parseQuery(MetadataQuerySchema, req.query, res);
    if (!query) return;

    try {
        const { metadata } = await getMetadata({
            tmdbId: params.tmdbId,
            mediaType: query.type,
            title: '',
            year: '',
            imdbId: '',
        });
        if (!metadata) {
            res.status(404).json({ error: 'Detail metadata not found' });
            return;
        }
        res.json(metadata);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Metadata fetch failed';
        res.status(502).json({ error: message });
    }
});

router.get('/titles', requireAuth, async (req: Request, res: Response) => {
    const query = parseQuery(TitleSearchQuerySchema, req.query, res);
    if (!query) return;

    const titles = await tmdbService.searchTitles(query.q, query.type);
    const response: TitleSearchResponse = {
        results: titles.map((title) => ({
            ...title,
            inJellyfinLibrary: isInLibrary(title.tmdbId, title.title, title.year),
        })),
    };
    res.json(response);
});

router.get('/nfo/:tracker/:id', requireAuth, async (req: Request, res: Response) => {
    const params = parseParams(NfoParamsSchema, req.params, res);
    if (!params) return;

    try {
        const html = await trackerService.fetchNfo(params.tracker, params.id);
        if (html === null) {
            res.status(404).json({ error: 'This tracker has no NFO files' });
            return;
        }
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
        const torrent = await trackerService.getTorrent(body.tracker, body.downloadRef);
        if (torrent.kind === 'magnet') {
            await qbittorrentService.addMagnet(torrent.uri, body.savePath, body.category);
        } else {
            await qbittorrentService.addTorrent(torrent.data, body.savePath, body.category);
        }
        const response: DownloadResponse = { success: true, message: 'Torrent sent to qBittorrent' };
        res.json(response);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Download failed';
        logger.error('Torrent download failed', { error: message });
        res.status(502).json({ success: false, message } satisfies DownloadResponse);
    }
});

export default router;
