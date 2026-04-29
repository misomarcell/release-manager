export interface JellyfinSyncStatus {
  lastSync: string | null;
  success: boolean | null;
  itemCount: number | null;
  errorMessage: string | null;
}
