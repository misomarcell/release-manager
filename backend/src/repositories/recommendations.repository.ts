import { query } from '../db/connection.js';
import type { Recommendation, RecommendationFeedbackRequest } from 'shared/recommendations.models';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface FeedbackRow {
  tmdb_id: number;
  media_type: string;
  title: string;
  summary: string;
  feedback: string;
}

interface CacheRow {
  id: number;
  recommendations: Recommendation[];
  generated_at: Date;
}

export async function getRandomFeedbackSample(limit: number): Promise<FeedbackRow[]> {
  const result = await query<FeedbackRow>(
    `SELECT tmdb_id, media_type, title, summary, feedback
     FROM recommendation_feedback
     ORDER BY random()
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function upsertFeedback(req: RecommendationFeedbackRequest): Promise<void> {
  await query(
    `INSERT INTO recommendation_feedback (tmdb_id, media_type, title, summary, feedback)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tmdb_id, media_type)
     DO UPDATE SET summary=$4, feedback=$5, created_at=NOW()`,
    [req.tmdbId, req.mediaType, req.title, req.summary, req.feedback],
  );
}

export async function getFreshCache(): Promise<Recommendation[] | null> {
  const result = await query<CacheRow>(
    `SELECT id, recommendations, generated_at FROM recommendation_cache
     WHERE generated_at > NOW() - INTERVAL '${Math.floor(CACHE_TTL_MS / 1000)} seconds'
     ORDER BY id DESC LIMIT 1`,
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].recommendations;
}

export async function setCache(recommendations: Recommendation[]): Promise<void> {
  await query(`DELETE FROM recommendation_cache`);
  await query(`INSERT INTO recommendation_cache (recommendations, generated_at) VALUES ($1, NOW())`, [
    JSON.stringify(recommendations),
  ]);
}

export async function invalidateCache(): Promise<void> {
  await query(`DELETE FROM recommendation_cache`);
}
