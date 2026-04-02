import { config } from '../config.js';
import { asRecord, asString, asNumber } from '../utils/coerce.js';
import {
  getCachedMetadata,
  setCachedMetadata,
  getCachedDetailByTmdbId,
  updateCachedDetail,
} from '../repositories/cache.repository.js';
import {
  TMDB_GENRE_MAP,
  type MovieMetadata,
  type MovieDetailMetadata,
  type MetadataLookup,
} from 'shared/ncore.models';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

interface BasicFetchResult {
  metadata: MovieMetadata | null;
  fromCache: boolean;
}

export function getCacheKey(lookup: MetadataLookup): string {
  if (lookup.imdbId) return `id:${lookup.imdbId}`;
  return `title:${lookup.title.trim().toLowerCase()}|year:${lookup.year}`;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.tmdb.accessToken}`,
    Accept: 'application/json',
  };
}

async function tmdbGet(
  path: string,
  params?: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const url = new URL(`${TMDB_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  console.log('[TMDB]', url.toString());

  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return null;
    return asRecord(await res.json());
  } catch {
    return null;
  }
}

interface FindResult {
  id: number;
  type: 'movie' | 'tv';
  data: Record<string, unknown>;
}

function extractFromFindResponse(data: Record<string, unknown>): FindResult | null {
  const movieResults = Array.isArray(data['movie_results']) ? data['movie_results'] : [];
  if (movieResults.length > 0) {
    const rec = asRecord(movieResults[0]);
    const id = asNumber(rec['id']);
    if (id) return { id, type: 'movie', data: rec };
  }

  const tvResults = Array.isArray(data['tv_results']) ? data['tv_results'] : [];
  if (tvResults.length > 0) {
    const rec = asRecord(tvResults[0]);
    const id = asNumber(rec['id']);
    if (id) return { id, type: 'tv', data: rec };
  }

  return null;
}

function extractFromSearchResponse(
  data: Record<string, unknown>,
  type: 'movie' | 'tv',
): FindResult | null {
  const results = Array.isArray(data['results']) ? data['results'] : [];
  if (results.length > 0) {
    const rec = asRecord(results[0]);
    const id = asNumber(rec['id']);
    if (id) return { id, type, data: rec };
  }
  return null;
}

function extractYear(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : '';
}

function resolveGenres(genreIds: unknown[]): string {
  return genreIds
    .map((id) => TMDB_GENRE_MAP[asNumber(id) ?? 0])
    .filter(Boolean)
    .join(', ');
}

function buildBasicMetadata(item: FindResult, lookup: MetadataLookup): MovieMetadata {
  const d = item.data;
  const title = asString(d[item.type === 'movie' ? 'title' : 'name']) || lookup.title;
  const dateField = item.type === 'movie' ? 'release_date' : 'first_air_date';
  const year = extractYear(asString(d[dateField])) || lookup.year;

  const posterPath = asString(d['poster_path']);
  const poster = posterPath ? `${IMAGE_BASE}${posterPath}` : '';

  const genreIds = Array.isArray(d['genre_ids']) ? d['genre_ids'] : [];
  const genre = resolveGenres(genreIds);

  const voteAverage = asNumber(d['vote_average']);
  const rating = voteAverage ? String(Math.round(voteAverage * 10) / 10) : '';

  return {
    tmdbId: item.id,
    mediaType: item.type,
    title,
    year,
    poster,
    genre,
    rating,
    plot: '',
    runtime: '',
    rated: '',
  };
}

// In-flight deduplication for basic metadata
const inflightBasic = new Map<string, Promise<BasicFetchResult>>();

export async function fetchBasicMetadata(lookup: MetadataLookup): Promise<BasicFetchResult> {
  const cacheKey = getCacheKey(lookup);

  const existing = inflightBasic.get(cacheKey);
  if (existing) return existing;

  const promise = doFetchBasicMetadata(lookup, cacheKey).finally(() => {
    inflightBasic.delete(cacheKey);
  });

  inflightBasic.set(cacheKey, promise);
  return promise;
}

async function doFetchBasicMetadata(
  lookup: MetadataLookup,
  cacheKey: string,
): Promise<BasicFetchResult> {
  const cached = await getCachedMetadata(cacheKey);
  if (cached) return { metadata: cached, fromCache: true };

  if (!config.tmdb.accessToken) return { metadata: null, fromCache: false };

  let item: FindResult | null = null;

  if (lookup.imdbId) {
    const data = await tmdbGet(`/find/${encodeURIComponent(lookup.imdbId)}`, {
      external_source: 'imdb_id',
    });
    if (data) item = extractFromFindResponse(data);
  }

  if (!item && lookup.title) {
    const params: Record<string, string> = { query: lookup.title };
    if (lookup.year) params['year'] = lookup.year;

    const movieData = await tmdbGet('/search/movie', params);
    if (movieData) item = extractFromSearchResponse(movieData, 'movie');

    if (!item) {
      const tvParams: Record<string, string> = { query: lookup.title };
      if (lookup.year) tvParams['first_air_date_year'] = lookup.year;
      const tvData = await tmdbGet('/search/tv', tvParams);
      if (tvData) item = extractFromSearchResponse(tvData, 'tv');
    }
  }

  if (!item) return { metadata: null, fromCache: false };

  const metadata = buildBasicMetadata(item, lookup);
  await setCachedMetadata(cacheKey, metadata);
  return { metadata, fromCache: false };
}

function extractCertification(data: Record<string, unknown>, type: 'movie' | 'tv'): string {
  if (type === 'movie') {
    const releaseDates = asRecord(data['release_dates']);
    const results = Array.isArray(releaseDates['results']) ? releaseDates['results'] : [];
    for (const entry of results) {
      const e = asRecord(entry);
      if (asString(e['iso_3166_1']) === 'US') {
        const dates = Array.isArray(e['release_dates']) ? e['release_dates'] : [];
        for (const rd of dates) {
          const cert = asString(asRecord(rd)['certification']);
          if (cert) return cert;
        }
      }
    }
  } else {
    const contentRatings = asRecord(data['content_ratings']);
    const results = Array.isArray(contentRatings['results']) ? contentRatings['results'] : [];
    for (const entry of results) {
      const e = asRecord(entry);
      if (asString(e['iso_3166_1']) === 'US') {
        const r = asString(e['rating']);
        if (r) return r;
      }
    }
  }
  return '';
}

// In-flight deduplication for detail metadata
const inflightDetail = new Map<string, Promise<MovieDetailMetadata | null>>();

export async function fetchDetailMetadata(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
): Promise<MovieDetailMetadata | null> {
  const key = `${mediaType}:${tmdbId}`;

  const existing = inflightDetail.get(key);
  if (existing) return existing;

  const promise = doFetchDetailMetadata(tmdbId, mediaType).finally(() => {
    inflightDetail.delete(key);
  });

  inflightDetail.set(key, promise);
  return promise;
}

async function doFetchDetailMetadata(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
): Promise<MovieDetailMetadata | null> {
  const cached = await getCachedDetailByTmdbId(tmdbId);
  if (cached) return cached;

  if (!config.tmdb.accessToken) return null;

  const appendParam = mediaType === 'movie' ? 'release_dates' : 'content_ratings';
  const details = await tmdbGet(`/${mediaType}/${tmdbId}`, {
    append_to_response: appendParam,
  });
  if (!details) return null;

  let runtime = '';
  if (mediaType === 'movie') {
    const rt = asNumber(details['runtime']);
    if (rt) runtime = `${rt} min`;
  } else {
    const ert = Array.isArray(details['episode_run_time']) ? details['episode_run_time'] : [];
    if (ert.length > 0) {
      const rt = asNumber(ert[0]);
      if (rt) runtime = `${rt} min`;
    }
  }

  const plot = asString(details['overview']);
  const rated = extractCertification(details, mediaType);
  const dateField = mediaType === 'movie' ? 'release_date' : 'first_air_date';
  const releaseDate = asString(details[dateField]);

  const detail: MovieDetailMetadata = { plot, runtime, rated, releaseDate };
  await updateCachedDetail(tmdbId, detail);
  return detail;
}
