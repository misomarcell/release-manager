import { query } from '../db/connection.js';
import type { JellyfinSyncStatus } from 'shared/jellyfin.models';
import type { MediaType } from 'shared/tmdb.models';

export interface JellyfinItem {
  jellyfinId: string;
  tmdbId: number | null;
  mediaType: MediaType | null;
  title: string;
  year: string | null;
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
    const base = i * 5;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
    values.push(item.jellyfinId, item.tmdbId ?? null, item.mediaType ?? null, item.title, item.year ?? null);
  });

  await query(
    `INSERT INTO jellyfin_library (jellyfin_id, tmdb_id, media_type, title, year)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (jellyfin_id) DO UPDATE
       SET tmdb_id = EXCLUDED.tmdb_id,
           media_type = EXCLUDED.media_type,
           title = EXCLUDED.title,
           year = EXCLUDED.year,
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
