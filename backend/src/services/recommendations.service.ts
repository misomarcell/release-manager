import { getAiRecommendations, isOpenAiAvailable } from './openai.service.js';
import type { AiSuggestion } from './openai.service.js';
import { fetchTopRatedRecommendations, enrichRecommendations } from './metadata.service.js';
import { hasFeedback, getAllFeedback, getFreshCache, setCache } from '../repositories/recommendations.repository.js';
import type { AiRecommendation, RecommendationsResponse } from 'shared/recommendations.models';
import type { MediaType } from 'shared/tmdb.models';
import type { FeedbackRow } from '../repositories/recommendations.repository.js';

const RECOMMEND_COUNT = 10;
const FEEDBACK_SAMPLE_SIZE = 100;

function buildFeedbackContext(feedback: FeedbackRow[]): string {
    const liked = feedback.filter((f) => f.feedback === 'like');
    const disliked = feedback.filter((f) => f.feedback === 'dislike');

    const formatEntry = (f: FeedbackRow): string => {
        const type = f.media_type === 'tv' ? 'TV Show' : 'Movie';
        return f.summary ? `  - "${f.title}" (${type}) - ${f.summary}` : `  - "${f.title}" (${type})`;
    };

    const parts: string[] = [];
    if (liked.length > 0) parts.push(`LIKED (${liked.length}):\n${liked.map(formatEntry).join('\n')}`);
    if (disliked.length > 0) parts.push(`DISLIKED (${disliked.length}):\n${disliked.map(formatEntry).join('\n')}`);
    return parts.join('\n\n');
}

function toAiRefs(suggestions: AiSuggestion[], mediaType: MediaType): AiRecommendation[] {
    return suggestions.map((s) => ({ title: s.title, year: s.year, mediaType, reason: s.reason }));
}

export async function getRecommendations(
    userId: number,
    filter: MediaType | null = null,
): Promise<RecommendationsResponse> {
    const canRefresh = await hasFeedback(userId);

    const cached = await getFreshCache(userId, filter);
    if (cached) {
        return { recommendations: await enrichRecommendations(cached.refs, cached.feedbackMap), canRefresh };
    }

    const allFeedback = await getAllFeedback(userId);

    if (allFeedback.length === 0 || !isOpenAiAvailable()) {
        const refs = await fetchTopRatedRecommendations(RECOMMEND_COUNT, filter);
        return { recommendations: await enrichRecommendations(refs), canRefresh: false };
    }

    const ratedTitles = allFeedback.map((r) => r.title);
    const feedbackSample = [...allFeedback].sort(() => Math.random() - 0.5).slice(0, FEEDBACK_SAMPLE_SIZE);

    const { movies: movieSuggestions, tvShows: tvSuggestions } = await getAiRecommendations(
        buildFeedbackContext(feedbackSample),
        ratedTitles,
        RECOMMEND_COUNT,
    );

    const getRefs = (suggestions: AiSuggestion[], mediaType: MediaType): Promise<AiRecommendation[]> =>
        suggestions.length >= 3
            ? Promise.resolve(toAiRefs(suggestions, mediaType))
            : fetchTopRatedRecommendations(RECOMMEND_COUNT, mediaType);

    if (filter === 'movie') {
        const refs = await getRefs(movieSuggestions, 'movie');
        await setCache(refs, userId, 'movie');
        return { recommendations: await enrichRecommendations(refs), canRefresh: true };
    }

    if (filter === 'tv') {
        const refs = await getRefs(tvSuggestions, 'tv');
        await setCache(refs, userId, 'tv');
        return { recommendations: await enrichRecommendations(refs), canRefresh: true };
    }

    const [movieRefs, tvRefs] = await Promise.all([getRefs(movieSuggestions, 'movie'), getRefs(tvSuggestions, 'tv')]);

    const allRefs: AiRecommendation[] = [];
    const maxLen = Math.max(movieRefs.length, tvRefs.length);
    for (let i = 0; i < maxLen; i++) {
        if (movieRefs[i]) allRefs.push(movieRefs[i]);
        if (tvRefs[i]) allRefs.push(tvRefs[i]);
    }
    await setCache(allRefs, userId, null);
    return { recommendations: await enrichRecommendations(allRefs), canRefresh: true };
}
