import { query, withTransaction } from '../db/connection.js';
import type { LibraryItem, MediaInfo, SeasonInfo } from 'shared/jellyfin.models';
import type { MediaType } from 'shared/tmdb.models';

export interface LibraryPage {
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
    sizeBytes: number | null;
    path: string | null;
    seasons: SeasonInfo[] | null;
}

interface LibraryRow {
    jellyfin_id: string;
    tmdb_id: number | null;
    media_type: string | null;
    title: string;
    year: string | null;
    synced_at: string;
    media_info: MediaInfo | null;
    size_bytes: string | number | null;
    path: string | null;
    seasons: SeasonInfo[] | null;
}

function toLibraryItem(row: LibraryRow): LibraryItem {
    return {
        jellyfinId: row.jellyfin_id,
        tmdbId: row.tmdb_id,
        mediaType: (row.media_type as MediaType) ?? null,
        title: row.title,
        year: row.year,
        syncedAt: row.synced_at,
        poster: null,
        genre: null,
        rating: null,
        mediaInfo: row.media_info ?? null,
        sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
        path: row.path ?? null,
        seasons: row.seasons ?? null,
    };
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

export async function getLibraryTitles(
    mediaType: MediaType,
    limit: number,
): Promise<{ title: string; year: string | null }[]> {
    const result = await query<{ title: string; year: string | null }>(
        `SELECT title, year
     FROM (
       SELECT DISTINCT ON (COALESCE(tmdb_id::text, jellyfin_id)) title, year, date_created
       FROM jellyfin_library
       WHERE media_type = $1
       ORDER BY COALESCE(tmdb_id::text, jellyfin_id), date_created DESC NULLS LAST
     ) deduped
     ORDER BY date_created DESC NULLS LAST
     LIMIT $2`,
        [mediaType, limit],
    );
    return result.rows;
}

export async function replaceLibrary(items: JellyfinItem[]): Promise<void> {
    await withTransaction(async (client) => {
        await client.query('DELETE FROM jellyfin_library');
        if (items.length === 0) return;

        await client.query(
            `INSERT INTO jellyfin_library (jellyfin_id, tmdb_id, media_type, title, year, date_created, media_info, size_bytes, path, seasons)
       SELECT * FROM unnest(
         $1::text[], $2::int[], $3::text[], $4::text[], $5::text[],
         $6::timestamptz[], $7::jsonb[], $8::bigint[], $9::text[], $10::jsonb[]
       )
       ON CONFLICT (jellyfin_id) DO UPDATE
         SET tmdb_id = EXCLUDED.tmdb_id,
             media_type = EXCLUDED.media_type,
             title = EXCLUDED.title,
             year = EXCLUDED.year,
             date_created = EXCLUDED.date_created,
             media_info = EXCLUDED.media_info,
             size_bytes = EXCLUDED.size_bytes,
             path = EXCLUDED.path,
             seasons = EXCLUDED.seasons,
             synced_at = NOW()`,
            [
                items.map((item) => item.jellyfinId),
                items.map((item) => item.tmdbId ?? null),
                items.map((item) => item.mediaType ?? null),
                items.map((item) => item.title),
                items.map((item) => item.year ?? null),
                items.map((item) => item.dateCreated ?? null),
                items.map((item) => (item.mediaInfo ? JSON.stringify(item.mediaInfo) : null)),
                items.map((item) => item.sizeBytes ?? null),
                items.map((item) => item.path ?? null),
                items.map((item) => (item.seasons ? JSON.stringify(item.seasons) : null)),
            ],
        );
    });
}

export async function getLibraryPage(
    search: string,
    page: number,
    perPage: number,
    mediaType: MediaType | null = null,
): Promise<LibraryPage> {
    const offset = (page - 1) * perPage;
    const searchParam = search.trim() ? `%${search.trim()}%` : null;

    const filters: unknown[] = [];
    const whereParts: string[] = [];

    if (searchParam) {
        filters.push(searchParam);
        whereParts.push(`title ILIKE $${filters.length}`);
    }

    if (mediaType) {
        filters.push(mediaType);
        whereParts.push(`media_type = $${filters.length}`);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const params = [...filters, perPage, offset];
    const countParams = [...filters];
    const limitParam = filters.length + 1;
    const offsetParam = filters.length + 2;

    const [dataResult, countResult] = await Promise.all([
        query<LibraryRow>(
            `SELECT jellyfin_id, tmdb_id, media_type, title, year, synced_at, media_info, size_bytes, path, seasons
       FROM (
         SELECT DISTINCT ON (COALESCE(tmdb_id::text, jellyfin_id))
           jellyfin_id, tmdb_id, media_type, title, year, synced_at, date_created, media_info, size_bytes, path, seasons
         FROM jellyfin_library
         ${whereSql}
         ORDER BY COALESCE(tmdb_id::text, jellyfin_id), title ASC
       ) deduped
       ORDER BY date_created DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
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

    return { items: dataResult.rows.map(toLibraryItem), total: parseInt(countResult.rows[0].count, 10) };
}

export async function getLibraryItem(jellyfinId: string): Promise<LibraryItem | null> {
    const result = await query<LibraryRow>(
        `SELECT jellyfin_id, tmdb_id, media_type, title, year, synced_at, media_info, size_bytes, path, seasons
     FROM jellyfin_library
     WHERE jellyfin_id = $1
     LIMIT 1`,
        [jellyfinId],
    );

    const row = result.rows[0];
    return row ? toLibraryItem(row) : null;
}

export async function deleteLibraryItem(jellyfinId: string): Promise<boolean> {
    const result = await query('DELETE FROM jellyfin_library WHERE jellyfin_id = $1', [jellyfinId]);
    return (result.rowCount ?? 0) > 0;
}
