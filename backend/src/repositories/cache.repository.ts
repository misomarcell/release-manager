import { query } from '../db/connection.js';
import { config } from '../config.js';
import type { OmdbMetadata } from 'shared/ncore.models';

interface OmdbCacheRow {
  cache_key: string;
  title: string;
  year: string;
  poster: string;
  genre: string;
  runtime: string;
  imdb_rating: string;
  rated: string;
  plot: string;
  expires_at: Date;
}

export async function getCachedOmdb(cacheKey: string): Promise<OmdbMetadata | null> {
  const result = await query<OmdbCacheRow>(
    `SELECT * FROM omdb_cache WHERE cache_key = $1 AND expires_at > NOW()`,
    [cacheKey],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    title: row.title ?? '',
    year: row.year ?? '',
    poster: row.poster ?? '',
    genre: row.genre ?? '',
    runtime: row.runtime ?? '',
    imdbRating: row.imdb_rating ?? '',
    rated: row.rated ?? '',
    plot: row.plot ?? '',
  };
}

export async function setCachedOmdb(cacheKey: string, data: OmdbMetadata): Promise<void> {
  const expiresAt = new Date(Date.now() + config.cacheExpiryMs);
  await query(
    `INSERT INTO omdb_cache (cache_key, title, year, poster, genre, runtime, imdb_rating, rated, plot, cached_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
     ON CONFLICT (cache_key)
     DO UPDATE SET title=$2, year=$3, poster=$4, genre=$5, runtime=$6, imdb_rating=$7, rated=$8, plot=$9, cached_at=NOW(), expires_at=$10`,
    [
      cacheKey,
      data.title,
      data.year,
      data.poster,
      data.genre,
      data.runtime,
      data.imdbRating,
      data.rated,
      data.plot,
      expiresAt,
    ],
  );
}
