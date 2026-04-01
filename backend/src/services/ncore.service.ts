import { config } from '../config.js';
import { asRecord, asString, asNumber, asBoolean } from '../utils/coerce.js';
import { parseReleaseName, sanitizeImdbId, parseTvInfo } from '../utils/release-parser.js';
import type { NcoreCategoryKey, NcoreResult, NcoreOmdbLookup } from 'shared/ncore.models';

function getCookieHeader(): string {
  const { username, cookiePass } = config.ncore;
  return `nick=${encodeURIComponent(username)};pass=${encodeURIComponent(cookiePass)}`;
}

const SUPPORTED_CATEGORIES: Record<NcoreCategoryKey, string> = {
  all: 'hd_hun,hd,hdser_hun,hdser',
  movies: 'hd_hun,hd',
  tv: 'hdser_hun,hdser',
};

function withBaseUrl(value: string, baseUrl: string): string {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return new URL(value, baseUrl).toString();
}

function getCategoryKey(value: unknown): NcoreCategoryKey {
  if (typeof value === 'string' && value in SUPPORTED_CATEGORIES) return value as NcoreCategoryKey;
  return 'all';
}

function buildOmdbLookup(releaseName: string, imdbId: string): NcoreOmdbLookup {
  const parsed = parseReleaseName(releaseName);
  return { imdbId: sanitizeImdbId(imdbId), title: parsed.title, year: parsed.year };
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

export async function searchNcore(params: NcoreSearchParams): Promise<NcoreRawResponse> {
  const { username, cookiePass, baseUrl } = config.ncore;
  if (!username || !cookiePass) {
    throw new Error('Missing nCore credentials. Set NCORE_USERNAME and NCORE_COOKIE_PASS.');
  }

  const categoryKey = getCategoryKey(params.category);
  const category = SUPPORTED_CATEGORIES[categoryKey];
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 100));
  const searchQuery = params.search?.trim() || '';

  const searchUrl = new URL('/torrents.php', baseUrl);
  searchUrl.searchParams.set('kivalasztott_tipus', category);
  if (searchQuery) {
    searchUrl.searchParams.set('mire', searchQuery);
  } else if (params.uhd) {
    searchUrl.searchParams.set('mire', '2160p');
  } else {
    searchUrl.searchParams.set('query', '*');
  }
  searchUrl.searchParams.set('tipus', 'kivalasztottak_kozott');
  searchUrl.searchParams.set('miszerint', 'seeders');
  searchUrl.searchParams.set('hogyan', 'DESC');
  searchUrl.searchParams.set('tags', '');
  searchUrl.searchParams.set('jsons', 'true');

  // nCore uses 'oldal' for page number
  if (page > 1) {
    searchUrl.searchParams.set('oldal', String(page));
  }

  console.log('[nCore]', searchUrl.toString());

  const response = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      Cookie: getCookieHeader(),
      Accept: 'application/json,text/plain,*/*',
    },
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`nCore request failed: ${response.status} ${response.statusText}`);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    throw new Error('nCore returned non-JSON content');
  }

  const body = asRecord(parsedBody);
  const upstreamResults = Array.isArray(body['results']) ? body['results'] : [];
  const totalResults = parseInt(asString(body['total_results']) || '0', 10);

  const results: NcoreResult[] = upstreamResults
    .map((entry) => {
      const item = asRecord(entry);
      const releaseName = asString(item['release_name']);
      const imdbId = asString(item['imdb_id']);
      return {
        torrent_id: asString(item['torrent_id']),
        category: asString(item['category']),
        release_name: releaseName,
        details_url: withBaseUrl(asString(item['details_url']), baseUrl),
        download_url: withBaseUrl(asString(item['download_url']), baseUrl),
        freeleech: asBoolean(item['freeleech']),
        imdb_id: imdbId,
        imdb_rating: asString(item['imdb_rating']),
        size: asNumber(item['size']),
        type: asString(item['type']),
        leechers: asNumber(item['leechers']),
        seeders: asNumber(item['seeders']),
        omdb_lookup: buildOmdbLookup(releaseName, imdbId),
        tvInfo: parseTvInfo(releaseName),
        omdb: null,
        fromCache: false,
      };
    })
    .sort((a, b) => b.seeders - a.seeders);

  return { category: categoryKey, results, totalResults, page, perPage };
}

export async function fetchNfo(torrentId: string): Promise<string> {
  const { cookiePass, username, baseUrl } = config.ncore;
  if (!username || !cookiePass) {
    throw new Error('Missing nCore credentials.');
  }

  if (!/^\d+$/.test(torrentId)) {
    throw new Error('Invalid torrent ID.');
  }

  const nfoUrl = new URL('/ajax.php', baseUrl);
  nfoUrl.searchParams.set('action', 'nfo');
  nfoUrl.searchParams.set('id', torrentId);
  nfoUrl.searchParams.set('details', '1');

  console.log('[nCore]', nfoUrl.toString());

  const response = await fetch(nfoUrl, {
    method: 'GET',
    headers: {
      Cookie: getCookieHeader(),
      Accept: 'text/html,text/plain,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`nCore NFO request failed: ${response.status}`);
  }

  return response.text();
}

export async function downloadTorrentFile(downloadUrl: string): Promise<ArrayBuffer> {
  const { baseUrl } = config.ncore;

  const parsed = new URL(downloadUrl);
  const expected = new URL(baseUrl);
  if (parsed.hostname !== expected.hostname) {
    throw new Error('Download URL does not match the configured nCore domain.');
  }

  console.log('[nCore]', `Downloading torrent from ${downloadUrl}`);

  const response = await fetch(downloadUrl, {
    headers: { Cookie: getCookieHeader() },
  });

  if (!response.ok) throw new Error(`Failed to download torrent file: ${response.status}`);
  return response.arrayBuffer();
}
