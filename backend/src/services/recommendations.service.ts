import { getAiRecommendations, isOpenAiAvailable } from './openai.service.js';
import {
  fetchTopRatedRecommendations,
  searchRecommendation,
  enrichRecommendationsWithImdbIds,
} from './tmdb.service.js';
import { hasFeedback, getAllFeedback, getFreshCache, setCache } from '../repositories/recommendations.repository.js';
import { mapConcurrent } from '../utils/concurrent.js';
import type { Recommendation, RecommendationsResponse } from 'shared/recommendations.models';
import type { AiSuggestion } from './openai.service.js';
import type { FeedbackRow } from '../repositories/recommendations.repository.js';

const RECOMMEND_COUNT = 10;
const FEEDBACK_SAMPLE_SIZE = 100;

async function enrichSuggestions(suggestions: AiSuggestion[], mediaType: 'movie' | 'tv'): Promise<Recommendation[]> {
  const results = await mapConcurrent(suggestions, 4, async (s) => {
    const rec = await searchRecommendation(s.title, s.year, mediaType);
    if (!rec) return null;
    return s.reason ? { ...rec, reason: s.reason } : rec;
  });
  return results.filter((r): r is Recommendation => r !== null);
}

function buildFeedbackContext(feedback: FeedbackRow[]): string {
  const liked = feedback.filter((f) => f.feedback === 'like');
  const disliked = feedback.filter((f) => f.feedback === 'dislike');

  const formatEntry = (f: FeedbackRow): string => {
    const type = f.media_type === 'tv' ? 'TV Show' : 'Movie';
    return f.summary ? `  - "${f.title}" (${type}) - ${f.summary}` : `  - "${f.title}" (${type})`;
  };

  const parts: string[] = [];
  if (liked.length > 0) {
    parts.push(`LIKED (${liked.length}):\n${liked.map(formatEntry).join('\n')}`);
  }
  if (disliked.length > 0) {
    parts.push(`DISLIKED (${disliked.length}):\n${disliked.map(formatEntry).join('\n')}`);
  }
  return parts.join('\n\n');
}

export async function getRecommendations(
  userId: number,
  filter: 'movie' | 'tv' | null = null,
): Promise<RecommendationsResponse> {
  const [cached, canRefresh] = await Promise.all([getFreshCache(userId, filter), hasFeedback(userId)]);
  if (cached) return { recommendations: cached, canRefresh };

  const allFeedback = await getAllFeedback(userId);

  if (allFeedback.length === 0 || !isOpenAiAvailable()) {
    const recs = await fetchTopRatedRecommendations(RECOMMEND_COUNT, filter);
    return { recommendations: await enrichRecommendationsWithImdbIds(recs), canRefresh: false };
  }

  const ratedTmdbIds = new Set(allFeedback.map((r) => r.tmdb_id));
  const ratedTitles = allFeedback.map((r) => r.title);
  const feedbackSample =
    allFeedback.length <= FEEDBACK_SAMPLE_SIZE
      ? allFeedback
      : allFeedback.sort(() => Math.random() - 0.5).slice(0, FEEDBACK_SAMPLE_SIZE);

  const feedbackContext = buildFeedbackContext(feedbackSample);

  // Single AI call generates recommendations for both types at once
  const { movies: movieSuggestions, tvShows: tvSuggestions } = await getAiRecommendations(
    feedbackContext,
    ratedTitles,
    RECOMMEND_COUNT,
  );

  // Enrich both in parallel, falling back to TMDB top-rated if AI returned too few
  const [movies, tvShows] = await Promise.all([
    movieSuggestions.length >= 3
      ? enrichSuggestions(movieSuggestions, 'movie').then((recs) =>
          enrichRecommendationsWithImdbIds(recs.filter((r) => !ratedTmdbIds.has(r.tmdbId))),
        )
      : fetchTopRatedRecommendations(RECOMMEND_COUNT, 'movie').then(enrichRecommendationsWithImdbIds),
    tvSuggestions.length >= 3
      ? enrichSuggestions(tvSuggestions, 'tv').then((recs) =>
          enrichRecommendationsWithImdbIds(recs.filter((r) => !ratedTmdbIds.has(r.tmdbId))),
        )
      : fetchTopRatedRecommendations(RECOMMEND_COUNT, 'tv').then(enrichRecommendationsWithImdbIds),
  ]);

  // Cache both types independently so either cached request benefits
  await Promise.all([
    movies.length > 0 ? setCache(movies, userId, 'movie') : Promise.resolve(),
    tvShows.length > 0 ? setCache(tvShows, userId, 'tv') : Promise.resolve(),
  ]);

  if (filter === 'movie') return { recommendations: movies, canRefresh: true };
  if (filter === 'tv') return { recommendations: tvShows, canRefresh: true };

  // null filter: interleave both for a combined view and cache it too
  const combined: Recommendation[] = [];
  const maxLen = Math.max(movies.length, tvShows.length);
  for (let i = 0; i < maxLen; i++) {
    if (movies[i]) combined.push(movies[i]);
    if (tvShows[i]) combined.push(tvShows[i]);
  }
  if (combined.length > 0) await setCache(combined, userId, null);
  return { recommendations: combined, canRefresh: true };
}