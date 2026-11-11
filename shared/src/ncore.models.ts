import type { MetadataLookup, MovieMetadata } from './tmdb.models.js';
import type { TrackerId } from './tracker.models.js';

export type NcoreCategoryKey = 'all' | 'movies' | 'tv';

export type TvType = 'episode' | 'season' | 'series';

export interface TvInfo {
    type: TvType;
    season: number | null;
    episode: number | null;
}

export interface NcoreResult {
    tracker: TrackerId;
    torrent_id: string;
    category: string;
    release_name: string;
    details_url: string;
    download_url: string;
    freeleech: boolean;
    imdb_id: string;
    imdb_rating: string;
    size: number;
    type: string;
    leechers: number;
    seeders: number;
    metadata_lookup: MetadataLookup;
    tvInfo: TvInfo | null;
    metadata: MovieMetadata | null;
    fromCache: boolean;
}

export interface NcoreSearchResponse {
    category: NcoreCategoryKey;
    results: NcoreResult[];
    totalResults: number;
    page: number;
    perPage: number;
}
