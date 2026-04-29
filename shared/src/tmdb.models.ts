export type MediaType = 'movie' | 'tv';

export interface MetadataLookup {
  imdbId: string;
  title: string;
  year: string;
}

export interface MovieMetadata {
  tmdbId: number;
  mediaType: MediaType | '';
  title: string;
  year: string;
  poster: string;
  genre: string;
  rating: string;
  plot: string;
  runtime: string;
  rated: string;
  inJellyfinLibrary?: boolean;
}

export interface MovieDetailMetadata {
  plot: string;
  runtime: string;
  rated: string;
  releaseDate: string;
  trailerKey?: string;
}
