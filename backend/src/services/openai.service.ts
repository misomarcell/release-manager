import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { config } from '../config.js';
import { buildRecommendationPrompt } from './recommendation-prompt.js';
import type { MediaType } from 'shared/tmdb.models';

const RECOMMENDATION_MODEL = 'gpt-5.4-mini';

const SuggestionSchema = z.object({
    title: z.string(),
    year: z.string(),
    reason: z.string(),
});

const AiResponseSchema = z.object({
    recommendations: z.array(SuggestionSchema),
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

function cleanSuggestion(suggestion: AiSuggestion): AiSuggestion | null {
    const title = suggestion.title.trim();
    if (!title) return null;
    return {
        title,
        year: suggestion.year.trim(),
        reason: suggestion.reason.trim(),
    };
}

export async function getAiRecommendations(
    feedbackContext: string,
    excludeTitles: string[],
    count: number,
    mediaType: MediaType,
): Promise<AiSuggestion[]> {
    const prompt = buildRecommendationPrompt({ feedbackContext, excludeTitles, count, mediaType });

    console.log(`[OpenAI] recommendations - requesting ${count} ${prompt.mediaLabel}`);

    try {
        const response = await getClient().chat.completions.parse({
            model: RECOMMENDATION_MODEL,
            temperature: 0.9,
            messages: [
                { role: 'system', content: prompt.system },
                { role: 'user', content: prompt.user },
            ],
            response_format: zodResponseFormat(AiResponseSchema, 'recommendations'),
        });

        const parsed = response.choices[0]?.message.parsed;
        if (!parsed) {
            console.error('[OpenAI] recommendations - no parsed response');
            return [];
        }

        const suggestions = parsed.recommendations
            .map(cleanSuggestion)
            .filter((suggestion): suggestion is AiSuggestion => suggestion !== null)
            .slice(0, count);

        console.log(`[OpenAI] recommendations - got ${suggestions.length} ${prompt.mediaLabel}`);
        return suggestions;
    } catch (err) {
        console.error('[OpenAI] recommendations - error:', err);
        return [];
    }
}
