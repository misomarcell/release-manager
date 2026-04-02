import { query } from '../db/connection.js';
import { config } from '../config.js';
import type { MovieMetadata, MovieDetailMetadata } from 'shared/ncore.models';

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
  expires_at: Date;
}

export async function getCachedMetadata(cacheKey: string): Promise<MovieMetadata | null> {
  const result = await query<MetadataCacheRow>(
    `SELECT * FROM metadata_cache WHERE cache_key = $1 AND expires_at > NOW()`,
    [cacheKey],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    tmdbId: row.tmdb_id ?? 0,
    mediaType: (row.media_type as 'movie' | 'tv' | '') ?? '',
    title: row.title ?? '',
    year: row.year ?? '',
    poster: row.poster ?? '',
    genre: row.genre ?? '',
    runtime: row.runtime ?? '',
    rating: row.rating ?? '',
    rated: row.rated ?? '',
    plot: row.plot ?? '',
  };
}

export async function setCachedMetadata(cacheKey: string, data: MovieMetadata): Promise<void> {
  const expiresAt = new Date(Date.now() + config.cacheExpiryMs);
  await query(
    `INSERT INTO metadata_cache (cache_key, title, year, poster, genre, runtime, rating, rated, plot, tmdb_id, media_type, release_date, cached_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
     ON CONFLICT (cache_key)
     DO UPDATE SET title=$2, year=$3, poster=$4, genre=$5, runtime=$6, rating=$7, rated=$8, plot=$9, tmdb_id=$10, media_type=$11, release_date=$12, cached_at=NOW(), expires_at=$13`,
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
      data.mediaType || null,
      '',
      expiresAt,
    ],
  );
}

export async function getCachedDetailByTmdbId(tmdbId: number): Promise<MovieDetailMetadata | null> {
  const result = await query<MetadataCacheRow>(
    `SELECT plot, runtime, rated, release_date FROM metadata_cache WHERE tmdb_id = $1 AND expires_at > NOW() AND plot != ''`,
    [tmdbId],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    plot: row.plot ?? '',
    runtime: row.runtime ?? '',
    rated: row.rated ?? '',
    releaseDate: row.release_date ?? '',
  };
}

export async function updateCachedDetail(
  tmdbId: number,
  detail: MovieDetailMetadata,
): Promise<void> {
  await query(
    `UPDATE metadata_cache SET plot = $2, runtime = $3, rated = $4, release_date = $5 WHERE tmdb_id = $1`,
    [tmdbId, detail.plot, detail.runtime, detail.rated, detail.releaseDate],
  );
}
