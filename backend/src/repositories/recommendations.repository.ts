import { query } from '../db/connection.js';
import type { Recommendation, RecommendationFeedbackRequest } from 'shared/recommendations.models';

interface FeedbackRow {
  tmdb_id: number;
  media_type: string;
  title: string;
  feedback: string;
}

interface CacheRow {
  id: number;
  recommendations: Recommendation[];
  generated_at: Date;
}

export async function hasFeedback(userId: number): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM recommendation_feedback WHERE user_id = $1) AS exists`,
    [userId],
  );
  return result.rows[0].exists;
}

export async function getRandomFeedbackSample(limit: number, userId: number): Promise<FeedbackRow[]> {
  const result = await query<FeedbackRow>(
    `SELECT tmdb_id, media_type, title, feedback
     FROM recommendation_feedback
     WHERE user_id = $1
     ORDER BY random()
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

export async function upsertFeedback(req: RecommendationFeedbackRequest, userId: number): Promise<void> {
  await query(
    `INSERT INTO recommendation_feedback (user_id, tmdb_id, media_type, title, summary, feedback)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, tmdb_id, media_type)
     DO UPDATE SET summary=$5, feedback=$6, created_at=NOW()`,
    [userId, req.tmdbId, req.mediaType, req.title, req.summary, req.feedback],
  );
}

export async function getFreshCache(userId: number, filter: 'movie' | 'tv' | null): Promise<Recommendation[] | null> {
  const result = await query<CacheRow>(
    `SELECT id, recommendations, generated_at FROM recommendation_cache
     WHERE user_id = $1
     AND (($2::TEXT IS NULL AND media_type_filter IS NULL) OR media_type_filter = $2)
     AND generated_at > NOW() - INTERVAL '12 hours'
     ORDER BY id DESC LIMIT 1`,
    [userId, filter],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].recommendations;
}

export async function setCache(
  recommendations: Recommendation[],
  userId: number,
  filter: 'movie' | 'tv' | null,
): Promise<void> {
  await query(
    `DELETE FROM recommendation_cache WHERE user_id = $1 AND (($2::TEXT IS NULL AND media_type_filter IS NULL) OR media_type_filter = $2)`,
    [userId, filter],
  );
  await query(
    `INSERT INTO recommendation_cache (user_id, recommendations, generated_at, media_type_filter) VALUES ($1, $2, NOW(), $3)`,
    [userId, JSON.stringify(recommendations), filter],
  );
}

export async function invalidateCache(userId: number): Promise<void> {
  await query(`DELETE FROM recommendation_cache WHERE user_id = $1`, [userId]);
}
