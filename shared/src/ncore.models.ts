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

export const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

export interface MovieMetadata {
  tmdbId: number;
  mediaType: 'movie' | 'tv' | '';
  title: string;
  year: string;
  poster: string;
  genre: string;
  rating: string;
  plot: string;
  runtime: string;
  rated: string;
}

export interface MovieDetailMetadata {
  plot: string;
  runtime: string;
  rated: string;
  releaseDate: string;
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
