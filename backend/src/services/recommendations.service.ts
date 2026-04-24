import { chatCompletion, isOpenAiAvailable } from './openai.service.js';
import {
  fetchTopRatedRecommendations,
  searchRecommendation,
  enrichRecommendationsWithImdbIds,
} from './tmdb.service.js';
import {
  hasFeedback,
  getRandomFeedbackSample,
  getFreshCache,
  setCache,
} from '../repositories/recommendations.repository.js';
import type { Recommendation, RecommendationsResponse } from 'shared/recommendations.models';

const RECOMMEND_COUNT = 10;
const FEEDBACK_SAMPLE_SIZE = 25;

interface AiSuggestion {
  title: string;
  year: string;
  mediaType: 'movie' | 'tv';
}

async function fetchAiSuggestions(feedbackContext: string, filter: 'movie' | 'tv' | null): Promise<AiSuggestion[]> {
  const typeConstraint =
    filter === 'movie'
      ? 'Only recommend movies, no TV shows. All entries must have mediaType "movie".'
      : filter === 'tv'
        ? 'Only recommend TV shows, no movies. All entries must have mediaType "tv".'
        : 'Mix movies and TV shows freely.';
  const systemPrompt = `You are a movie and TV show recommendation assistant.
The user will share a list of titles they liked or disliked.
Based on their taste, recommend ${RECOMMEND_COUNT} great movies and TV shows they would enjoy — from any era, any country.
Prioritize critically acclaimed and beloved titles. Avoid generic blockbusters unless truly fitting.
${typeConstraint}
Respond ONLY with a valid JSON array, no explanation, no markdown.
Each object: { "title": "...", "year": "YYYY", "mediaType": "movie" | "tv" }`;

  const userMessage = `Here are my ratings:\n${feedbackContext}\n\nPlease give me ${RECOMMEND_COUNT} recommendations I haven't seen yet.`;

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
        if (!title) return null;
        return { title, year, mediaType } satisfies AiSuggestion;
      })
      .filter((x): x is AiSuggestion => x !== null);
  } catch {
    return [];
  }
}

async function enrichSuggestions(suggestions: AiSuggestion[]): Promise<Recommendation[]> {
  const results: Recommendation[] = [];
  for (const s of suggestions) {
    const rec = await searchRecommendation(s.title, s.year, s.mediaType);
    if (rec) results.push(rec);
  }
  return results;
}

export async function getRecommendations(
  userId: number,
  filter: 'movie' | 'tv' | null = null,
): Promise<RecommendationsResponse> {
  const [cached, canRefresh] = await Promise.all([getFreshCache(userId, filter), hasFeedback(userId)]);
  if (cached) return { recommendations: cached, canRefresh };

  const feedback = await getRandomFeedbackSample(FEEDBACK_SAMPLE_SIZE, userId);

  let recommendations: Recommendation[];

  if (feedback.length === 0 || !isOpenAiAvailable()) {
    recommendations = await fetchTopRatedRecommendations(RECOMMEND_COUNT, filter);
  } else {
    const feedbackContext = feedback.map((f) => `"${f.title}" · ${f.summary} · ${f.feedback}d`).join('\n');

    const suggestions = await fetchAiSuggestions(feedbackContext, filter);

    if (suggestions.length >= 3) {
      recommendations = await enrichSuggestions(suggestions);
    } else {
      recommendations = await fetchTopRatedRecommendations(RECOMMEND_COUNT, filter);
    }
  }

  recommendations = await enrichRecommendationsWithImdbIds(recommendations);

  if (recommendations.length > 0) {
    await setCache(recommendations, userId, filter);
  }

  return { recommendations, canRefresh: feedback.length > 0 };
}
