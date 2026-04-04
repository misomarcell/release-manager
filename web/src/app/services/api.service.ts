import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { NcoreCategoryKey, NcoreSearchResponse } from '@rm/shared/ncore.models';
import type { DownloadRequest, DownloadResponse } from '@rm/shared/download.models';
import type { MovieDetailMetadata } from '@rm/shared/tmdb.models';
import type { UserInfo } from '@rm/shared/user.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  async search(
    category: NcoreCategoryKey = 'movies',
    search = '',
    page = 1,
    perPage = 1000,
    uhd = false,
  ): Promise<NcoreSearchResponse> {
    let params = new HttpParams()
      .set('category', category)
      .set('page', page.toString())
      .set('perPage', perPage.toString());

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (uhd) {
      params = params.set('uhd', 'true');
    }

    return firstValueFrom(
      this.http.get<NcoreSearchResponse>('/api/search', { params, withCredentials: true }),
    );
  }

  async fetchNfo(torrentId: string): Promise<string> {
    return firstValueFrom(
      this.http.get(`/api/search/nfo/${torrentId}`, {
        withCredentials: true,
        responseType: 'text',
      }),
    );
  }

  async download(request: DownloadRequest): Promise<DownloadResponse> {
    return firstValueFrom(
      this.http.post<DownloadResponse>('/api/search/download', request, { withCredentials: true }),
    );
  }

  async fetchMovieDetail(tmdbId: number, mediaType: string): Promise<MovieDetailMetadata> {
    const params = new HttpParams().set('type', mediaType);
    return firstValueFrom(
      this.http.get<MovieDetailMetadata>(`/api/search/metadata/${tmdbId}`, {
        params,
        withCredentials: true,
      }),
    );
  }

  async getUsers(): Promise<UserInfo[]> {
    return firstValueFrom(this.http.get<UserInfo[]>('/api/users', { withCredentials: true }));
  }

  async setUserValid(userId: number, valid: boolean): Promise<void> {
    await firstValueFrom(
      this.http.patch(`/api/users/${userId}/valid`, { valid }, { withCredentials: true }),
    );
  }

  async deleteUser(userId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/users/${userId}`, { withCredentials: true }));
  }

  async setUserAdmin(userId: number, admin: boolean): Promise<void> {
    await firstValueFrom(
      this.http.patch(`/api/users/${userId}/admin`, { admin }, { withCredentials: true }),
    );
  }

  async clearMetadataCache(): Promise<{ deleted: number }> {
    return firstValueFrom(
      this.http.delete<{ deleted: number }>('/api/admin/metadata-cache', {
        withCredentials: true,
      }),
    );
  }

  async clearExpiredData(): Promise<{ challenges: number; sessions: number }> {
    return firstValueFrom(
      this.http.delete<{ challenges: number; sessions: number }>('/api/admin/expired-data', {
        withCredentials: true,
      }),
    );
  }

  async testQbittorrent(): Promise<{ version: string }> {
    return firstValueFrom(
      this.http.get<{ version: string }>('/api/admin/qbittorrent-test', {
        withCredentials: true,
      }),
    );
  }

  async logOutAllUsers(): Promise<{ deleted: number }> {
    return firstValueFrom(
      this.http.delete<{ deleted: number }>('/api/admin/sessions', {
        withCredentials: true,
      }),
    );
  }
}
