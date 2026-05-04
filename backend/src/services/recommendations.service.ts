import { getAiRecommendations, isOpenAiAvailable } from './openai.service.js';
import type { AiSuggestion } from './openai.service.js';
import { fetchTopRatedRecommendations, enrichRecommendations } from './metadata.service.js';
import { hasFeedback, getAllFeedback, getFreshCache, setCache } from '../repositories/recommendations.repository.js';
import type { AiRecommendation, RecommendationsResponse } from 'shared/recommendations.models';
import type { MediaType } from 'shared/tmdb.models';
import type { FeedbackRow } from '../repositories/recommendations.repository.js';

const RECOMMEND_COUNT = 10;
const FEEDBACK_SAMPLE_SIZE = 100;
const MIN_AI_SUGGESTIONS = 3;

const MIXED_MEDIA_TYPES: [MediaType, MediaType] = ['movie', 'tv'];

class RecommendationsService {
    async getRecommendations(userId: number, filter: MediaType | null = null): Promise<RecommendationsResponse> {
        const canRefresh = await hasFeedback(userId);

        const cached = await getFreshCache(userId, filter);
        if (cached) {
            return { recommendations: await enrichRecommendations(cached.refs, cached.feedbackMap), canRefresh };
        }

        const allFeedback = await getAllFeedback(userId);

        if (allFeedback.length === 0 || !isOpenAiAvailable()) {
            const refs = await this.getTopRatedRefs(filter);
            return { recommendations: await enrichRecommendations(refs), canRefresh: false };
        }

        if (filter) {
            const refs = await this.getPersonalizedRefs(filter, allFeedback);
            return this.buildAndCacheResponse(refs, userId, filter);
        }

        const [movieRefs, tvRefs] = await Promise.all(
            MIXED_MEDIA_TYPES.map((mediaType) => this.getPersonalizedRefs(mediaType, allFeedback)),
        );
        return this.buildAndCacheResponse(this.interleaveRefs(movieRefs, tvRefs), userId, null);
    }

    private buildFeedbackContext(feedback: FeedbackRow[]): string {
        const liked = feedback.filter((f) => f.feedback === 'like');
        const disliked = feedback.filter((f) => f.feedback === 'dislike');

        const parts: string[] = [];
        if (liked.length > 0) parts.push(`Liked: ${liked.map((f) => f.title).join('; ')}`);
        if (disliked.length > 0) parts.push(`Disliked: ${disliked.map((f) => f.title).join('; ')}`);

        return parts.join('\n\n');
    }

    private toAiRefs(suggestions: AiSuggestion[], mediaType: MediaType): AiRecommendation[] {
        return suggestions.map((s) => ({ title: s.title, year: s.year, mediaType, reason: s.reason }));
    }

    private getMediaFeedback(feedback: FeedbackRow[], mediaType: MediaType): FeedbackRow[] {
        return feedback.filter((row) => row.media_type === mediaType);
    }

    private sampleFeedback(feedback: FeedbackRow[]): FeedbackRow[] {
        return [...feedback].sort(() => Math.random() - 0.5).slice(0, FEEDBACK_SAMPLE_SIZE);
    }

    private getRatedTitles(feedback: FeedbackRow[]): string[] {
        return [...new Set(feedback.map((row) => row.title))];
    }

    private interleaveRefs(first: AiRecommendation[], second: AiRecommendation[]): AiRecommendation[] {
        const refs: AiRecommendation[] = [];
        const maxLen = Math.max(first.length, second.length);

        for (let i = 0; i < maxLen; i++) {
            if (first[i]) refs.push(first[i]);
            if (second[i]) refs.push(second[i]);
        }

        return refs;
    }

    private async getTopRatedRefs(filter: MediaType | null): Promise<AiRecommendation[]> {
        return fetchTopRatedRecommendations(RECOMMEND_COUNT, filter);
    }

    private async getPersonalizedRefs(mediaType: MediaType, feedback: FeedbackRow[]): Promise<AiRecommendation[]> {
        const mediaFeedback = this.getMediaFeedback(feedback, mediaType);
        if (mediaFeedback.length === 0) return this.getTopRatedRefs(mediaType);

        const suggestions = await getAiRecommendations(
            this.buildFeedbackContext(this.sampleFeedback(mediaFeedback)),
            this.getRatedTitles(mediaFeedback),
            RECOMMEND_COUNT,
            mediaType,
        );

        return suggestions.length >= MIN_AI_SUGGESTIONS
            ? this.toAiRefs(suggestions, mediaType)
            : this.getTopRatedRefs(mediaType);
    }

    private async buildAndCacheResponse(
        refs: AiRecommendation[],
        userId: number,
        filter: MediaType | null,
    ): Promise<RecommendationsResponse> {
        await setCache(refs, userId, filter);
        return { recommendations: await enrichRecommendations(refs), canRefresh: true };
    }
}

export const recommendationsService = new RecommendationsService();
