import { query } from '../db/connection.js';
import { config } from '../config.js';
import type { MovieMetadata, MediaType } from 'shared/tmdb.models';

interface MetadataCacheRow {
    cache_key: string;
    title: string;
    year: string;
    poster: string;
    genre: string;
    runtime: string;
    rating: string;
    rated: string;
    plot: string;
    tmdb_id: number | null;
    media_type: string | null;
    release_date: string | null;
    trailer_key: string | null;
    imdb_id: string | null;
    expires_at: Date;
}

export async function getCachedMetadataByTmdbId(tmdbId: number, mediaType: MediaType): Promise<MovieMetadata | null> {
    const result = await query<MetadataCacheRow>(
        `SELECT *
     FROM metadata_cache
     WHERE tmdb_id = $1 AND media_type = $2 AND expires_at > NOW()
     ORDER BY cached_at DESC
     LIMIT 1`,
        [tmdbId, mediaType],
    );
    if (result.rows.length === 0) return null;
    return toMetadata(result.rows[0]);
}

export async function getCachedMetadata(cacheKey: string): Promise<MovieMetadata | null> {
    const result = await query<MetadataCacheRow>(
        `SELECT *
     FROM metadata_cache
     WHERE cache_key = $1 AND expires_at > NOW()`,
        [cacheKey],
    );

    if (result.rows.length === 0) return null;

    return toMetadata(result.rows[0]);
}

export async function setCachedMetadata(cacheKey: string, data: MovieMetadata): Promise<void> {
    const expiresAt = new Date(Date.now() + config.cacheExpiryMs);
    await query(
        `INSERT INTO metadata_cache (
       cache_key, title, year, poster, genre, runtime, rating, rated, plot,
       tmdb_id, media_type, release_date, trailer_key, imdb_id, cached_at, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15)
     ON CONFLICT (cache_key)
     DO UPDATE SET
       title = $2,
       year = $3,
       poster = $4,
       genre = $5,
       runtime = $6,
       rating = $7,
       rated = $8,
       plot = $9,
       tmdb_id = $10,
       media_type = $11,
       release_date = $12,
       trailer_key = $13,
       imdb_id = $14,
       cached_at = NOW(),
       expires_at = $15`,
        [
            cacheKey,
            data.title,
            data.year,
            data.poster,
            data.genre,
            data.runtime,
            data.rating,
            data.rated,
            data.plot,
            data.tmdbId || null,
            data.mediaType,
            data.releaseDate,
            data.trailerKey ?? null,
            data.imdbId ?? null,
            expiresAt,
        ],
    );
}

function toMetadata(row: MetadataCacheRow): MovieMetadata | null {
    if (!row.tmdb_id || (row.media_type !== 'movie' && row.media_type !== 'tv')) return null;

    return {
        tmdbId: row.tmdb_id,
        mediaType: row.media_type,
        title: row.title ?? '',
        year: row.year ?? '',
        poster: row.poster ?? '',
        genre: row.genre ?? '',
        runtime: row.runtime ?? '',
        rating: row.rating ?? '',
        rated: row.rated ?? '',
        plot: row.plot ?? '',
        releaseDate: row.release_date ?? '',
        trailerKey: row.trailer_key ?? undefined,
        imdbId: row.imdb_id ?? undefined,
    };
}
