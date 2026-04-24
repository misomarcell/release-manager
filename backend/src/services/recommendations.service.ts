import { config } from '../config.js';
import { asRecord, asString, asNumber } from '../utils/coerce.js';
import { TMDB_GENRE_MAP } from 'shared/constants';
import {
  getAllFeedback,
  getFreshCache,
  setCache,
} from '../repositories/recommendations.repository.js';
import type { Recommendation } from 'shared/recommendations.models';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const OPENAI_BASE = 'https://api.openai.com/v1';
const RECOMMEND_COUNT = 10;

function tmdbAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.tmdb.accessToken}`,
    Accept: 'application/json',
  };
}

async function tmdbGet(path: string, params?: Record<string, string>): Promise<Record<string, unknown> | null> {
  const url = new URL(`${TMDB_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url, { headers: tmdbAuthHeaders() });
    if (!res.ok) return null;
    return asRecord(await res.json());
  } catch {
    return null;
  }
}

function resolveGenres(genreIds: unknown[]): string {
  return genreIds
    .map((id) => TMDB_GENRE_MAP[asNumber(id) ?? 0])
    .filter(Boolean)
    .join(', ');
}

function buildRecommendation(item: Record<string, unknown>, mediaType: 'movie' | 'tv'): Recommendation | null {
  const id = asNumber(item['id']);
  if (!id) return null;

  const title = asString(item[mediaType === 'movie' ? 'title' : 'name']) || '';
  const dateField = mediaType === 'movie' ? 'release_date' : 'first_air_date';
  const dateStr = asString(item[dateField]) || '';
  const year = dateStr.match(/^(\d{4})/)?.[1] ?? '';
  const posterPath = asString(item['poster_path']);
  const poster = posterPath ? `${IMAGE_BASE}${posterPath}` : '';
  const genreIds = Array.isArray(item['genre_ids']) ? item['genre_ids'] : [];
  const genre = resolveGenres(genreIds);
  const voteAverage = asNumber(item['vote_average']);
  const rating = voteAverage ? String(Math.round(voteAverage * 10) / 10) : '';
  const plot = asString(item['overview']) || '';

  return { tmdbId: id, mediaType, title, year, poster, genre, rating, plot };
}

async function fetchTmdbTopRated(): Promise<Recommendation[]> {
  const [movieData, tvData] = await Promise.all([
    tmdbGet('/movie/top_rated', { language: 'en-US', page: '1' }),
    tmdbGet('/tv/top_rated', { language: 'en-US', page: '1' }),
  ]);

  const movies: Recommendation[] = [];
  const tvShows: Recommendation[] = [];

  if (movieData) {
    const results = Array.isArray(movieData['results']) ? movieData['results'] : [];
    for (const item of results.slice(0, 10)) {
      const rec = buildRecommendation(asRecord(item), 'movie');
      if (rec) movies.push(rec);
    }
  }

  if (tvData) {
    const results = Array.isArray(tvData['results']) ? tvData['results'] : [];
    for (const item of results.slice(0, 10)) {
      const rec = buildRecommendation(asRecord(item), 'tv');
      if (rec) tvShows.push(rec);
    }
  }

  // Interleave movies and TV shows
  const combined: Recommendation[] = [];
  const maxLen = Math.max(movies.length, tvShows.length);
  for (let i = 0; i < maxLen && combined.length < RECOMMEND_COUNT; i++) {
    if (movies[i]) combined.push(movies[i]);
    if (combined.length < RECOMMEND_COUNT && tvShows[i]) combined.push(tvShows[i]);
  }
  return combined;
}

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
    const params: Record<string, string> = { query: s.title, language: 'en-US' };
    if (s.year) {
      params[s.mediaType === 'movie' ? 'year' : 'first_air_date_year'] = s.year;
    }

    const data = await tmdbGet(`/search/${s.mediaType}`, params);
    if (!data) continue;

    const items = Array.isArray(data['results']) ? data['results'] : [];
    if (items.length === 0) continue;

    const rec = buildRecommendation(asRecord(items[0]), s.mediaType);
    if (rec) results.push(rec);
  }

  return results;
}

export async function getRecommendations(): Promise<Recommendation[]> {
  const cached = await getFreshCache();
  if (cached) return cached;

  const feedback = await getAllFeedback();

  let recommendations: Recommendation[];

  if (feedback.length === 0 || !config.openai.apiKey) {
    recommendations = await fetchTmdbTopRated();
  } else {
    const feedbackContext = feedback
      .map((f) => `"${f.title}" · ${f.summary} · ${f.feedback}d`)
      .join('\n');

    const suggestions = await fetchAiSuggestions(feedbackContext);

    if (suggestions.length >= 3) {
      recommendations = await enrichSuggestions(suggestions);
    } else {
      recommendations = await fetchTmdbTopRated();
    }
  }

  if (recommendations.length > 0) {
    await setCache(recommendations);
  }

  return recommendations;
}
