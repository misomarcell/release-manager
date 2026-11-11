import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import type { NcoreCategoryKey, NcoreSearchResponse } from '@rm/shared/ncore.models';
import type { DownloadRequest, DownloadResponse } from '@rm/shared/download.models';
import type { MediaType, MovieMetadata, TitleSearchResponse } from '@rm/shared/tmdb.models';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = inject(ApiService);

  async search(
    category: NcoreCategoryKey = 'movies',
    search = '',
    page = 1,
    perPage = 100,
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

    return this.api.get<NcoreSearchResponse>('/api/search', params);
  }

  async fetchNfo(torrentId: string): Promise<string> {
    return this.api.getText(`/api/search/nfo/${torrentId}`);
  }

  async download(request: DownloadRequest): Promise<DownloadResponse> {
    return this.api.post<DownloadResponse>('/api/search/download', request);
  }

  async fetchMovieDetail(tmdbId: number, mediaType: MediaType): Promise<MovieMetadata> {
    const params = new HttpParams().set('type', mediaType);
    return this.api.get<MovieMetadata>(`/api/search/metadata/${tmdbId}`, params);
  }

  async searchTitles(query: string, mediaType: MediaType | null): Promise<TitleSearchResponse> {
    let params = new HttpParams().set('q', query);
    if (mediaType) {
      params = params.set('type', mediaType);
    }
    return this.api.get<TitleSearchResponse>('/api/search/titles', params);
  }
}
