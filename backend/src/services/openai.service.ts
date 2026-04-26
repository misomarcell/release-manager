import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { config } from '../config.js';

const SuggestionSchema = z.object({
  title: z.string(),
  year: z.string(),
  reason: z.string(),
});

const AiResponseSchema = z.object({
  movies: z.array(SuggestionSchema),
  tvShows: z.array(SuggestionSchema),
});

export type AiSuggestion = z.infer<typeof SuggestionSchema>;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: config.openai.apiKey });
  return client;
}

export function isOpenAiAvailable(): boolean {
  return !!config.openai.apiKey;
}

export async function getAiRecommendations(
  feedbackContext: string,
  excludeTitles: string[],
  perTypeCount: number,
): Promise<{ movies: AiSuggestion[]; tvShows: AiSuggestion[] }> {
  const empty = { movies: [], tvShows: [] };

  const exclusionNote =
    excludeTitles.length > 0
      ? `\nDo NOT recommend any of these already-rated titles:\n${excludeTitles.map((t) => `• ${t}`).join('\n')}\n`
      : '';

  const systemPrompt = `You are an expert movie and TV show recommendation assistant with encyclopedic knowledge of cinema and television across all eras, genres, and countries.

Task: Recommend exactly ${perTypeCount} movies AND ${perTypeCount} TV shows the user will genuinely love, based on their rating history.

Rules:
- Deeply analyze the user's taste from their liked titles — look for patterns in genre, tone, era, country, directors, and themes
- Actively avoid styles, genres, and tones similar to disliked titles
- Prioritize critically acclaimed titles, cult classics, and hidden gems over generic blockbusters
- Prioritize titles with high (7+) IMDb ratings
- Vary era (classic to contemporary), country of origin, and genre for a diverse, interesting selection
- For TV shows, prefer completed or well-established long-running series
- Include the original title as it appears in international databases (e.g. TMDB)
${exclusionNote}
Return exactly ${perTypeCount} items in "movies" and exactly ${perTypeCount} items in "tvShows".`;

  const userMessage = `My viewing history:\n\n${feedbackContext}\n\nRecommend ${perTypeCount} movies and ${perTypeCount} TV shows I'll love.`;

  console.log(`[OpenAI] getAiRecommendations — requesting ${perTypeCount} movies + ${perTypeCount} TV shows`);

  try {
    const response = await getClient().chat.completions.parse({
      model: 'gpt-4o-mini',
      temperature: 0.9,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: zodResponseFormat(AiResponseSchema, 'recommendations'),
    });

    const parsed = response.choices[0]?.message.parsed;
    if (!parsed) {
      console.error('[OpenAI] getAiRecommendations — no parsed response');
      return empty;
    }

    console.log(
      `[OpenAI] getAiRecommendations — got ${parsed.movies.length} movies, ${parsed.tvShows.length} TV shows`,
    );
    return {
      movies: parsed.movies.filter((s: AiSuggestion) => s.title.length > 0),
      tvShows: parsed.tvShows.filter((s: AiSuggestion) => s.title.length > 0),
    };
  } catch (err) {
    console.error('[OpenAI] getAiRecommendations — error:', err);
    return empty;
  }
}
