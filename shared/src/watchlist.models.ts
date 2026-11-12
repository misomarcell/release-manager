import type { MediaType } from './tmdb.models.js';
import type { TrackerFailure, TrackerId } from './tracker.models.js';

export const WATCHLIST_MAX_KEYWORDS = 10;
export const WATCHLIST_MAX_KEYWORD_LENGTH = 40;

export interface WatchlistRelease {
    tracker: TrackerId;
    torrentId: string;
    releaseName: string;
    detailsUrl: string;
    size: number;
    foundAt: string;
}

export interface WatchlistItem {
    id: number;
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    year: string;
    poster: string;
    imdbId: string;
    keywords: string[];
    releaseCount: number;
    newReleases: WatchlistRelease[];
    lastCheckedAt: string | null;
    createdAt: string;
}

export interface WatchlistAddRequest {
    tmdbId: number;
    mediaType: MediaType;
    keywords: string[];
}

export interface WatchlistUpdateRequest {
    keywords: string[];
}

export interface WatchlistResponse {
    items: WatchlistItem[];
}

export interface WatchlistCheckResponse extends WatchlistResponse {
    failures: TrackerFailure[];
}
