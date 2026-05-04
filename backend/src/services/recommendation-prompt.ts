import type { MediaType } from 'shared/tmdb.models';

interface RecommendationPromptInput {
    feedbackContext: string;
    excludeTitles: string[];
    count: number;
    mediaType: MediaType;
}

interface RecommendationPrompt {
    mediaLabel: string;
    system: string;
    user: string;
}

const MEDIA_RULES: Record<MediaType, { label: string; kindRule: string; yearRule: string }> = {
    movie: {
        label: 'movies',
        kindRule: 'Only movies! DO NOT RECOMMEND: Series, miniseries, episodes, and TV specials.',
        yearRule: 'Use TMDB movie titles and release years.',
    },
    tv: {
        label: 'TV shows',
        kindRule: 'Only TV shows! DO NOT RECOMMEND: Movies, TV movies, shorts, and one-off specials.',
        yearRule: 'Use TMDB TV titles and first air years.',
    },
};

function compactTitles(titles: string[]): string {
    return [...new Set(titles.map((title) => title.trim()).filter(Boolean))].join('; ');
}

export function buildRecommendationPrompt(input: RecommendationPromptInput): RecommendationPrompt {
    const media = MEDIA_RULES[input.mediaType];
    const excludedTitles = compactTitles(input.excludeTitles);

    return {
        mediaLabel: media.label,
        system: [
            `Recommend exactly ${input.count} ${media.label} from the user's taste profile.`,
            media.kindRule,
            media.yearRule,
            'Infer taste from likes, avoid disliked styles, prefer acclaimed IMDb 7+ titles, cult classics, and hidden gems.',
            'Vary era, country, and genre.',
            `Return exactly ${input.count} recommendations with title, year, and reason. Keep each reason under 18 words.`,
        ].join('\n'),
        user: `Taste profile:\n${input.feedbackContext}${excludedTitles ? `\n\nExclude: ${excludedTitles}` : ''}`,
    };
}
