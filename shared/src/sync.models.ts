export type SyncService = 'jellyfin' | 'qbittorrent';

export interface SyncStatus {
    service: SyncService;
    lastSync: string | null;
    success: boolean | null;
    itemCount: number | null;
    errorMessage: string | null;
}
