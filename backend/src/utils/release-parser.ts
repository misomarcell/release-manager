import type { MediaType, MetadataLookup } from 'shared/tmdb.models';
import type { TvInfo } from 'shared/tracker.models';

const RELEASE_STOP_TOKENS = new Set<string>([
    'AMZN',
    'APPLETV',
    'ATVP',
    'BLURAY',
    'BDRIP',
    'BDREMUX',
    'CAM',
    'COMPLETE',
    'DDP',
    'DDPA',
    'DDPLUS',
    'DL',
    'DSNP',
    'DTS',
    'DV',
    'DVDRIP',
    'DVDSCR',
    'EAC3',
    'EXTENDED',
    'FINAL',
    'HDR',
    'HDR10',
    'HDRIP',
    'HDTV',
    'HEVC',
    'HMAX',
    'HULU',
    'INTERNAL',
    'ITA',
    'MULTI',
    'NF',
    'NETFLIX',
    'PROPER',
    'RERIP',
    'REMUX',
    'REPACK',
    'SCR',
    'SEASON',
    'TRUEFRENCH',
    'UHD',
    'UNRATED',
    'WEB',
    'WEBDL',
    'WEBRIP',
    'X264',
    'X265',
    'X266',
    'H264',
    'H265',
    'H266',
    'AAC',
    'AC3',
    'DUBBED',
    'DUAL',
    'ENG',
    'EN',
    'HUN',
    'HU',
    'HUNGARIAN',
    'SUB',
    'SUBBED',
    'HARDSUB',
    'SOFTSUB',
    'READNFO',
    'NFO',
    'PROOFFIX',
    'REMASTERED',
    'IMAX',
]);

function normalize(token: string): string {
    return token.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function isYear(token: string): string {
    const n = normalize(token);
    return /^(19|20)\d{2}$/.test(n) ? n : '';
}

function isTerminator(token: string): boolean {
    const n = normalize(token);
    if (!n) return false;
    if (RELEASE_STOP_TOKENS.has(n)) return true;
    if (/^(480|576|720|1080|2160)P$/.test(n)) return true;
    if (/^S\d{1,2}(E\d{1,3}(E\d{1,3})?)?$/.test(n)) return true;
    if (/^S\d{1,2}S\d{1,2}$/.test(n)) return true;
    if (/^\d{1,2}BIT$/.test(n)) return true;
    return false;
}

export function parseTvInfo(releaseName: string): TvInfo | null {
    const upper = releaseName.toUpperCase();

    const episodeMatch = upper.match(/S(\d{1,2})E(\d{1,3})/);
    if (episodeMatch) {
        return {
            type: 'episode',
            season: parseInt(episodeMatch[1], 10),
            episode: parseInt(episodeMatch[2], 10),
        };
    }

    const multiSeasonMatch = upper.match(/S(\d{1,2})[.-]S(\d{1,2})/);
    if (multiSeasonMatch) {
        return { type: 'series', season: null, episode: null };
    }

    const seasonMatch = upper.match(/S(\d{1,2})(?!\d|E)/);
    if (seasonMatch) {
        return { type: 'season', season: parseInt(seasonMatch[1], 10), episode: null };
    }

    return null;
}

function toTitleCase(value: string): string {
    if (!value) return '';
    if (value !== value.toUpperCase()) return value;
    return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseReleaseName(releaseName: string): { title: string; year: string } {
    if (!releaseName) return { title: '', year: '' };

    const stripped = releaseName.replace(/-[^-.\s]+$/, '');
    const normalized = stripped.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = normalized.split(' ').filter(Boolean);

    const titleTokens: string[] = [];
    let year = '';

    for (const token of tokens) {
        const cleaned = token.replace(/^[([{]+|[)\]}]+$/g, '');
        if (!cleaned) continue;

        const y = isYear(cleaned);
        if (y) {
            year = y;
            break;
        }
        if (isTerminator(cleaned)) break;

        titleTokens.push(cleaned);
    }

    if (!year) {
        const m = normalized.match(/\b(19|20)\d{2}\b/);
        year = m?.[0] ?? '';
    }

    if (titleTokens.length === 0) {
        const fallback = tokens.filter((t) => {
            const c = t.replace(/^[([{]+|[)\]}]+$/g, '');
            return Boolean(c) && !isYear(c) && !isTerminator(c);
        });
        titleTokens.push(...fallback.slice(0, 6));
    }

    return { title: toTitleCase(titleTokens.join(' ').trim()), year };
}

export function sanitizeImdbId(value: string): string {
    const n = value.trim();
    return /^tt\d{5,10}$/i.test(n) ? n.toLowerCase() : '';
}

// Without an IMDb id the title alone is ambiguous, so the tracker's media type narrows the lookup.
export function buildMetadataLookup(releaseName: string, imdbId: string, mediaType: MediaType): MetadataLookup {
    const parsed = parseReleaseName(releaseName);
    const lookup: MetadataLookup = { imdbId: sanitizeImdbId(imdbId), title: parsed.title, year: parsed.year };
    return lookup.imdbId ? lookup : { ...lookup, mediaType };
}

export function isSameTitle(lookup: MetadataLookup, title: string, year: string): boolean {
    if (normalizeTitle(lookup.title) !== normalizeTitle(title)) return false;
    return !lookup.year || !year || lookup.year === year;
}

function normalizeTitle(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[^\p{L}\p{N}]/gu, '')
        .toLowerCase();
}
