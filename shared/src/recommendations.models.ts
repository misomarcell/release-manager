import type { MediaType } from './tmdb.models.js';

export interface AiRecommendation {
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
    feedback?: FeedbackValue;
    inJellyfinLibrary?: boolean;
}

export type FeedbackValue = 'like' | 'dislike';

export interface RecommendationFeedbackRequest {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    summary: string;
    feedback: FeedbackValue;
}

export interface RecommendationsResponse {
    recommendations: Recommendation[];
    canRefresh: boolean;
}
