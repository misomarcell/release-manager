import { config } from '../config.js';
import { asRecord, asString, asNumber, asBoolean } from '../utils/coerce.js';
import { parseReleaseName, sanitizeImdbId, parseTvInfo } from '../utils/release-parser.js';
import type { NcoreCategoryKey, NcoreResult } from 'shared/ncore.models';
import type { MetadataLookup } from 'shared/tmdb.models';

const SUPPORTED_CATEGORIES: Record<NcoreCategoryKey, string> = {
    all: 'hd_hun,hd,hdser_hun,hdser',
    movies: 'hd_hun,hd',
    tv: 'hdser_hun,hdser',
};

const SEARCH_ACCEPT = 'application/json,text/plain,*/*';
const HTML_ACCEPT = 'text/html,text/plain,*/*';
const TORRENT_ID_PATTERN = /^\d+$/;

export class NcoreNoResultsError extends Error {
    constructor() {
        super('No results found');
        this.name = 'NcoreNoResultsError';
    }
}

interface NcoreConfig {
    username: string;
    cookiePass: string;
    baseUrl: string;
}

interface NormalizedSearchParams {
    categoryKey: NcoreCategoryKey;
    category: string;
    page: number;
    perPage: number;
    searchQuery: string;
    uhdOnly: boolean;
}

interface NcoreSearchParams {
    category?: string;
    search?: string;
    page?: number;
    perPage?: number;
    uhd?: boolean;
}

interface NcoreRawResponse {
    category: NcoreCategoryKey;
    results: NcoreResult[];
    totalResults: number;
    page: number;
    perPage: number;
}

class NcoreService {
    async search(params: NcoreSearchParams): Promise<NcoreRawResponse> {
        const ncore = this.getRequiredConfig('Missing nCore credentials. Set NCORE_USERNAME and NCORE_COOKIE_PASS.');
        const context = this.normalizeSearchParams(params);
        const searchUrl = this.buildSearchUrl(context, ncore.baseUrl);

        const rawBody = await this.requestNcoreBody(
            searchUrl,
            {
                Cookie: this.getCookieHeader(ncore),
                Accept: SEARCH_ACCEPT,
            },
            'nCore request failed',
        );

        const body = this.parseSearchJson(rawBody);

        return {
            category: context.categoryKey,
            results: this.mapTorrentResults(body, ncore.baseUrl),
            totalResults: this.getTotalResults(body),
            page: context.page,
            perPage: context.perPage,
        };
    }

    async fetchNfo(torrentId: string): Promise<string> {
        const ncore = this.getRequiredConfig('Missing nCore credentials.');
        if (!TORRENT_ID_PATTERN.test(torrentId)) {
            throw new Error('Invalid torrent ID.');
        }

        const nfoUrl = new URL('/ajax.php', ncore.baseUrl);
        nfoUrl.searchParams.set('action', 'nfo');
        nfoUrl.searchParams.set('id', torrentId);
        nfoUrl.searchParams.set('details', '1');

        return this.requestNcoreBody(
            nfoUrl,
            {
                Cookie: this.getCookieHeader(ncore),
                Accept: HTML_ACCEPT,
            },
            'nCore NFO request failed',
        );
    }

    async downloadTorrentFile(downloadUrl: string): Promise<ArrayBuffer> {
        const ncore = this.getRequiredConfig('Missing nCore credentials.');
        const url = this.getDownloadUrl(downloadUrl, ncore.baseUrl);

        console.log('[nCore]', `Downloading torrent from ${url.toString()}`);

        const response = await fetch(url, {
            headers: { Cookie: this.getCookieHeader(ncore) },
        });

        if (!response.ok) throw new Error(`Failed to download torrent file: ${response.status}`);
        return response.arrayBuffer();
    }

    private getRequiredConfig(message: string): NcoreConfig {
        const { username, cookiePass, baseUrl } = config.ncore;
        if (!username || !cookiePass) {
            throw new Error(message);
        }

        return { username, cookiePass, baseUrl };
    }

    private getCookieHeader(ncore: NcoreConfig): string {
        return `nick=${encodeURIComponent(ncore.username)};pass=${encodeURIComponent(ncore.cookiePass)}`;
    }

    private normalizeSearchParams(params: NcoreSearchParams): NormalizedSearchParams {
        const categoryKey = this.getCategoryKey(params.category);

        return {
            categoryKey,
            category: SUPPORTED_CATEGORIES[categoryKey],
            page: Math.max(1, params.page ?? 1),
            perPage: Math.min(100, Math.max(1, params.perPage ?? 100)),
            searchQuery: params.search?.trim() || '',
            uhdOnly: params.uhd === true,
        };
    }

    private getCategoryKey(value: unknown): NcoreCategoryKey {
        if (typeof value === 'string' && value in SUPPORTED_CATEGORIES) return value as NcoreCategoryKey;
        return 'all';
    }

    private buildSearchUrl(context: NormalizedSearchParams, baseUrl: string): URL {
        const searchUrl = new URL('/torrents.php', baseUrl);
        searchUrl.searchParams.set('kivalasztott_tipus', context.category);
        searchUrl.searchParams.set('tipus', 'kivalasztottak_kozott');
        searchUrl.searchParams.set('miszerint', 'seeders');
        searchUrl.searchParams.set('hogyan', 'DESC');
        searchUrl.searchParams.set('tags', '');
        searchUrl.searchParams.set('jsons', 'true');

        if (context.searchQuery) {
            searchUrl.searchParams.set('mire', context.searchQuery);
        } else if (context.uhdOnly) {
            searchUrl.searchParams.set('mire', '2160p');
        } else {
            searchUrl.searchParams.set('query', '*');
        }

        // nCore uses 'oldal' for page number.
        if (context.page > 1) {
            searchUrl.searchParams.set('oldal', String(context.page));
        }

        return searchUrl;
    }

    private async requestNcoreBody(url: URL, headers: Record<string, string>, errorPrefix: string): Promise<string> {
        console.log('[nCore]', url.toString());

        const response = await fetch(url, {
            method: 'GET',
            headers,
        });

        const body = await response.text();
        if (body.includes('Nincs találat!')) throw new NcoreNoResultsError();
        if (!response.ok) {
            const status = response.statusText ? `${response.status} ${response.statusText}` : String(response.status);
            throw new Error(`${errorPrefix}: ${status}`);
        }

        return body;
    }

    private parseSearchJson(rawBody: string): Record<string, unknown> {
        try {
            return asRecord(JSON.parse(rawBody));
        } catch {
            throw new Error('nCore returned non-JSON content');
        }
    }

    private mapTorrentResults(body: Record<string, unknown>, baseUrl: string): NcoreResult[] {
        return this.records(body['results'])
            .map((item) => this.toNcoreResult(item, baseUrl))
            .sort((a, b) => b.seeders - a.seeders);
    }

    private toNcoreResult(item: Record<string, unknown>, baseUrl: string): NcoreResult {
        const releaseName = asString(item['release_name']);
        const imdbId = asString(item['imdb_id']);

        return {
            torrent_id: asString(item['torrent_id']),
            category: asString(item['category']),
            release_name: releaseName,
            details_url: this.withBaseUrl(asString(item['details_url']), baseUrl),
            download_url: this.withBaseUrl(asString(item['download_url']), baseUrl),
            freeleech: asBoolean(item['freeleech']),
            imdb_id: imdbId,
            imdb_rating: asString(item['imdb_rating']),
            size: asNumber(item['size']),
            type: asString(item['type']),
            leechers: asNumber(item['leechers']),
            seeders: asNumber(item['seeders']),
            metadata_lookup: this.buildMetadataLookup(releaseName, imdbId),
            tvInfo: parseTvInfo(releaseName),
            metadata: null,
            fromCache: false,
        };
    }

    private getTotalResults(body: Record<string, unknown>): number {
        const total = Number.parseInt(asString(body['total_results']), 10);
        return Number.isFinite(total) ? total : 0;
    }

    private buildMetadataLookup(releaseName: string, imdbId: string): MetadataLookup {
        const parsed = parseReleaseName(releaseName);
        return { imdbId: sanitizeImdbId(imdbId), title: parsed.title, year: parsed.year };
    }

    private withBaseUrl(value: string, baseUrl: string): string {
        if (!value) return '';

        try {
            return new URL(value, baseUrl).toString();
        } catch {
            return '';
        }
    }

    private getDownloadUrl(downloadUrl: string, baseUrl: string): URL {
        let parsed: URL;
        try {
            parsed = new URL(downloadUrl, baseUrl);
        } catch {
            throw new Error('Invalid download URL.');
        }

        const expected = new URL(baseUrl);
        if (parsed.hostname !== expected.hostname) {
            throw new Error('Download URL does not match the configured nCore domain.');
        }

        return parsed;
    }

    private records(value: unknown): Record<string, unknown>[] {
        return Array.isArray(value) ? value.map((item) => asRecord(item)) : [];
    }
}

export const ncoreService = new NcoreService();
