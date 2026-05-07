import { query } from '../db/connection.js';
import type { RecommendationRef, FeedbackValue } from 'shared/recommendations.models';
import type { MediaType } from 'shared/tmdb.models';

interface FeedbackRecord {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    feedback: FeedbackValue;
}

interface FeedbackRow {
    title: string;
    feedback: FeedbackValue;
}

export type { FeedbackRow };

interface CacheRow {
    id: number;
    recommendations: RecommendationRef[];
    generated_at: Date;
}

export async function getFeedbackForMediaType(userId: number, mediaType: MediaType): Promise<FeedbackRow[]> {
    const result = await query<FeedbackRow>(
        `SELECT title, feedback
     FROM recommendation_feedback
     WHERE user_id = $1
       AND media_type = $2
     ORDER BY created_at DESC`,
        [userId, mediaType],
    );
    return result.rows;
}

export async function upsertFeedback(rec: FeedbackRecord, userId: number): Promise<void> {
    await query(
        `INSERT INTO recommendation_feedback (user_id, tmdb_id, media_type, title, feedback)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, tmdb_id, media_type)
     DO UPDATE SET title=$4, feedback=$5, created_at=NOW()`,
        [userId, rec.tmdbId, rec.mediaType, rec.title, rec.feedback],
    );
}

export async function deleteFeedback(userId: number, tmdbId: number, mediaType: MediaType): Promise<void> {
    await query(`DELETE FROM recommendation_feedback WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3`, [
        userId,
        tmdbId,
        mediaType,
    ]);
}

export async function getFreshCache(
    userId: number,
    mediaType: MediaType,
): Promise<{ refs: RecommendationRef[] } | null> {
    const result = await query<CacheRow>(
        `SELECT id, recommendations, generated_at
     FROM recommendation_cache
     WHERE user_id = $1
       AND media_type_filter = $2
       AND generated_at > NOW() - INTERVAL '12 hours'
     ORDER BY id DESC LIMIT 1`,
        [userId, mediaType],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { refs: row.recommendations };
}

export async function setCache(refs: RecommendationRef[], userId: number, mediaType: MediaType): Promise<void> {
    await query(
        `DELETE FROM recommendation_cache WHERE user_id = $1 AND media_type_filter = $2`,
        [userId, mediaType],
    );
    await query(
        `INSERT INTO recommendation_cache (user_id, recommendations, generated_at, media_type_filter) VALUES ($1, $2, NOW(), $3)`,
        [userId, JSON.stringify(refs), mediaType],
    );
}

export async function invalidateCacheForMediaType(userId: number, mediaType: MediaType): Promise<void> {
    await query(
        `DELETE FROM recommendation_cache WHERE user_id = $1 AND media_type_filter = $2`,
        [userId, mediaType],
    );
}

export async function getFeedbackForItem(
    userId: number,
    tmdbId: number,
    mediaType: MediaType,
): Promise<FeedbackValue | null> {
    const result = await query<{ feedback: FeedbackValue }>(
        `SELECT feedback FROM recommendation_feedback WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3`,
        [userId, tmdbId, mediaType],
    );
    return result.rows.length > 0 ? result.rows[0].feedback : null;
}
