import { config } from '../config.js';
import { asRecord, asString } from '../utils/coerce.js';
import { getCachedOmdb, setCachedOmdb } from '../repositories/cache.repository.js';
import type { OmdbMetadata, NcoreOmdbLookup } from 'shared/ncore.models';

const OMDB_BASE_URL = 'https://www.omdbapi.com/';

function normalizeOmdbValue(value: unknown): string {
  const n = asString(value).trim();
  return n && n !== 'N/A' ? n : '';
}

function getOmdbCacheKey(lookup: NcoreOmdbLookup): string {
  if (lookup.imdbId) return `id:${lookup.imdbId}`;
  return `title:${lookup.title.trim().toLowerCase()}|year:${lookup.year}`;
}

function buildRequestUrl(apiKey: string, lookup: NcoreOmdbLookup): URL | null {
  if (!apiKey) return null;

  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('plot', 'short');

  if (lookup.imdbId) {
    url.searchParams.set('i', lookup.imdbId);
    return url;
  }

  if (!lookup.title) return null;
  url.searchParams.set('t', lookup.title);
  if (lookup.year) url.searchParams.set('y', lookup.year);
  return url;
}

interface OmdbFetchResult {
  metadata: OmdbMetadata | null;
  fromCache: boolean;
}

export async function fetchOmdbMetadata(lookup: NcoreOmdbLookup): Promise<OmdbFetchResult> {
  const cacheKey = getOmdbCacheKey(lookup);

  // Check PostgreSQL cache
  const cached = await getCachedOmdb(cacheKey);
  if (cached) return { metadata: cached, fromCache: true };

  const requestUrl = buildRequestUrl(config.omdb.apiKey, lookup);
  if (!requestUrl) return { metadata: null, fromCache: false };

  console.log('[OMDB]', requestUrl.toString());

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) return { metadata: null, fromCache: false };

    const payload = asRecord(await response.json());
    if (asString(payload['Response']) !== 'True') return { metadata: null, fromCache: false };

    const metadata: OmdbMetadata = {
      title: normalizeOmdbValue(payload['Title']) || lookup.title,
      year: normalizeOmdbValue(payload['Year']) || lookup.year,
      poster: normalizeOmdbValue(payload['Poster']),
      genre: normalizeOmdbValue(payload['Genre']),
      runtime: normalizeOmdbValue(payload['Runtime']),
      imdbRating: normalizeOmdbValue(payload['imdbRating']),
      rated: normalizeOmdbValue(payload['Rated']),
      plot: normalizeOmdbValue(payload['Plot']),
    };

    // Store in PostgreSQL cache
    await setCachedOmdb(cacheKey, metadata);
    return { metadata, fromCache: false };
  } catch {
    return { metadata: null, fromCache: false };
  }
}
