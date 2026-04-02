import { config } from '../config.js';
import { asRecord, asString, asNumber } from '../utils/coerce.js';
import { getCachedMetadata, setCachedMetadata } from '../repositories/cache.repository.js';
import type { MovieMetadata, MetadataLookup } from 'shared/ncore.models';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

interface MetadataFetchResult {
  metadata: MovieMetadata | null;
  fromCache: boolean;
}

function getCacheKey(lookup: MetadataLookup): string {
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

interface TmdbItem {
  id: number;
  type: 'movie' | 'tv';
}

async function findByImdbId(imdbId: string): Promise<TmdbItem | null> {
  const data = await tmdbGet(`/find/${encodeURIComponent(imdbId)}`, {
    external_source: 'imdb_id',
  });
  if (!data) return null;

  const movieResults = Array.isArray(data['movie_results']) ? data['movie_results'] : [];
  if (movieResults.length > 0) {
    const id = asNumber(asRecord(movieResults[0])['id']);
    if (id) return { id, type: 'movie' };
  }

  const tvResults = Array.isArray(data['tv_results']) ? data['tv_results'] : [];
  if (tvResults.length > 0) {
    const id = asNumber(asRecord(tvResults[0])['id']);
    if (id) return { id, type: 'tv' };
  }

  return null;
}

async function searchByTitle(title: string, year: string): Promise<TmdbItem | null> {
  const params: Record<string, string> = { query: title };
  if (year) params['year'] = year;

  const movieData = await tmdbGet('/search/movie', params);
  if (movieData) {
    const results = Array.isArray(movieData['results']) ? movieData['results'] : [];
    if (results.length > 0) {
      const id = asNumber(asRecord(results[0])['id']);
      if (id) return { id, type: 'movie' };
    }
  }

  const tvParams: Record<string, string> = { query: title };
  if (year) tvParams['first_air_date_year'] = year;

  const tvData = await tmdbGet('/search/tv', tvParams);
  if (tvData) {
    const results = Array.isArray(tvData['results']) ? tvData['results'] : [];
    if (results.length > 0) {
      const id = asNumber(asRecord(results[0])['id']);
      if (id) return { id, type: 'tv' };
    }
  }

  return null;
}

function extractYear(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : '';
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

export async function fetchMetadata(lookup: MetadataLookup): Promise<MetadataFetchResult> {
  const cacheKey = getCacheKey(lookup);

  const cached = await getCachedMetadata(cacheKey);
  if (cached) return { metadata: cached, fromCache: true };

  if (!config.tmdb.accessToken) return { metadata: null, fromCache: false };

  let item: TmdbItem | null = null;

  if (lookup.imdbId) {
    item = await findByImdbId(lookup.imdbId);
  }

  if (!item && lookup.title) {
    item = await searchByTitle(lookup.title, lookup.year);
  }

  if (!item) return { metadata: null, fromCache: false };

  const appendParam = item.type === 'movie' ? 'release_dates' : 'content_ratings';
  const details = await tmdbGet(`/${item.type}/${item.id}`, {
    append_to_response: appendParam,
  });
  if (!details) return { metadata: null, fromCache: false };

  const title = asString(details[item.type === 'movie' ? 'title' : 'name']) || lookup.title;
  const dateField = item.type === 'movie' ? 'release_date' : 'first_air_date';
  const year = extractYear(asString(details[dateField])) || lookup.year;

  const posterPath = asString(details['poster_path']);
  const poster = posterPath ? `${IMAGE_BASE}${posterPath}` : '';

  const genres = Array.isArray(details['genres'])
    ? (details['genres'] as unknown[])
        .map((g) => asString(asRecord(g)['name']))
        .filter(Boolean)
        .join(', ')
    : '';

  let runtime = '';
  if (item.type === 'movie') {
    const rt = asNumber(details['runtime']);
    if (rt) runtime = `${rt} min`;
  } else {
    const ert = Array.isArray(details['episode_run_time']) ? details['episode_run_time'] : [];
    if (ert.length > 0) {
      const rt = asNumber(ert[0]);
      if (rt) runtime = `${rt} min`;
    }
  }

  const voteAverage = asNumber(details['vote_average']);
  const rating = voteAverage ? String(Math.round(voteAverage * 10) / 10) : '';

  const plot = asString(details['overview']);
  const rated = extractCertification(details, item.type);

  const metadata: MovieMetadata = {
    title,
    year,
    poster,
    genre: genres,
    runtime,
    rating,
    rated,
    plot,
  };

  await setCachedMetadata(cacheKey, metadata);
  return { metadata, fromCache: false };
}
