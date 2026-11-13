import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { buildRecommendationPrompt } from './recommendation-prompt.js';
import type { PromptTitle, RatedTitle } from './recommendation-prompt.js';
import type { MediaType } from 'shared/tmdb.models';

const RECOMMENDATION_MODEL = 'gpt-6-luna';
const RECOMMENDATION_REASONING_EFFORT = 'medium';

const SuggestionSchema = z.object({
    title: z.string(),
    year: z.string(),
    reason: z.string(),
});

const AiResponseSchema = z.object({
    recommendations: z.array(SuggestionSchema),
});

export type AiSuggestion = z.infer<typeof SuggestionSchema>;

interface AiRecommendationRequest {
    userId: number;
    mediaType: MediaType;
    count: number;
    rated: RatedTitle[];
    owned: PromptTitle[];
    previouslySuggested: PromptTitle[];
}

let client: { apiKey: string; api: OpenAI } | null = null;

function getClient(): OpenAI {
    const { apiKey } = config.openai;
    if (client?.apiKey !== apiKey) client = { apiKey, api: new OpenAI({ apiKey }) };
    return client.api;
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

export async function getAiRecommendations(request: AiRecommendationRequest): Promise<AiSuggestion[]> {
    const prompt = buildRecommendationPrompt(request);

    try {
        const response = await getClient().responses.parse({
            model: RECOMMENDATION_MODEL,
            instructions: prompt.instructions,
            input: prompt.input,
            reasoning: { effort: RECOMMENDATION_REASONING_EFFORT },
            text: { format: zodTextFormat(AiResponseSchema, 'recommendations'), verbosity: 'low' },
            prompt_cache_key: `recommendations:${request.userId}:${request.mediaType}`,
            store: false,
        });

        logger.info('OpenAI: recommendations generated', {
            model: response.model,
            mediaType: request.mediaType,
            rated: request.rated.length,
            owned: request.owned.length,
            inputTokens: response.usage?.input_tokens,
            cachedTokens: response.usage?.input_tokens_details.cached_tokens,
            outputTokens: response.usage?.output_tokens,
            reasoningTokens: response.usage?.output_tokens_details.reasoning_tokens,
        });

        const parsed = response.output_parsed;
        if (!parsed) {
            logger.error('OpenAI: recommendations response could not be parsed', { status: response.status });
            return [];
        }

        return parsed.recommendations
            .map(cleanSuggestion)
            .filter((suggestion): suggestion is AiSuggestion => suggestion !== null);
    } catch (err) {
        logger.error('OpenAI: recommendations request failed', {
            error: err instanceof Error ? err.message : String(err),
        });
        return [];
    }
}
