export interface Recommendation {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: string;
  poster: string;
  genre: string;
  rating: string;
  plot: string;
  imdbId?: string;
}

export type FeedbackValue = 'like' | 'dislike';

export interface RecommendationFeedbackRequest {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  summary: string;
  feedback: FeedbackValue;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  canRefresh: boolean;
}
