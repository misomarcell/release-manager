import { query } from '../db/connection.js';
import type { Recommendation, RecommendationFeedbackRequest, FeedbackValue } from 'shared/recommendations.models';

interface FeedbackRow {
  tmdb_id: number;
  media_type: string;
  title: string;
  summary: string;
  feedback: string;
}

export type { FeedbackRow };

interface CacheRow {
  id: number;
  recommendations: Recommendation[];
  generated_at: Date;
  feedback_map: Record<string, string> | null;
}

export async function hasFeedback(userId: number): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM recommendation_feedback WHERE user_id = $1) AS exists`,
    [userId],
  );
  return result.rows[0].exists;
}

export async function getAllFeedback(userId: number): Promise<FeedbackRow[]> {
  const result = await query<FeedbackRow>(
    `SELECT tmdb_id, media_type, title, COALESCE(summary, '') AS summary, feedback
     FROM recommendation_feedback
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
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
    `SELECT id, recommendations, generated_at,
       (SELECT jsonb_object_agg(rf.tmdb_id::text || ':' || rf.media_type, rf.feedback)
        FROM recommendation_feedback rf
        WHERE rf.user_id = $1) AS feedback_map
     FROM recommendation_cache
     WHERE user_id = $1
       AND (($2::TEXT IS NULL AND media_type_filter IS NULL) OR media_type_filter = $2)
       AND generated_at > NOW() - INTERVAL '12 hours'
     ORDER BY id DESC LIMIT 1`,
    [userId, filter],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const map = row.feedback_map ?? {};
  return row.recommendations.map((rec) => ({
    ...rec,
    feedback: (map[`${rec.tmdbId}:${rec.mediaType}`] as FeedbackValue) || undefined,
  }));
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

export async function invalidateCacheForFilter(userId: number, filter: 'movie' | 'tv' | null): Promise<void> {
  await query(
    `DELETE FROM recommendation_cache WHERE user_id = $1 AND (($2::TEXT IS NULL AND media_type_filter IS NULL) OR media_type_filter = $2)`,
    [userId, filter],
  );
}
