import { query } from '../db/connection.js';
import type { MediaType } from 'shared/tmdb.models';
import type { WatchlistItem, WatchlistRelease } from 'shared/watchlist.models';

interface WatchlistRow {
    id: number;
    user_id: number;
    tmdb_id: number;
    media_type: MediaType;
    title: string;
    year: string;
    poster: string;
    imdb_id: string;
    keywords: string[];
    last_checked_at: Date | null;
    created_at: Date;
    release_count: number;
    new_releases: WatchlistRelease[];
}

interface NewWatchlistItem {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    year: string;
    poster: string;
    imdbId: string;
    keywords: string[];
}

interface FoundRelease {
    torrentId: string;
    releaseName: string;
    detailsUrl: string;
    size: number;
    seen: boolean;
}

const ITEM_SELECT = `
    SELECT w.id, w.user_id, w.tmdb_id, w.media_type, w.title, w.year, w.poster, w.imdb_id, w.keywords,
           w.last_checked_at, w.created_at, r.release_count, r.new_releases
    FROM watchlist_items w
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS release_count,
             COALESCE(
               jsonb_agg(
                 jsonb_build_object(
                   'torrentId', torrent_id,
                   'releaseName', release_name,
                   'detailsUrl', details_url,
                   'size', size,
                   'foundAt', found_at
                 ) ORDER BY found_at DESC, torrent_id DESC
               ) FILTER (WHERE NOT seen),
               '[]'::jsonb
             ) AS new_releases
      FROM watchlist_releases
      WHERE item_id = w.id
    ) r`;

export async function getWatchlistItems(userId: number): Promise<WatchlistItem[]> {
    const result = await query<WatchlistRow>(
        `${ITEM_SELECT} WHERE w.user_id = $1 ORDER BY w.created_at DESC, w.id DESC`,
        [userId],
    );
    return result.rows.map(toItem);
}

export async function getAllWatchlistItems(): Promise<WatchlistItem[]> {
    const result = await query<WatchlistRow>(`${ITEM_SELECT} ORDER BY w.id`);
    return result.rows.map(toItem);
}

export async function getWatchlistItem(userId: number, id: number): Promise<WatchlistItem | null> {
    const result = await query<WatchlistRow>(`${ITEM_SELECT} WHERE w.user_id = $1 AND w.id = $2`, [userId, id]);
    return result.rows.length > 0 ? toItem(result.rows[0]) : null;
}

export async function upsertWatchlistItem(userId: number, item: NewWatchlistItem): Promise<number> {
    const result = await query<{ id: number }>(
        `INSERT INTO watchlist_items (user_id, tmdb_id, media_type, title, year, poster, imdb_id, keywords)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, tmdb_id, media_type)
     DO UPDATE SET keywords = EXCLUDED.keywords
     RETURNING id`,
        [userId, item.tmdbId, item.mediaType, item.title, item.year, item.poster, item.imdbId, item.keywords],
    );
    return result.rows[0].id;
}

export async function updateWatchlistKeywords(userId: number, id: number, keywords: string[]): Promise<boolean> {
    const result = await query(`UPDATE watchlist_items SET keywords = $3 WHERE user_id = $1 AND id = $2`, [
        userId,
        id,
        keywords,
    ]);
    return (result.rowCount ?? 0) > 0;
}

export async function deleteWatchlistItem(userId: number, id: number): Promise<boolean> {
    const result = await query(`DELETE FROM watchlist_items WHERE user_id = $1 AND id = $2`, [userId, id]);
    return (result.rowCount ?? 0) > 0;
}

export async function markWatchlistItemRead(userId: number, id: number): Promise<boolean> {
    const result = await query(
        `UPDATE watchlist_releases r
     SET seen = TRUE
     FROM watchlist_items w
     WHERE w.id = r.item_id AND w.user_id = $1 AND w.id = $2 AND NOT r.seen`,
        [userId, id],
    );
    return (result.rowCount ?? 0) > 0;
}

export async function getKnownTorrentIds(itemId: number): Promise<Set<string>> {
    const result = await query<{ torrent_id: string }>(`SELECT torrent_id FROM watchlist_releases WHERE item_id = $1`, [
        itemId,
    ]);
    return new Set(result.rows.map((row) => row.torrent_id));
}

export async function saveCheckResult(itemId: number, releases: FoundRelease[]): Promise<void> {
    if (releases.length > 0) {
        await query(
            `INSERT INTO watchlist_releases (item_id, torrent_id, release_name, details_url, size, seen)
       SELECT $1::int, * FROM unnest($2::text[], $3::text[], $4::text[], $5::bigint[], $6::boolean[])
       ON CONFLICT (item_id, torrent_id) DO NOTHING`,
            [
                itemId,
                releases.map((r) => r.torrentId),
                releases.map((r) => r.releaseName),
                releases.map((r) => r.detailsUrl),
                releases.map((r) => Math.round(r.size)),
                releases.map((r) => r.seen),
            ],
        );
    }
    await query(`UPDATE watchlist_items SET last_checked_at = NOW() WHERE id = $1`, [itemId]);
}

function toItem(row: WatchlistRow): WatchlistItem {
    return {
        id: row.id,
        tmdbId: row.tmdb_id,
        mediaType: row.media_type,
        title: row.title,
        year: row.year,
        poster: row.poster,
        imdbId: row.imdb_id,
        keywords: row.keywords,
        releaseCount: row.release_count,
        newReleases: row.new_releases,
        lastCheckedAt: row.last_checked_at ? row.last_checked_at.toISOString() : null,
        createdAt: row.created_at.toISOString(),
    };
}
