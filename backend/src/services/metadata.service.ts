import { tmdbService } from './tmdb.service.js';
import { getCachedMetadata, getCachedMetadataByTmdbId, setCachedMetadata } from '../repositories/cache.repository.js';
import { isInLibrary } from '../repositories/jellyfin.repository.js';
import { logger } from '../utils/logger.js';
import type { MovieMetadata, MetadataLookup } from 'shared/tmdb.models';

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

function withLibraryState(metadata: MovieMetadata): MovieMetadata {
    return {
        ...metadata,
        inJellyfinLibrary: isInLibrary(metadata.tmdbId, metadata.title, metadata.year),
    };
}
