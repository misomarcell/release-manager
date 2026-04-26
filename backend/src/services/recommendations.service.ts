import { chatCompletion, isOpenAiAvailable } from './openai.service.js';
import {
  fetchTopRatedRecommendations,
  searchRecommendation,
  enrichRecommendationsWithImdbIds,
} from './tmdb.service.js';
import { hasFeedback, getAllFeedback, getFreshCache, setCache } from '../repositories/recommendations.repository.js';
import { mapConcurrent } from '../utils/concurrent.js';
import type { Recommendation, RecommendationsResponse } from 'shared/recommendations.models';

const RECOMMEND_COUNT = 10;
const FEEDBACK_SAMPLE_SIZE = 50;

interface AiSuggestion {
  title: string;
  year: string;
  mediaType: 'movie' | 'tv';
  reason: string;
}

async function fetchAiSuggestions(
  feedbackContext: string,
  filter: 'movie' | 'tv' | null,
  excludeTitles: string[],
): Promise<AiSuggestion[]> {
  const typeConstraint =
    filter === 'movie'
      ? 'Only recommend movies, no TV shows. All entries must have mediaType "movie".'
      : filter === 'tv'
        ? 'Only recommend TV shows, no movies. All entries must have mediaType "tv".'
        : 'Mix movies and TV shows freely.';
  const exclusionSection =
    excludeTitles.length > 0
      ? `\nDo NOT recommend any of these titles the user has already rated:\n${excludeTitles.map((t) => `  - ${t}`).join('\n')}\n`
      : '';
  const systemPrompt = `You are a movie and TV show recommendation assistant.
The user will share a list of titles they liked or disliked.
Based on their taste, recommend ${RECOMMEND_COUNT} great movies and TV shows they would enjoy — from any era, any country.
Prioritize critically acclaimed and beloved titles. Avoid generic blockbusters unless truly fitting.
${typeConstraint}${exclusionSection}
Respond ONLY with a valid JSON array, no explanation, no markdown.
Each object: { "title": "...", "year": "YYYY", "mediaType": "movie" | "tv", "reason": "one short sentence why this fits the user's taste" }`;

  const userMessage = `My ratings:

${feedbackContext}

Recommend ${RECOMMEND_COUNT} titles I would enjoy.`;

  const content = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.8, maxTokens: 1024 },
  );

  if (!content) return [];

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        const r = item as Record<string, unknown>;
        const title = typeof r['title'] === 'string' ? r['title'] : '';
        const year = typeof r['year'] === 'string' ? r['year'] : '';
        const rawType = typeof r['mediaType'] === 'string' ? r['mediaType'] : '';
        const mediaType = rawType === 'tv' ? 'tv' : 'movie';
        const reason = typeof r['reason'] === 'string' ? r['reason'].trim() : '';
        if (!title) return null;
        return { title, year, mediaType, reason } satisfies AiSuggestion;
      })
      .filter((x): x is AiSuggestion => x !== null);
  } catch {
    return [];
  }
}

async function enrichSuggestions(suggestions: AiSuggestion[]): Promise<Recommendation[]> {
  const results = await mapConcurrent(suggestions, 4, async (s) => {
    const rec = await searchRecommendation(s.title, s.year, s.mediaType);
    if (!rec) return null;
    return s.reason ? { ...rec, reason: s.reason } : rec;
  });
  return results.filter((r): r is Recommendation => r !== null);
}

export async function getRecommendations(
  userId: number,
  filter: 'movie' | 'tv' | null = null,
): Promise<RecommendationsResponse> {
  const [cached, canRefresh] = await Promise.all([getFreshCache(userId, filter), hasFeedback(userId)]);
  if (cached) return { recommendations: cached, canRefresh };

  const allFeedback = await getAllFeedback(userId);
  const ratedTmdbIds = new Set(allFeedback.map((r) => r.tmdb_id));
  const ratedTitles = allFeedback.map((r) => r.title);
  const feedback =
    allFeedback.length <= FEEDBACK_SAMPLE_SIZE
      ? allFeedback
      : allFeedback.sort(() => Math.random() - 0.5).slice(0, FEEDBACK_SAMPLE_SIZE);

  let recommendations: Recommendation[];

  if (allFeedback.length === 0 || !isOpenAiAvailable()) {
    recommendations = await fetchTopRatedRecommendations(RECOMMEND_COUNT, filter);
  } else {
    const liked = feedback.filter((f) => f.feedback === 'like');
    const disliked = feedback.filter((f) => f.feedback === 'dislike');

    const formatEntry = (f: { title: string; media_type: string }) =>
      `  • "${f.title}" (${f.media_type === 'tv' ? 'TV Show' : 'Movie'})`;

    const parts: string[] = [];
    if (liked.length > 0) {
      parts.push(`👍 Liked (${liked.length}):\n${liked.map(formatEntry).join('\n')}`);
    }
    if (disliked.length > 0) {
      parts.push(`👎 Disliked (${disliked.length}):\n${disliked.map(formatEntry).join('\n')}`);
    }
    const feedbackContext = parts.join('\n\n');

    const suggestions = await fetchAiSuggestions(feedbackContext, filter, ratedTitles);

    if (suggestions.length >= 3) {
      recommendations = await enrichSuggestions(suggestions);
      // Post-AI guard: remove rated items and any items with wrong media type
      recommendations = recommendations.filter((r) => !ratedTmdbIds.has(r.tmdbId));
      if (filter !== null) {
        recommendations = recommendations.filter((r) => r.mediaType === filter);
      }
    } else {
      recommendations = await fetchTopRatedRecommendations(RECOMMEND_COUNT, filter);
    }
  }

  recommendations = await enrichRecommendationsWithImdbIds(recommendations);

  if (recommendations.length > 0) {
    await setCache(recommendations, userId, filter);
  }

  return { recommendations, canRefresh: allFeedback.length > 0 };
}
