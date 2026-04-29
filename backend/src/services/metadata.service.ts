import { tmdbFetchBasic, tmdbFetchDetail, tmdbFetchTopRated } from './tmdb.service.js';
import {
    getCachedMetadata,
    setCachedMetadata,
    getCachedDetailByTmdbId,
    updateCachedDetail,
    getCachedBasicByTmdbId,
} from '../repositories/cache.repository.js';
import { isInLibrary } from '../repositories/jellyfin.repository.js';
import { mapConcurrent } from '../utils/concurrent.js';
import type { MovieMetadata, MovieDetailMetadata, MetadataLookup, MediaType } from 'shared/tmdb.models';
import type { Recommendation, AiRecommendation, FeedbackValue } from 'shared/recommendations.models';

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

export async function fetchDetailMetadata(tmdbId: number, mediaType: MediaType): Promise<MovieDetailMetadata | null> {
    const key = `${mediaType}:${tmdbId}`;

    const existing = inflightDetail.get(key);
    if (existing) return existing;

    const promise = doFetchDetailMetadata(tmdbId, mediaType).finally(() => {
        inflightDetail.delete(key);
    });

    inflightDetail.set(key, promise);
    return promise;
}

async function doFetchDetailMetadata(tmdbId: number, mediaType: MediaType): Promise<MovieDetailMetadata | null> {
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
    filter: MediaType | null = null,
): Promise<AiRecommendation[]> {
    const recs = await tmdbFetchTopRated(count, filter);

    // Warm metadata_cache with the batch data we already have so enrichment is all cache-hits
    await mapConcurrent(recs, 6, (rec) =>
        setCachedMetadata(getCacheKey({ title: rec.title, year: rec.year, imdbId: '' }), rec),
    );

    return recs.map((rec) => ({
        tmdbId: rec.tmdbId,
        mediaType: rec.mediaType as MediaType,
        title: rec.title,
        year: rec.year,
    }));
}

async function enrichRecommendation(ref: AiRecommendation, feedback?: FeedbackValue): Promise<Recommendation | null> {
    const { metadata } = await fetchBasicMetadata({
        title: ref.title,
        year: ref.year,
        imdbId: '',
        ...(ref.tmdbId ? { tmdbId: ref.tmdbId, mediaType: ref.mediaType } : { mediaType: ref.mediaType }),
    });
    if (!metadata || (metadata.mediaType !== 'movie' && metadata.mediaType !== 'tv')) return null;

    const detail = await fetchDetailMetadata(metadata.tmdbId, metadata.mediaType);

    return {
        tmdbId: metadata.tmdbId,
        mediaType: metadata.mediaType,
        title: metadata.title,
        year: metadata.year,
        poster: metadata.poster,
        genre: metadata.genre,
        rating: metadata.rating,
        plot: detail?.plot || metadata.plot || '',
        ...(detail?.imdbId ? { imdbId: detail.imdbId } : {}),
        ...(detail?.trailerKey ? { trailerKey: detail.trailerKey } : {}),
        ...(ref.reason ? { reason: ref.reason } : {}),
        ...(feedback ? { feedback } : {}),
        inJellyfinLibrary: metadata.inJellyfinLibrary,
    };
}

export async function enrichRecommendations(
    refs: AiRecommendation[],
    feedbackMap: Record<string, FeedbackValue> = {},
): Promise<Recommendation[]> {
    const results = await mapConcurrent(refs, 4, (ref) => {
        const feedback = feedbackMap[`${ref.tmdbId}:${ref.mediaType}`] as FeedbackValue | undefined;
        return enrichRecommendation(ref, feedback);
    });
    return results.filter((r): r is Recommendation => r !== null);
}
