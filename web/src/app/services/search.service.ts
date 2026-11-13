import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import type { DownloadPaths, DownloadRequest, DownloadResponse } from '@rm/shared/download.models';
import type { MediaType, MovieMetadata, TitleSearchResponse } from '@rm/shared/tmdb.models';
import type {
    ReleaseCategory,
    ReleaseSearchResponse,
    TitleReleasesResponse,
    TrackerId,
} from '@rm/shared/tracker.models';

interface ReleaseSearchOptions {
    category: ReleaseCategory;
    query: string;
    page: number;
    uhd: boolean;
    trackers: TrackerId[];
}

export interface TitleReleasesOptions {
    imdbId: string;
    title: string;
    year: string;
    mediaType: MediaType;
    trackers: TrackerId[];
}

@Injectable({ providedIn: 'root' })
export class SearchService {
    private api = inject(ApiService);

    async search(options: ReleaseSearchOptions): Promise<ReleaseSearchResponse> {
        let params = new HttpParams()
            .set('category', options.category)
            .set('page', options.page.toString())
            .set('trackers', options.trackers.join(','));

        const query = options.query.trim();
        if (query) {
            params = params.set('search', query);
        }

        if (options.uhd) {
            params = params.set('uhd', 'true');
        }

        return this.api.get<ReleaseSearchResponse>('/api/search', params);
    }

    async titleReleases(options: TitleReleasesOptions): Promise<TitleReleasesResponse> {
        const params = new HttpParams()
            .set('imdbId', options.imdbId)
            .set('title', options.title)
            .set('year', options.year)
            .set('type', options.mediaType)
            .set('trackers', options.trackers.join(','));
        return this.api.get<TitleReleasesResponse>('/api/search/releases', params);
    }

    async fetchNfo(tracker: TrackerId, torrentId: string): Promise<string> {
        return this.api.getText(`/api/search/nfo/${tracker}/${torrentId}`);
    }

    async getDownloadPaths(): Promise<DownloadPaths> {
        return this.api.get<DownloadPaths>('/api/search/download-paths');
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
