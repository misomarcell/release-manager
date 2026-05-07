import { getAiRecommendations, isOpenAiAvailable } from './openai.service.js';
import type { AiSuggestion } from './openai.service.js';
import { getMetadata } from './metadata.service.js';
import { tmdbService } from './tmdb.service.js';
import { getFeedbackForMediaType, getFreshCache, setCache } from '../repositories/recommendations.repository.js';
import { mapConcurrent } from '../utils/concurrent.js';
import type { Recommendation, RecommendationRef, RecommendationsResponse } from 'shared/recommendations.models';
import type { MediaType } from 'shared/tmdb.models';
import type { FeedbackRow } from '../repositories/recommendations.repository.js';

const RECOMMEND_COUNT = 10;
const FEEDBACK_SAMPLE_SIZE = 100;
const MIN_AI_SUGGESTIONS = 3;

class RecommendationsService {
    async getPersonalizedRecommendations(
        userId: number,
        mediaType: MediaType,
    ): Promise<RecommendationsResponse> {
        const feedback = await getFeedbackForMediaType(userId, mediaType);
        const canRefresh = feedback.length > 0;

        const cached = await getFreshCache(userId, mediaType);
        if (cached) {
            return { recommendations: await this.enrichRecommendations(cached.refs), canRefresh };
        }

        if (feedback.length === 0 || !isOpenAiAvailable()) {
            const refs = await this.getTopRatedRefs(mediaType);
            return { recommendations: await this.enrichRecommendations(refs), canRefresh: false };
        }

        const refs = await this.getPersonalizedRefs(mediaType, feedback);
        return this.buildAndCacheResponse(refs, userId, mediaType);
    }

    async getTrendingRecommendations(
        mediaType: MediaType,
    ): Promise<RecommendationsResponse> {
        const refs = await this.getTrendingRefs(mediaType);
        return { recommendations: await this.enrichRecommendations(refs), canRefresh: false };
    }

    private buildFeedbackContext(feedback: FeedbackRow[]): string {
        const liked = feedback.filter((f) => f.feedback === 'like');
        const disliked = feedback.filter((f) => f.feedback === 'dislike');

        const parts: string[] = [];
        if (liked.length > 0) parts.push(`Liked: ${liked.map((f) => f.title).join('; ')}`);
        if (disliked.length > 0) parts.push(`Disliked: ${disliked.map((f) => f.title).join('; ')}`);

        return parts.join('\n\n');
    }

    private toRecommendationRefs(suggestions: AiSuggestion[], mediaType: MediaType): RecommendationRef[] {
        return suggestions.map((s) => ({ title: s.title, year: s.year, mediaType, reason: s.reason }));
    }

    private sampleFeedback(feedback: FeedbackRow[]): FeedbackRow[] {
        return [...feedback].sort(() => Math.random() - 0.5).slice(0, FEEDBACK_SAMPLE_SIZE);
    }

    private getRatedTitles(feedback: FeedbackRow[]): string[] {
        return [...new Set(feedback.map((row) => row.title))];
    }

    private async getTopRatedRefs(mediaType: MediaType): Promise<RecommendationRef[]> {
        return tmdbService.fetchTopRated(RECOMMEND_COUNT, mediaType);
    }

    private async getTrendingRefs(mediaType: MediaType): Promise<RecommendationRef[]> {
        return tmdbService.fetchTrending(RECOMMEND_COUNT, mediaType);
    }

    private async getPersonalizedRefs(mediaType: MediaType, feedback: FeedbackRow[]): Promise<RecommendationRef[]> {
        if (feedback.length === 0) return this.getTopRatedRefs(mediaType);

        const suggestions = await getAiRecommendations(
            this.buildFeedbackContext(this.sampleFeedback(feedback)),
            this.getRatedTitles(feedback),
            RECOMMEND_COUNT,
            mediaType,
        );

        return suggestions.length >= MIN_AI_SUGGESTIONS
            ? this.toRecommendationRefs(suggestions, mediaType)
            : this.getTopRatedRefs(mediaType);
    }

    private async buildAndCacheResponse(
        refs: RecommendationRef[],
        userId: number,
        mediaType: MediaType,
    ): Promise<RecommendationsResponse> {
        await setCache(refs, userId, mediaType);
        return { recommendations: await this.enrichRecommendations(refs), canRefresh: true };
    }

    private async enrichRecommendations(refs: RecommendationRef[]): Promise<Recommendation[]> {
        const results = await mapConcurrent(refs, 4, (ref) => this.enrichRecommendation(ref));
        return results.filter((result): result is Recommendation => result !== null);
    }

    private async enrichRecommendation(ref: RecommendationRef): Promise<Recommendation | null> {
        const { metadata } = await getMetadata({
            title: ref.title,
            year: ref.year,
            imdbId: '',
            ...(ref.tmdbId ? { tmdbId: ref.tmdbId, mediaType: ref.mediaType } : { mediaType: ref.mediaType }),
        });
        if (!metadata) return null;

        return {
            tmdbId: metadata.tmdbId,
            mediaType: metadata.mediaType,
            title: metadata.title,
            year: metadata.year,
            poster: metadata.poster,
            genre: metadata.genre,
            rating: metadata.rating,
            plot: metadata.plot,
            ...(metadata.imdbId ? { imdbId: metadata.imdbId } : {}),
            ...(metadata.trailerKey ? { trailerKey: metadata.trailerKey } : {}),
            ...(ref.reason ? { reason: ref.reason } : {}),
            inJellyfinLibrary: metadata.inJellyfinLibrary,
        };
    }
}

export const recommendationsService = new RecommendationsService();
