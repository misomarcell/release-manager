import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../config.js';
import { asNumber, asRecord, asString } from '../utils/coerce.js';
import { buildMetadataLookup, parseTvInfo } from '../utils/release-parser.js';
import {
    EMPTY_PAGE,
    type TorrentSource,
    type TrackerPage,
    type TrackerProvider,
    type TrackerSearchQuery,
    type TrackerTitleQuery,
} from './tracker-provider.js';
import type { ReleaseCategory, ReleaseFilter, TrackerRelease } from 'shared/tracker.models';

// The Pirate Bay category ids: 207 HD movies, 211 UHD movies, 208 HD TV shows, 212 UHD TV shows.
const CATEGORY_IDS: Record<ReleaseCategory, string> = {
    all: '207,211,208,212',
    movies: '207,211',
    tv: '208,212',
};
const TV_CATEGORY_IDS = new Set(['208', '212']);
// apibay only matches whole words, and "blu-ray" or "blu ray" find nothing there.
const FILTER_KEYWORDS: Record<ReleaseFilter, string> = {
    uhd: '2160p',
    bluray: 'bluray',
};
const NO_RESULTS_ID = '0';
const DETAILS_URL = 'https://thepiratebay.org/description.php';
const INFO_HASH_PATTERN = /^[a-f0-9]{40}$/;
const MAGNET_TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.bittor.pw:1337/announce',
    'udp://public.popcorn-tracker.org:6969/announce',
    'udp://tracker.dler.org:6969/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://open.demonii.com:1337/announce',
];

const REQUEST_TIMEOUT_MS = 20_000;
const REQUEST_GAP_MS = 750;
const CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 5 * 60 * 1000;

interface CachedQuery {
    expiresAt: number;
    releases: Promise<TrackerRelease[]>;
}

class ApibayService implements TrackerProvider {
    readonly id = 'thepiratebay';

    private cache = new Map<string, CachedQuery>();
    private queue: Promise<unknown> = Promise.resolve();
    private blockedUntil = 0;

    async search(query: TrackerSearchQuery): Promise<TrackerPage> {
        if (query.page > 1) {
            return EMPTY_PAGE;
        }

        // Uploads without an IMDb id cannot be tied to a title reliably, so they are left out.
        const keywords = [...query.filters.map((filter) => FILTER_KEYWORDS[filter]), query.search].join(' ');
        const releases = (await this.query(keywords, CATEGORY_IDS[query.category])).filter((release) => release.imdbId);

        return { results: releases, totalResults: releases.length };
    }

    // No top list is taken from The Pirate Bay.
    browseTop(): Promise<TrackerPage> {
        return Promise.resolve(EMPTY_PAGE);
    }

    // Strictly by IMDb id: a name search here would mix in other titles.
    findTitle(title: TrackerTitleQuery): Promise<TrackerRelease[]> {
        if (!title.imdbId) return Promise.resolve([]);
        return this.query(title.imdbId, CATEGORY_IDS[title.mediaType === 'tv' ? 'tv' : 'movies']);
    }

    getTorrent(downloadRef: string): Promise<TorrentSource> {
        const infoHash = downloadRef.toLowerCase();
        if (!INFO_HASH_PATTERN.test(infoHash)) {
            return Promise.reject(new Error('Invalid torrent info hash.'));
        }

        const trackers = MAGNET_TRACKERS.map((tracker) => `&tr=${encodeURIComponent(tracker)}`).join('');
        return Promise.resolve({ kind: 'magnet', uri: `magnet:?xt=urn:btih:${infoHash}${trackers}` });
    }

    private query(search: string, category: string): Promise<TrackerRelease[]> {
        const url = new URL('/q.php', config.apibay.baseUrl);
        url.searchParams.set('q', search.trim());
        url.searchParams.set('cat', category);

        const key = url.toString();
        const now = Date.now();
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > now) return cached.releases;

        for (const [cachedKey, entry] of this.cache) {
            if (entry.expiresAt <= now) this.cache.delete(cachedKey);
        }

        const releases = this.enqueue(() => this.fetchReleases(url));
        this.cache.set(key, { expiresAt: now + CACHE_TTL_MS, releases });
        releases.catch(() => this.cache.delete(key));

        return releases;
    }

    /** apibay rate limits quickly: requests run one at a time with a pause in between. */
    private enqueue<T>(task: () => Promise<T>): Promise<T> {
        const result = this.queue.then(task);
        this.queue = result.catch(() => undefined).then(() => delay(REQUEST_GAP_MS));

        return result;
    }

    private async fetchReleases(url: URL): Promise<TrackerRelease[]> {
        if (Date.now() < this.blockedUntil) throw this.rateLimited();

        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }).catch((error: unknown) => {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`The Pirate Bay did not respond: ${reason}`);
        });

        if (response.status === 429) {
            this.blockedUntil = Date.now() + cooldownMs(response.headers.get('retry-after'));
            throw this.rateLimited();
        }
        if (!response.ok) {
            throw new Error(`The Pirate Bay request failed: ${response.status}`);
        }

        const rows: unknown = await response.json().catch(() => {
            throw new Error('The Pirate Bay returned non-JSON content');
        });
        return (Array.isArray(rows) ? rows : [])
            .map((row) => asRecord(row))
            .filter((row) => asString(row['id']) !== NO_RESULTS_ID)
            .map((row) => this.toRelease(row))
            .filter((release) => release.seeders > 0);
    }

    private rateLimited(): Error {
        const seconds = Math.max(1, Math.ceil((this.blockedUntil - Date.now()) / 1000));
        return new Error(`The Pirate Bay is rate limiting requests. Try again in ${seconds}s.`);
    }

    private toRelease(row: Record<string, unknown>): TrackerRelease {
        const torrentId = asString(row['id']);
        const releaseName = asString(row['name']).trim();
        const mediaType = TV_CATEGORY_IDS.has(asString(row['category'])) ? 'tv' : 'movie';
        const metadataLookup = buildMetadataLookup(releaseName, asString(row['imdb']), mediaType);

        return {
            tracker: this.id,
            torrentId,
            downloadRef: asString(row['info_hash']).toLowerCase(),
            mediaType,
            releaseName,
            detailsUrl: `${DETAILS_URL}?id=${encodeURIComponent(torrentId)}`,
            freeleech: false,
            imdbId: metadataLookup.imdbId,
            size: asNumber(row['size']),
            seeders: asNumber(row['seeders']),
            leechers: asNumber(row['leechers']),
            metadataLookup,
            tvInfo: parseTvInfo(releaseName),
        };
    }
}

function cooldownMs(retryAfter: string | null): number {
    const seconds = Number(retryAfter);
    if (!retryAfter || !Number.isFinite(seconds) || seconds <= 0) return DEFAULT_COOLDOWN_MS;
    return Math.min(seconds * 1000, MAX_COOLDOWN_MS);
}

export const apibayService = new ApibayService();
