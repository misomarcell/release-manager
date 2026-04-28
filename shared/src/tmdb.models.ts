export interface MetadataLookup {
  imdbId: string;
  title: string;
  year: string;
}

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
  trailerKey?: string;
}
