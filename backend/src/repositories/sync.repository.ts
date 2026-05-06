import { query } from '../db/connection.js';
import type { SyncService, SyncStatus } from 'shared/sync.models';

const SYNC_DATA_TABLES: Record<SyncService, string> = {
    jellyfin: 'jellyfin_library',
    qbittorrent: 'qbittorrent_torrents',
};

export async function logSync(
    service: SyncService,
    success: boolean,
    itemCount: number | null,
    errorMessage: string | null,
): Promise<void> {
    await query(`INSERT INTO sync_log (service, success, item_count, error_message) VALUES ($1, $2, $3, $4)`, [
        service,
        success,
        itemCount,
        errorMessage,
    ]);
}

export async function getLastSyncStatus(service: SyncService): Promise<SyncStatus> {
    const result = await query<{
        service: SyncService;
        started_at: Date | string;
        success: boolean;
        item_count: number | null;
        error_message: string | null;
    }>(
        `SELECT service, started_at, success, item_count, error_message
     FROM sync_log
     WHERE service = $1
     ORDER BY started_at DESC
     LIMIT 1`,
        [service],
    );

    if (result.rows.length === 0) {
        return { service, lastSync: null, success: null, itemCount: null, errorMessage: null };
    }

    const row = result.rows[0];
    return {
        service: row.service,
        lastSync: toIsoString(row.started_at),
        success: row.success,
        itemCount: row.item_count,
        errorMessage: row.error_message,
    };
}

export async function needsSyncOnStartup(service: SyncService): Promise<boolean> {
    const tableName = SYNC_DATA_TABLES[service];
    const countResult = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${tableName}`);
    if (parseInt(countResult.rows[0].count, 10) === 0) return true;

    const syncResult = await query<{ started_at: Date | string }>(
        `SELECT started_at
     FROM sync_log
     WHERE service = $1 AND success = true
     ORDER BY started_at DESC
     LIMIT 1`,
        [service],
    );
    if (syncResult.rows.length === 0) return true;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(syncResult.rows[0].started_at) < oneDayAgo;
}

function toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
