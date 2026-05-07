import { tmdbService } from './tmdb.service.js';
import { getCachedMetadata, getCachedMetadataByTmdbId, setCachedMetadata } from '../repositories/cache.repository.js';
import { isInLibrary } from '../repositories/jellyfin.repository.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { logger } from '../utils/logger.js';
import type { MovieMetadata, MetadataLookup, MediaType } from 'shared/tmdb.models';
import type { Recommendation, AiRecommendation, FeedbackValue } from 'shared/recommendations.models';

interface MetadataFetchResult {
    metadata: MovieMetadata | null;
    fromCache: boolean;
}

export function getCacheKey(lookup: MetadataLookup): string {
    if (lookup.imdbId) return `id:${lookup.imdbId}`;
    const typePart = lookup.mediaType ? `type:${lookup.mediaType}|` : '';
    return `${typePart}title:${lookup.title.trim().toLowerCase()}|year:${lookup.year}`;
}

const inflightMetadata = new Map<string, Promise<MetadataFetchResult>>();

export async function getMetadata(lookup: MetadataLookup): Promise<MetadataFetchResult> {
    const cacheKey =
        lookup.tmdbId && lookup.mediaType ? `tmdbid:${lookup.mediaType}:${lookup.tmdbId}` : getCacheKey(lookup);

    const existing = inflightMetadata.get(cacheKey);
    if (existing) return existing;

    const promise = doGetMetadata(lookup, cacheKey).finally(() => {
        inflightMetadata.delete(cacheKey);
    });

    inflightMetadata.set(cacheKey, promise);
    return promise;
}

async function doGetMetadata(lookup: MetadataLookup, cacheKey: string): Promise<MetadataFetchResult> {
    if (lookup.tmdbId && lookup.mediaType) {
        const byId = await getCachedMetadataByTmdbId(lookup.tmdbId, lookup.mediaType);
        if (byId) return { metadata: withLibraryState(byId), fromCache: true };
    }

    const cached = await getCachedMetadata(cacheKey);
    if (cached && (!lookup.mediaType || cached.mediaType === lookup.mediaType)) {
        return { metadata: withLibraryState(cached), fromCache: true };
    }

    logger.info('Metadata cache miss, fetching from TMDB', {
        title: lookup.title,
        mediaType: lookup.mediaType ?? 'unknown',
    });

    const metadata = await tmdbService.fetchMetadata(lookup);
    if (!metadata) return { metadata: null, fromCache: false };

    await setCachedMetadata(cacheKey, metadata);
    return { metadata: withLibraryState(metadata), fromCache: false };
}

export async function fetchTrendingRecommendations(
    count: number,
    filter: MediaType | null = null,
): Promise<AiRecommendation[]> {
    const refs = await tmdbService.fetchTopRated(count, filter);

    await mapConcurrent(refs, 6, (ref) =>
        getMetadata({
            tmdbId: ref.tmdbId,
            mediaType: ref.mediaType,
            title: ref.title,
            year: ref.year,
            imdbId: '',
        }),
    );

    return refs.map((ref) => ({
        tmdbId: ref.tmdbId,
        mediaType: ref.mediaType,
        title: ref.title,
        year: ref.year,
    }));
}

async function enrichRecommendation(ref: AiRecommendation, feedback?: FeedbackValue): Promise<Recommendation | null> {
    const { metadata } = await getMetadata({
        title: ref.title,
        year: ref.year,
        imdbId: '',
        ...(ref.tmdbId ? { tmdbId: ref.tmdbId, mediaType: ref.mediaType } : { mediaType: ref.mediaType }),
    });
    if (!metadata) return null;

    return {
        tmdbId: metadata.tmdbId,
        mediaType: metadata.mediaType,
        title: metadata.title,
        year: metadata.year,
        poster: metadata.poster,
        genre: metadata.genre,
        rating: metadata.rating,
        plot: metadata.plot,
        ...(metadata.imdbId ? { imdbId: metadata.imdbId } : {}),
        ...(metadata.trailerKey ? { trailerKey: metadata.trailerKey } : {}),
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

function withLibraryState(metadata: MovieMetadata): MovieMetadata {
    return {
        ...metadata,
        inJellyfinLibrary: isInLibrary(metadata.tmdbId, metadata.title, metadata.year),
    };
}
