export interface JellyfinSyncStatus {
  lastSync: string | null;
  success: boolean | null;
  itemCount: number | null;
  errorMessage: string | null;
}

export interface LibraryItem {
  jellyfinId: string;
  tmdbId: number | null;
  mediaType: 'movie' | 'tv' | null;
  title: string;
  year: string | null;
  syncedAt: string;
  poster: string | null;
  genre: string | null;
  rating: string | null;
}

export interface LibraryResponse {
  items: LibraryItem[];
  total: number;
  page: number;
  perPage: number;
  jellyfinBaseUrl: string;
}
