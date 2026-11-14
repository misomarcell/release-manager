import type { MediaType } from './tmdb.models.js';

export interface RecommendationRef {
    tmdbId?: number;
    mediaType: MediaType;
    title: string;
    year: string;
    reason?: string;
}

export interface Recommendation {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    year: string;
    poster: string;
    genre: string;
    rating: string;
    plot: string;
    imdbId?: string;
    trailerKey?: string;
    reason?: string;
    inJellyfinLibrary?: boolean;
}

export type FeedbackValue = 'like' | 'dislike';

export interface RecommendationFeedbackRequest {
    tmdbId: number;
    mediaType: MediaType;
    feedback: FeedbackValue;
}

/** Why a personalized list holds TMDB top-rated titles instead of AI picks. */
export type RecommendationFallback = 'no-feedback' | 'unavailable';

export interface RecommendationsResponse {
    recommendations: Recommendation[];
    canRefresh: boolean;
    fallback?: RecommendationFallback;
}
