export type NcoreCategoryKey = 'all' | 'movies' | 'tv';

export type TvType = 'episode' | 'season' | 'series';

export interface TvInfo {
  type: TvType;
  season: number | null;
  episode: number | null;
}

export interface MetadataLookup {
  imdbId: string;
  title: string;
  year: string;
}

export interface MovieMetadata {
  title: string;
  year: string;
  poster: string;
  genre: string;
  runtime: string;
  rating: string;
  rated: string;
  plot: string;
}

export interface NcoreResult {
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

export const DOWNLOAD_CATEGORIES = ['Movies', 'TV Shows'] as const;
export type DownloadCategory = (typeof DOWNLOAD_CATEGORIES)[number];

export interface DownloadRequest {
  downloadUrl: string;
  savePath: string;
  category: DownloadCategory;
}

export interface DownloadResponse {
  success: boolean;
  message: string;
}

export interface UserInfo {
  id: number;
  username: string;
  valid: boolean;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  last_login: string | null;
  credential_count: number;
}
