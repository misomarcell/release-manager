import { ncoreService, NcoreNoResultsError } from './ncore.service.js';
import { getMetadata } from './metadata.service.js';
import {
    getAllWatchlistItems,
    getKnownTorrentIds,
    getWatchlistItem,
    getWatchlistItems,
    saveCheckResult,
    upsertWatchlistItem,
} from '../repositories/watchlist.repository.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { logger } from '../utils/logger.js';
import type { NcoreResult, NcoreSearchResponse } from 'shared/ncore.models';
import type { WatchlistAddRequest, WatchlistItem } from 'shared/watchlist.models';

const MAX_PAGES = 5;
const CHECK_CONCURRENCY = 2;

type ReleaseCache = Map<string, Promise<NcoreResult[]>>;

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

    async checkUser(userId: number): Promise<WatchlistItem[]> {
        await this.checkItems(await getWatchlistItems(userId));
        return getWatchlistItems(userId);
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
        const found = await this.checkItems(items);
        logger.info('[Watchlist] Release check completed', { itemCount: items.length, newReleases: found });
        return found;
    }

    private async checkItems(items: WatchlistItem[]): Promise<number> {
        const cache: ReleaseCache = new Map();
        const counts = await mapConcurrent(items, CHECK_CONCURRENCY, async (item) => {
            try {
                return await this.checkItem(item, cache);
            } catch (error: unknown) {
                logger.warn('[Watchlist] Release check failed', {
                    title: item.title,
                    error: error instanceof Error ? error.message : String(error),
                });
                return 0;
            }
        });
        return counts.reduce((sum, count) => sum + count, 0);
    }

    private async checkItem(item: WatchlistItem, cache: ReleaseCache): Promise<number> {
        const key = `${item.mediaType}:${item.imdbId || `${item.title}|${item.year}`}`;
        let pending = cache.get(key);
        if (!pending) {
            pending = this.fetchReleases(item);
            cache.set(key, pending);
        }

        const releases = await pending;
        const known = await getKnownTorrentIds(item.id);
        const isBaseline = item.lastCheckedAt === null;
        const fresh = releases
            .filter((release) => release.torrent_id && !known.has(release.torrent_id))
            .map((release) => ({
                torrentId: release.torrent_id,
                releaseName: release.release_name,
                detailsUrl: release.details_url,
                size: release.size,
                seen: isBaseline || !matchesKeywords(release.release_name, item.keywords),
            }));

        await saveCheckResult(item.id, fresh);
        return fresh.filter((release) => !release.seen).length;
    }

    private async fetchReleases(item: WatchlistItem): Promise<NcoreResult[]> {
        const byImdb = Boolean(item.imdbId);
        const collected = new Map<string, NcoreResult>();

        for (let page = 1; page <= MAX_PAGES; page++) {
            const response = await this.fetchPage(item, page);
            if (!response) break;

            const sizeBefore = collected.size;
            for (const result of response.results) collected.set(result.torrent_id, result);
            if (collected.size === sizeBefore || collected.size >= response.totalResults) break;
        }

        const releases = [...collected.values()];
        return byImdb ? releases : releases.filter((release) => isSameTitle(release, item));
    }

    private async fetchPage(item: WatchlistItem, page: number): Promise<NcoreSearchResponse | null> {
        const byImdb = Boolean(item.imdbId);
        try {
            return await ncoreService.search({
                category: item.mediaType === 'tv' ? 'tv' : 'movies',
                search: byImdb ? item.imdbId : item.title,
                searchIn: byImdb ? 'imdb' : 'name',
                sortBy: 'fid',
                page,
            });
        } catch (error: unknown) {
            if (error instanceof NcoreNoResultsError) return null;
            throw error;
        }
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

function isSameTitle(release: NcoreResult, item: WatchlistItem): boolean {
    const { title, year } = release.metadata_lookup;
    if (normalizeTitle(title) !== normalizeTitle(item.title)) return false;
    return item.mediaType === 'tv' || !year || !item.year || year === item.year;
}

function normalizeTitle(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[^\p{L}\p{N}]/gu, '')
        .toLowerCase();
}

export const watchlistService = new WatchlistService();
