import { config } from '../config.js';
import { asRecord, asString, asNumber, asBoolean } from '../utils/coerce.js';
import { buildMetadataLookup, isSameTitle, parseTvInfo } from '../utils/release-parser.js';
import {
    EMPTY_PAGE,
    type TorrentSource,
    type TrackerBrowseQuery,
    type TrackerPage,
    type TrackerProvider,
    type TrackerSearchQuery,
    type TrackerTitleQuery,
} from './tracker-provider.js';
import type { ReleaseCategory, TrackerRelease } from 'shared/tracker.models';

const SUPPORTED_CATEGORIES: Record<ReleaseCategory, string> = {
    all: 'hd_hun,hd,hdser_hun,hdser',
    movies: 'hd_hun,hd',
    tv: 'hdser_hun,hdser',
};

const SEARCH_ACCEPT = 'application/json,text/plain,*/*';
const HTML_ACCEPT = 'text/html,text/plain,*/*';
const TORRENT_ID_PATTERN = /^\d+$/;
const REQUEST_TIMEOUT_MS = 20_000;
const TITLE_MAX_PAGES = 5;

class NcoreNoResultsError extends Error {
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

type NcoreSearchField = 'name' | 'imdb';
type NcoreSortField = 'seeders' | 'fid';

interface NcoreSearchParams {
    category: ReleaseCategory;
    search: string;
    page: number;
    uhd?: boolean;
    searchIn?: NcoreSearchField;
    sortBy?: NcoreSortField;
}

class NcoreService implements TrackerProvider {
    readonly id = 'ncore';

    search(query: TrackerSearchQuery): Promise<TrackerPage> {
        return this.fetchPage(query);
    }

    browseTop(query: TrackerBrowseQuery): Promise<TrackerPage> {
        return this.fetchPage({ ...query, search: '' });
    }

    // By IMDb id when there is one; otherwise a name search narrowed to the same parsed title and year.
    async findTitle(title: TrackerTitleQuery): Promise<TrackerRelease[]> {
        const category = title.mediaType === 'tv' ? 'tv' : 'movies';
        if (title.imdbId) return this.fetchAllPages({ category, search: title.imdbId, searchIn: 'imdb' });
        if (!title.title) return [];

        const year = title.mediaType === 'tv' ? '' : title.year;
        const releases = await this.fetchAllPages({ category, search: title.title, searchIn: 'name' });
        return releases.filter((release) => isSameTitle(release.metadataLookup, title.title, year));
    }

    private async fetchAllPages(params: Omit<NcoreSearchParams, 'page' | 'sortBy'>): Promise<TrackerRelease[]> {
        const collected = new Map<string, TrackerRelease>();

        for (let page = 1; page <= TITLE_MAX_PAGES; page++) {
            const response = await this.fetchPage({ ...params, sortBy: 'fid', page });

            const sizeBefore = collected.size;
            for (const result of response.results) collected.set(result.torrentId, result);
            if (collected.size === sizeBefore || collected.size >= response.totalResults) break;
        }

        return [...collected.values()];
    }

    async getTorrent(downloadRef: string): Promise<TorrentSource> {
        const ncore = this.getRequiredConfig('Missing nCore credentials.');
        const url = this.getDownloadUrl(downloadRef, ncore.baseUrl);

        console.log('[nCore]', `Downloading torrent from ${url.toString()}`);

        const response = await fetch(url, {
            headers: { Cookie: this.getCookieHeader(ncore) },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) throw new Error(`Failed to download torrent file: ${response.status}`);
        return { kind: 'file', data: await response.arrayBuffer() };
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

    private async fetchPage(params: NcoreSearchParams): Promise<TrackerPage> {
        const ncore = this.getRequiredConfig('Missing nCore credentials. Set NCORE_USERNAME and NCORE_COOKIE_PASS.');
        const searchUrl = this.buildSearchUrl(params, ncore.baseUrl);
        const headers = { Cookie: this.getCookieHeader(ncore), Accept: SEARCH_ACCEPT };

        let rawBody: string;
        try {
            rawBody = await this.requestNcoreBody(searchUrl, headers, 'nCore request failed');
        } catch (error: unknown) {
            if (error instanceof NcoreNoResultsError) return EMPTY_PAGE;
            throw error;
        }

        const body = this.parseSearchJson(rawBody);
        return {
            results: this.records(body['results']).map((item) => this.toRelease(item, ncore.baseUrl)),
            totalResults: this.getTotalResults(body),
        };
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

    private buildSearchUrl(params: NcoreSearchParams, baseUrl: string): URL {
        const searchQuery = params.search.trim();
        const searchUrl = new URL('/torrents.php', baseUrl);
        searchUrl.searchParams.set('kivalasztott_tipus', SUPPORTED_CATEGORIES[params.category]);
        searchUrl.searchParams.set('tipus', 'kivalasztottak_kozott');
        searchUrl.searchParams.set('miszerint', params.sortBy ?? 'seeders');
        searchUrl.searchParams.set('hogyan', 'DESC');
        searchUrl.searchParams.set('tags', '');
        searchUrl.searchParams.set('jsons', 'true');

        if (searchQuery) {
            searchUrl.searchParams.set('mire', searchQuery);
            if (params.searchIn === 'imdb') {
                searchUrl.searchParams.set('miben', params.searchIn);
            }
        } else if (params.uhd) {
            searchUrl.searchParams.set('mire', '2160p');
        } else {
            searchUrl.searchParams.set('query', '*');
        }

        // nCore uses 'oldal' for page number.
        if (params.page > 1) {
            searchUrl.searchParams.set('oldal', String(params.page));
        }

        return searchUrl;
    }

    private async requestNcoreBody(url: URL, headers: Record<string, string>, errorPrefix: string): Promise<string> {
        console.log('[nCore]', url.toString());

        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

    private toRelease(item: Record<string, unknown>, baseUrl: string): TrackerRelease {
        const releaseName = asString(item['release_name']);
        const imdbId = asString(item['imdb_id']);
        const mediaType = asString(item['category']).startsWith('hdser') ? 'tv' : 'movie';

        return {
            tracker: this.id,
            torrentId: asString(item['torrent_id']),
            downloadRef: this.withBaseUrl(asString(item['download_url']), baseUrl),
            mediaType,
            releaseName,
            detailsUrl: this.withBaseUrl(asString(item['details_url']), baseUrl),
            freeleech: asBoolean(item['freeleech']),
            imdbId,
            size: asNumber(item['size']),
            seeders: asNumber(item['seeders']),
            leechers: asNumber(item['leechers']),
            metadataLookup: buildMetadataLookup(releaseName, imdbId, mediaType),
            tvInfo: parseTvInfo(releaseName),
        };
    }

    private getTotalResults(body: Record<string, unknown>): number {
        const total = Number.parseInt(asString(body['total_results']), 10);
        return Number.isFinite(total) ? total : 0;
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
