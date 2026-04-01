export type NcoreCategoryKey = 'all' | 'movies' | 'tv';

export type TvType = 'episode' | 'season' | 'series';

export interface TvInfo {
  type: TvType;
  season: number | null;
  episode: number | null;
}

export interface NcoreOmdbLookup {
  imdbId: string;
  title: string;
  year: string;
}

export interface OmdbMetadata {
  title: string;
  year: string;
  poster: string;
  genre: string;
  runtime: string;
  imdbRating: string;
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
  omdb_lookup: NcoreOmdbLookup;
  tvInfo: TvInfo | null;
  omdb: OmdbMetadata | null;
  fromCache: boolean;
}

export interface NcoreSearchResponse {
  category: NcoreCategoryKey;
  results: NcoreResult[];
  totalResults: number;
  page: number;
  perPage: number;
}

export type DownloadCategory = 'movies' | 'tv';

export interface DownloadRequest {
  torrentId: string;
  savePath: string;
  category: DownloadCategory;
}

export interface DownloadResponse {
  success: boolean;
  message: string;
}
