import { MediaType } from './tmdb.models.js';

export interface JellyfinSyncStatus {
    lastSync: string | null;
    success: boolean | null;
    itemCount: number | null;
    errorMessage: string | null;
}

export interface MediaStream {
    type: 'video' | 'audio' | 'subtitle';
    codec: string;
    language: string;
    displayTitle: string;
    width?: number; // video — needed for 4K badge
    videoRangeType?: string; // video — needed for HDR/DV badge
    spatialFormat?: string; // audio — needed for Atmos/DTS:X badge
    profile?: string; // audio — needed for DTS-HD MA badge
}

export interface MediaInfo {
    streams: MediaStream[];
}

export interface LibraryItem {
    jellyfinId: string;
    tmdbId: number | null;
    mediaType: MediaType | null;
    title: string;
    year: string | null;
    syncedAt: string;
    poster: string | null;
    genre: string | null;
    rating: string | null;
    mediaInfo: MediaInfo | null;
    sizeBytes: number | null;
    path: string | null;
}

export interface LibraryResponse {
    items: LibraryItem[];
    total: number;
    page: number;
    perPage: number;
    jellyfinBaseUrl: string;
}
