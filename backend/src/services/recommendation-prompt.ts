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
            `You are a ${media.label} recommendation agent.`,
            `Your job is to infer my taste from a list of titles I liked and disliked, then recommend exactly ${input.count} ${media.label} that match my preferences.`,
            media.kindRule,
            media.yearRule,
            'Use the liked titles to identify patterns in:',
            '- genre, tone, pacing, themes, era, visual style, storytelling style, characters, atmosphere, and emotional impact',
            '- whether I seem to prefer mainstream classics, cult classics, slow burns, action-heavy stories, prestige dramas, dark comedies, sci-fi, crime, etc.',
            '',
            'Use the disliked titles to avoid:',
            '- similar tone, pacing, clichés, themes, story structures, character types, or genres',
            '- recommendations that only match superficially but share qualities I disliked',
            '',
            'Prioritize recommendations that are:',
            '- highly regarded, ideally IMDb 7.0+',
            '- cult classics, modern classics, hidden gems, or overlooked quality titles',
            '- available in high-quality physical or digital versions, especially 4K Blu-ray when relevant',
            '',
            'Avoid generic recommendations. Do not recommend something just because it is popular or highly rated. The recommendation must be justified by my specific likes and dislikes.',
            'DO NOT RECOMMEND TITLES THAT I ALREADY LIKED OR DISLIKED!',
            `Return exactly ${input.count} recommendations with title, year, and reason. Keep each reason under 30 words.`,
        ].join('\n'),
        user: `Taste profile:\n${input.feedbackContext}${excludedTitles ? `\n\nExclude: ${excludedTitles}` : ''}`,
    };
}
