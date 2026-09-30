import { getAiRecommendations, isOpenAiAvailable } from './openai.service.js';
import type { AiSuggestion } from './openai.service.js';
import { getMetadata } from './metadata.service.js';
import { tmdbService } from './tmdb.service.js';
import { getCache, getFeedbackForMediaType, setCache } from '../repositories/recommendations.repository.js';
import { getLibraryTitles } from '../repositories/jellyfin.repository.js';
import { mapConcurrent } from '../utils/concurrent.js';
import type { Recommendation, RecommendationRef, RecommendationsResponse } from 'shared/recommendations.models';
import type { MediaType } from 'shared/tmdb.models';
import type { FeedbackRow } from '../repositories/recommendations.repository.js';

const PERSONALIZED_RECOMMEND_COUNT = 10;
const AI_SUGGESTION_BUFFER = 5;
const MAX_RATED_TITLES = 1000;
const MAX_OWNED_TITLES = 2000;
const MIN_AI_SUGGESTIONS = 3;

class RecommendationsService {
    async getPersonalizedRecommendations(
        userId: number,
        mediaType: MediaType,
        forceRefresh = false,
    ): Promise<RecommendationsResponse> {
        const feedback = await getFeedbackForMediaType(userId, mediaType);
        const canRefresh = feedback.length > 0;

        const cached = await getCache(userId, mediaType);
        if (cached?.fresh && !forceRefresh) {
            return { recommendations: await this.enrichRecommendations(cached.refs), canRefresh };
        }

        if (feedback.length === 0 || !isOpenAiAvailable()) {
            const refs = await this.getTopRatedRefs(mediaType);
            return { recommendations: await this.enrichRecommendations(refs), canRefresh: false };
        }

        const recommendations = await this.getAiPersonalized(userId, mediaType, feedback, cached?.refs ?? []);
        if (recommendations.length < MIN_AI_SUGGESTIONS) {
            const refs = await this.getTopRatedRefs(mediaType);
            await setCache(refs, userId, mediaType);
            return { recommendations: await this.enrichRecommendations(refs), canRefresh };
        }

        await setCache(recommendations.map(this.toRef), userId, mediaType);
        return { recommendations, canRefresh };
    }

    async getTrendingRecommendations(mediaType: MediaType): Promise<RecommendationsResponse> {
        const refs = await this.getTrendingRefs(mediaType);
        return { recommendations: await this.enrichRecommendations(refs), canRefresh: false };
    }

    private async getAiPersonalized(
        userId: number,
        mediaType: MediaType,
        feedback: FeedbackRow[],
        previousRefs: RecommendationRef[],
    ): Promise<Recommendation[]> {
        const suggestions = await getAiRecommendations({
            userId,
            mediaType,
            count: PERSONALIZED_RECOMMEND_COUNT + AI_SUGGESTION_BUFFER,
            rated: feedback.slice(-MAX_RATED_TITLES),
            owned: await getLibraryTitles(mediaType, MAX_OWNED_TITLES),
            previouslySuggested: previousRefs,
        });

        const enriched = await this.enrichRecommendations(this.toSuggestionRefs(suggestions, mediaType));
        const ratedIds = new Set(feedback.map((row) => row.tmdbId));
        const seenIds = new Set<number>();

        return enriched
            .filter((rec) => {
                if (ratedIds.has(rec.tmdbId) || rec.inJellyfinLibrary || seenIds.has(rec.tmdbId)) return false;
                seenIds.add(rec.tmdbId);
                return true;
            })
            .slice(0, PERSONALIZED_RECOMMEND_COUNT);
    }

    private toSuggestionRefs(suggestions: AiSuggestion[], mediaType: MediaType): RecommendationRef[] {
        return suggestions.map((s) => ({ title: s.title, year: s.year, mediaType, reason: s.reason }));
    }

    private toRef(rec: Recommendation): RecommendationRef {
        return {
            tmdbId: rec.tmdbId,
            mediaType: rec.mediaType,
            title: rec.title,
            year: rec.year,
            ...(rec.reason ? { reason: rec.reason } : {}),
        };
    }

    private async getTopRatedRefs(mediaType: MediaType): Promise<RecommendationRef[]> {
        return tmdbService.fetchTopRated(PERSONALIZED_RECOMMEND_COUNT, mediaType);
    }

    private async getTrendingRefs(mediaType: MediaType): Promise<RecommendationRef[]> {
        return tmdbService.fetchTrending(mediaType);
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
