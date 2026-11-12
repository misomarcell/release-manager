import { getMetadata } from './metadata.service.js';
import { trackerService, type TitleLookup } from './tracker.service.js';
import {
    getAllWatchlistItems,
    getKnownReleases,
    getWatchlistItem,
    getWatchlistItems,
    releaseKey,
    saveCheckResult,
    upsertWatchlistItem,
} from '../repositories/watchlist.repository.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { logger } from '../utils/logger.js';
import type { TrackerFailure, TrackerId } from 'shared/tracker.models';
import type { WatchlistAddRequest, WatchlistCheckResponse, WatchlistItem } from 'shared/watchlist.models';

const CHECK_CONCURRENCY = 2;

interface CheckSummary {
    newReleases: number;
    failures: TrackerFailure[];
}

type LookupCache = Map<string, Promise<TitleLookup>>;

class WatchlistService {
    private running: Promise<number> | null = null;

    async addItem(userId: number, request: WatchlistAddRequest): Promise<WatchlistItem | null> {
        const { metadata } = await getMetadata({
            tmdbId: request.tmdbId,
            mediaType: request.mediaType,
            title: '',
            year: '',
            imdbId: '',
        });
        if (!metadata) return null;

        const id = await upsertWatchlistItem(userId, {
            tmdbId: metadata.tmdbId,
            mediaType: metadata.mediaType,
            title: metadata.title,
            year: metadata.year,
            poster: metadata.poster,
            imdbId: metadata.imdbId ?? '',
            keywords: normalizeKeywords(request.keywords),
        });

        const item = await getWatchlistItem(userId, id);
        if (item && !item.lastCheckedAt) {
            await this.checkItems([item]);
        }
        return getWatchlistItem(userId, id);
    }

    async checkUser(userId: number): Promise<WatchlistCheckResponse> {
        const { failures } = await this.checkItems(await getWatchlistItems(userId));
        return { items: await getWatchlistItems(userId), failures };
    }

    checkAll(): Promise<number> {
        this.running ??= this.doCheckAll().finally(() => {
            this.running = null;
        });
        return this.running;
    }

    private async doCheckAll(): Promise<number> {
        const items = await getAllWatchlistItems();
        if (items.length === 0) return 0;

        logger.info('[Watchlist] Release check started', { itemCount: items.length });
        const { newReleases, failures } = await this.checkItems(items);
        logger.info('[Watchlist] Release check completed', {
            itemCount: items.length,
            newReleases,
            failedTrackers: failures.map((failure) => failure.tracker),
        });
        return newReleases;
    }

    private async checkItems(items: WatchlistItem[]): Promise<CheckSummary> {
        const cache: LookupCache = new Map();
        const failed = new Map<TrackerId, TrackerFailure>();

        const counts = await mapConcurrent(items, CHECK_CONCURRENCY, async (item) => {
            try {
                const lookup = await this.lookup(item, cache);
                for (const failure of lookup.failures) failed.set(failure.tracker, failure);
                return await this.saveNewReleases(item, lookup);
            } catch (error: unknown) {
                logger.warn('[Watchlist] Release check failed', {
                    title: item.title,
                    error: error instanceof Error ? error.message : String(error),
                });
                return 0;
            }
        });
        return { newReleases: counts.reduce((sum, count) => sum + count, 0), failures: [...failed.values()] };
    }

    private lookup(item: WatchlistItem, cache: LookupCache): Promise<TitleLookup> {
        const key = `${item.mediaType}:${item.imdbId || `${item.title}|${item.year}`}`;
        let pending = cache.get(key);
        if (!pending) {
            pending = trackerService.findTitle(item);
            cache.set(key, pending);
        }
        return pending;
    }

    // A tracker's first successful check is its baseline: everything it lists then counts as already seen.
    private async saveNewReleases(item: WatchlistItem, lookup: TitleLookup): Promise<number> {
        const known = await getKnownReleases(item.id);
        const fresh = lookup.releases
            .filter((release) => release.torrentId && !known.keys.has(releaseKey(release.tracker, release.torrentId)))
            .map((release) => ({
                tracker: release.tracker,
                torrentId: release.torrentId,
                releaseName: release.releaseName,
                detailsUrl: release.detailsUrl,
                size: release.size,
                seen: !known.baselined.has(release.tracker) || !matchesKeywords(release.releaseName, item.keywords),
            }));

        await saveCheckResult(item.id, lookup.checked, fresh);
        return fresh.filter((release) => !release.seen).length;
    }
}

export function normalizeKeywords(keywords: string[]): string[] {
    const unique = new Map<string, string>();
    for (const keyword of keywords) {
        const trimmed = keyword.trim();
        if (trimmed && !unique.has(trimmed.toLowerCase())) unique.set(trimmed.toLowerCase(), trimmed);
    }
    return [...unique.values()];
}

function matchesKeywords(releaseName: string, keywords: string[]): boolean {
    if (keywords.length === 0) return true;
    const name = releaseName.toLowerCase();
    return keywords.some((keyword) => name.includes(keyword.toLowerCase()));
}

export const watchlistService = new WatchlistService();
