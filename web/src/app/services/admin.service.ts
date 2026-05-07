import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import type { LogsResponse } from '@rm/shared/log.models';
import type { SyncStatus } from '@rm/shared/sync.models';

export type { SyncStatus };

@Injectable({ providedIn: 'root' })
export class AdminService {
    private api = inject(ApiService);

    async clearMetadataCache(): Promise<{ deleted: number }> {
        return this.api.delete<{ deleted: number }>('/api/admin/metadata-cache');
    }

    async clearExpiredData(): Promise<{ challenges: number; sessions: number }> {
        return this.api.delete<{ challenges: number; sessions: number }>('/api/admin/expired-data');
    }

    async testQbittorrent(): Promise<{ version: string }> {
        return this.api.get<{ version: string }>('/api/admin/qbittorrent-test');
    }

    async logOutAllUsers(): Promise<{ deleted: number }> {
        return this.api.delete<{ deleted: number }>('/api/admin/sessions');
    }

    async getLogs(level: string | null, limit: number, offset: number): Promise<LogsResponse> {
        let params = new HttpParams().set('limit', limit).set('offset', offset);
        if (level) params = params.set('level', level);
        return this.api.get<LogsResponse>('/api/admin/logs', params);
    }

    async testJellyfin(): Promise<{ version: string }> {
        return this.api.get<{ version: string }>('/api/admin/jellyfin-test');
    }

    async getJellyfinStatus(): Promise<SyncStatus> {
        return this.api.get<SyncStatus>('/api/admin/jellyfin-status');
    }

    async syncJellyfin(): Promise<SyncStatus> {
        return this.api.post<SyncStatus>('/api/admin/jellyfin-sync', {});
    }

    async getQbittorrentStatus(): Promise<SyncStatus> {
        return this.api.get<SyncStatus>('/api/admin/qbittorrent-status');
    }

    async syncQbittorrent(): Promise<SyncStatus> {
        return this.api.post<SyncStatus>('/api/admin/qbittorrent-sync', {});
    }

    async deleteLibraryItem(jellyfinId: string): Promise<{ deleted: boolean }> {
        return this.api.delete<{ deleted: boolean }>(`/api/admin/library/${encodeURIComponent(jellyfinId)}`);
    }
}
