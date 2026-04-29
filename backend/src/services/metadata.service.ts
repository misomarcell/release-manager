import {
  tmdbFetchBasic,
  tmdbFetchDetail,
  tmdbFetchExternalData,
  tmdbFetchTopRated,
  tmdbSearchRecommendation,
} from './tmdb.service.js';
import {
  getCachedMetadata,
  setCachedMetadata,
  getCachedDetailByTmdbId,
  updateCachedDetail,
  getCachedBasicByTmdbId,
} from '../repositories/cache.repository.js';
import { isInLibrary } from '../repositories/jellyfin.repository.js';
import { mapConcurrent } from '../utils/concurrent.js';
import type { MovieMetadata, MovieDetailMetadata, MetadataLookup } from 'shared/tmdb.models';
import type { Recommendation } from 'shared/recommendations.models';

interface BasicFetchResult {
  metadata: MovieMetadata | null;
  fromCache: boolean;
}

export function getCacheKey(lookup: MetadataLookup): string {
  if (lookup.imdbId) return `id:${lookup.imdbId}`;
  return `title:${lookup.title.trim().toLowerCase()}|year:${lookup.year}`;
}

// ── Basic metadata ─────────────────────────────────────────────────────────────

const inflightBasic = new Map<string, Promise<BasicFetchResult>>();

export async function fetchBasicMetadata(lookup: MetadataLookup): Promise<BasicFetchResult> {
  const cacheKey =
    lookup.tmdbId && lookup.mediaType ? `tmdbid:${lookup.mediaType}:${lookup.tmdbId}` : getCacheKey(lookup);

  const existing = inflightBasic.get(cacheKey);
  if (existing) return existing;

  const promise = doFetchBasicMetadata(lookup, cacheKey).finally(() => {
    inflightBasic.delete(cacheKey);
  });

  inflightBasic.set(cacheKey, promise);
  return promise;
}

async function doFetchBasicMetadata(lookup: MetadataLookup, cacheKey: string): Promise<BasicFetchResult> {
  if (lookup.tmdbId && lookup.mediaType) {
    const byId = await getCachedBasicByTmdbId(lookup.tmdbId, lookup.mediaType);
    if (byId) {
      byId.inJellyfinLibrary = isInLibrary(byId.tmdbId, byId.title, byId.year);
      return { metadata: byId, fromCache: true };
    }
  }

  const cached = await getCachedMetadata(cacheKey);
  if (cached) {
    cached.inJellyfinLibrary = isInLibrary(cached.tmdbId, cached.title, cached.year);
    return { metadata: cached, fromCache: true };
  }

  const metadata = await tmdbFetchBasic(lookup);
  if (!metadata) return { metadata: null, fromCache: false };

  await setCachedMetadata(cacheKey, metadata);
  metadata.inJellyfinLibrary = isInLibrary(metadata.tmdbId, metadata.title, metadata.year);
  return { metadata, fromCache: false };
}

// ── Detail metadata ────────────────────────────────────────────────────────────

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

async function doFetchDetailMetadata(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<MovieDetailMetadata | null> {
  const cached = await getCachedDetailByTmdbId(tmdbId);
  if (cached) return cached;

  const detail = await tmdbFetchDetail(tmdbId, mediaType);
  if (!detail) return null;

  await updateCachedDetail(tmdbId, detail);
  return detail;
}

// ── Recommendations ────────────────────────────────────────────────────────────

export async function fetchTopRatedRecommendations(
  count: number,
  filter: 'movie' | 'tv' | null = null,
): Promise<Recommendation[]> {
  return tmdbFetchTopRated(count, filter);
}

export async function searchRecommendation(
  title: string,
  year: string,
  mediaType: 'movie' | 'tv',
): Promise<Recommendation | null> {
  const lookup: MetadataLookup = { title, year, imdbId: '' };
  const cacheKey = getCacheKey(lookup);

  const cached = await getCachedMetadata(cacheKey);
  if (cached && cached.tmdbId) {
    return {
      tmdbId: cached.tmdbId,
      mediaType: (cached.mediaType as 'movie' | 'tv') || mediaType,
      title: cached.title,
      year: cached.year,
      poster: cached.poster,
      genre: cached.genre,
      rating: cached.rating,
      plot: cached.plot,
    };
  }

  const rec = await tmdbSearchRecommendation(title, year, mediaType);
  if (!rec) return null;

  await setCachedMetadata(cacheKey, { ...rec, runtime: '', rated: '' });
  rec.inJellyfinLibrary = isInLibrary(rec.tmdbId, rec.title, rec.year);
  return rec;
}

export async function enrichRecommendationsWithImdbIds(recs: Recommendation[]): Promise<Recommendation[]> {
  return mapConcurrent(recs, 4, async (rec) => {
    const { imdbId, trailerKey } = await tmdbFetchExternalData(rec.tmdbId, rec.mediaType);
    const inJellyfinLibrary = isInLibrary(rec.tmdbId, rec.title, rec.year);
    return { ...rec, ...(imdbId ? { imdbId } : {}), ...(trailerKey ? { trailerKey } : {}), inJellyfinLibrary };
  });
}
