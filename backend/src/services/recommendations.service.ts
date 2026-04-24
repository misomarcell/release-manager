import { config } from '../config.js';
import { asRecord, asString } from '../utils/coerce.js';
import { fetchTopRatedRecommendations, searchRecommendation } from './tmdb.service.js';
import { getRandomFeedbackSample, getFreshCache, setCache } from '../repositories/recommendations.repository.js';
import type { Recommendation } from 'shared/recommendations.models';

const OPENAI_BASE = 'https://api.openai.com/v1';
const RECOMMEND_COUNT = 10;
const FEEDBACK_SAMPLE_SIZE = 25;

interface AiSuggestion {
  title: string;
  year: string;
  mediaType: 'movie' | 'tv';
}

async function fetchAiSuggestions(feedbackContext: string): Promise<AiSuggestion[]> {
  const systemPrompt = `You are a movie and TV show recommendation assistant.
The user will share a list of titles they liked or disliked.
Based on their taste, recommend ${RECOMMEND_COUNT} great movies and TV shows they would enjoy — from any era, any country.
Prioritize critically acclaimed and beloved titles. Avoid generic blockbusters unless truly fitting.
Respond ONLY with a valid JSON array, no explanation, no markdown.
Each object: { "title": "...", "year": "YYYY", "mediaType": "movie" | "tv" }`;

  const userMessage = `Here are my ratings:\n${feedbackContext}\n\nPlease give me ${RECOMMEND_COUNT} recommendations I haven't seen yet.`;

  try {
    const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) return [];

    const data = asRecord(await res.json());
    const choices = Array.isArray(data['choices']) ? data['choices'] : [];
    if (choices.length === 0) return [];

    const content = asString(asRecord(asRecord(choices[0])['message'])['content']) || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        const r = asRecord(item as Record<string, unknown>);
        const title = asString(r['title']);
        const year = asString(r['year']);
        const rawType = asString(r['mediaType']);
        const mediaType = rawType === 'tv' ? 'tv' : 'movie';
        if (!title) return null;
        return { title, year: year || '', mediaType } satisfies AiSuggestion;
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

export async function getRecommendations(): Promise<Recommendation[]> {
  const cached = await getFreshCache();
  if (cached) return cached;

  const feedback = await getRandomFeedbackSample(FEEDBACK_SAMPLE_SIZE);

  let recommendations: Recommendation[];

  if (feedback.length === 0 || !config.openai.apiKey) {
    recommendations = await fetchTopRatedRecommendations(RECOMMEND_COUNT);
  } else {
    const feedbackContext = feedback.map((f) => `"${f.title}" · ${f.summary} · ${f.feedback}d`).join('\n');

    const suggestions = await fetchAiSuggestions(feedbackContext);

    if (suggestions.length >= 3) {
      recommendations = await enrichSuggestions(suggestions);
    } else {
      recommendations = await fetchTopRatedRecommendations(RECOMMEND_COUNT);
    }
  }

  if (recommendations.length > 0) {
    await setCache(recommendations);
  }

  return recommendations;
}
