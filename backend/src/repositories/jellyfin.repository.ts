import { query } from '../db/connection.js';
import type { JellyfinSyncStatus, LibraryItem, MediaInfo } from 'shared/jellyfin.models';
import type { MediaType } from 'shared/tmdb.models';

interface LibraryPage {
    items: LibraryItem[];
    total: number;
}

export interface JellyfinItem {
    jellyfinId: string;
    tmdbId: number | null;
    mediaType: MediaType | null;
    title: string;
    year: string | null;
    dateCreated: Date | null;
    mediaInfo: MediaInfo | null;
}

// In-memory lookup sets — populated on startup and after each sync
let tmdbIdSet = new Set<number>();
let titleYearSet = new Set<string>();

function titleYearKey(title: string, year: string | null | undefined): string {
    return `${title.trim().toLowerCase()}|${year ?? ''}`;
}

export function isInLibrary(
    tmdbId: number | null | undefined,
    title: string,
    year: string | null | undefined,
): boolean {
    if (tmdbId && tmdbIdSet.has(tmdbId)) return true;
    if (title && titleYearSet.has(titleYearKey(title, year))) return true;
    return false;
}

export async function reloadCache(): Promise<void> {
    const result = await query<{ tmdb_id: number | null; title: string; year: string | null }>(
        'SELECT tmdb_id, title, year FROM jellyfin_library',
    );

    const newTmdbIds = new Set<number>();
    const newTitleYears = new Set<string>();

    for (const row of result.rows) {
        if (row.tmdb_id) newTmdbIds.add(row.tmdb_id);
        newTitleYears.add(titleYearKey(row.title, row.year));
    }

    tmdbIdSet = newTmdbIds;
    titleYearSet = newTitleYears;
}

export async function replaceLibrary(items: JellyfinItem[]): Promise<void> {
    await query('DELETE FROM jellyfin_library');

    if (items.length === 0) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];

    items.forEach((item, i) => {
        const base = i * 7;
        placeholders.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`,
        );
        values.push(
            item.jellyfinId,
            item.tmdbId ?? null,
            item.mediaType ?? null,
            item.title,
            item.year ?? null,
            item.dateCreated ?? null,
            item.mediaInfo ? JSON.stringify(item.mediaInfo) : null,
        );
    });

    await query(
        `INSERT INTO jellyfin_library (jellyfin_id, tmdb_id, media_type, title, year, date_created, media_info)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (jellyfin_id) DO UPDATE
       SET tmdb_id = EXCLUDED.tmdb_id,
           media_type = EXCLUDED.media_type,
           title = EXCLUDED.title,
           year = EXCLUDED.year,
           date_created = EXCLUDED.date_created,
           media_info = EXCLUDED.media_info,
           synced_at = NOW()`,
        values,
    );
}

export async function logSync(success: boolean, itemCount: number | null, errorMessage: string | null): Promise<void> {
    await query(`INSERT INTO jellyfin_sync_log (success, item_count, error_message) VALUES ($1, $2, $3)`, [
        success,
        itemCount,
        errorMessage,
    ]);
}

export async function getLastSyncStatus(): Promise<JellyfinSyncStatus> {
    const result = await query<{
        started_at: string;
        success: boolean;
        item_count: number | null;
        error_message: string | null;
    }>(
        `SELECT started_at, success, item_count, error_message
     FROM jellyfin_sync_log
     ORDER BY started_at DESC
     LIMIT 1`,
    );

    if (result.rows.length === 0) {
        return { lastSync: null, success: null, itemCount: null, errorMessage: null };
    }

    const row = result.rows[0];
    return {
        lastSync: row.started_at,
        success: row.success,
        itemCount: row.item_count,
        errorMessage: row.error_message,
    };
}

export async function needsSyncOnStartup(): Promise<boolean> {
    const countResult = await query<{ count: string }>('SELECT COUNT(*) AS count FROM jellyfin_library');
    if (parseInt(countResult.rows[0].count, 10) === 0) return true;

    const syncResult = await query<{ started_at: string }>(
        `SELECT started_at FROM jellyfin_sync_log WHERE success = true ORDER BY started_at DESC LIMIT 1`,
    );
    if (syncResult.rows.length === 0) return true;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(syncResult.rows[0].started_at) < oneDayAgo;
}

export async function getLibrary(search: string, page: number, perPage: number): Promise<LibraryPage> {
    const offset = (page - 1) * perPage;
    const searchParam = search.trim() ? `%${search.trim()}%` : null;

    const whereSql = searchParam ? `WHERE title ILIKE $1` : '';

    const params: unknown[] = searchParam ? [searchParam, perPage, offset] : [perPage, offset];
    const countParams: unknown[] = searchParam ? [searchParam] : [];

    const [dataResult, countResult] = await Promise.all([
        query<{
            jellyfin_id: string;
            tmdb_id: number | null;
            media_type: string | null;
            title: string;
            year: string | null;
            synced_at: string;
            media_info: MediaInfo | null;
        }>(
            `SELECT jellyfin_id, tmdb_id, media_type, title, year, synced_at, media_info
       FROM (
         SELECT DISTINCT ON (COALESCE(tmdb_id::text, jellyfin_id))
           jellyfin_id, tmdb_id, media_type, title, year, synced_at, date_created, media_info
         FROM jellyfin_library
         ${whereSql}
         ORDER BY COALESCE(tmdb_id::text, jellyfin_id), title ASC
       ) deduped
       ORDER BY date_created DESC
       LIMIT $${searchParam ? 2 : 1} OFFSET $${searchParam ? 3 : 2}`,
            params,
        ),
        query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM (
         SELECT DISTINCT ON (COALESCE(tmdb_id::text, jellyfin_id)) jellyfin_id
         FROM jellyfin_library
         ${whereSql}
         ORDER BY COALESCE(tmdb_id::text, jellyfin_id)
       ) deduped`,
            countParams,
        ),
    ]);

    const items: LibraryItem[] = dataResult.rows.map((row) => ({
        jellyfinId: row.jellyfin_id,
        tmdbId: row.tmdb_id,
        mediaType: (row.media_type as 'movie' | 'tv') ?? null,
        title: row.title,
        year: row.year,
        syncedAt: row.synced_at,
        poster: null,
        genre: null,
        rating: null,
        mediaInfo: row.media_info ?? null,
    }));

    return { items, total: parseInt(countResult.rows[0].count, 10) };
}
