import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

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
}
