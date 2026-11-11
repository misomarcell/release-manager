import type { MediaType } from 'shared/tmdb.models';
import type { FeedbackValue } from 'shared/recommendations.models';

export interface PromptTitle {
    title: string;
    year?: string | null;
    genre?: string | null;
}

export interface RatedTitle extends PromptTitle {
    feedback: FeedbackValue;
}

interface RecommendationPromptInput {
    rated: RatedTitle[];
    owned: PromptTitle[];
    previouslySuggested: PromptTitle[];
    count: number;
    mediaType: MediaType;
}

interface RecommendationPrompt {
    mediaLabel: string;
    instructions: string;
    input: string;
}

const MEDIA_RULES: Record<MediaType, { label: string; kindRule: string; yearRule: string }> = {
    movie: {
        label: 'movies',
        kindRule: 'Only feature films. Never recommend series, miniseries, episodes or TV specials.',
        yearRule:
            'Use the original English TMDB movie title and the release year, so the title can be looked up on TMDB.',
    },
    tv: {
        label: 'TV shows',
        kindRule: 'Only TV series and miniseries. Never recommend movies, TV movies, shorts or one-off specials.',
        yearRule: 'Use the English TMDB TV show title and the first air year, so the title can be looked up on TMDB.',
    },
};

function formatTitle(item: PromptTitle, withGenre: boolean): string {
    const year = item.year?.trim();
    const genre = withGenre ? item.genre?.trim() : '';
    return `${item.title.trim()}${year ? ` (${year})` : ''}${genre ? ` | ${genre}` : ''}`;
}

function formatList(items: PromptTitle[], withGenre: boolean): string {
    return [...new Set(items.filter((item) => item.title.trim()).map((item) => formatTitle(item, withGenre)))].join(
        '\n',
    );
}

function section(heading: string, body: string): string | null {
    return body ? `## ${heading}\n${body}` : null;
}

function buildInstructions(mediaType: MediaType): string {
    const media = MEDIA_RULES[mediaType];

    return [
        `You are a personal ${media.label} recommendation expert.`,
        `Infer my taste from the ${media.label} I rated, then recommend new ${media.label} I am likely to love.`,
        '',
        '# Input',
        '- "Liked" and "Disliked" list the titles I rated as `Title (Year) | Genres`, oldest first. Later entries reflect my current taste more.',
        '- "Already in my library" lists titles I already own. Treat them as a weak signal of interest.',
        '- "Recently suggested" lists titles you suggested before. Pick different ones to keep suggestions fresh.',
        '',
        '# How to choose',
        '- From the liked titles, find the patterns in genre, tone, pacing, themes, era, visual and storytelling style, characters, atmosphere and emotional impact.',
        '- From the disliked titles, find what to avoid. Skip titles that match my likes on the surface but share qualities I disliked.',
        '- Prefer highly regarded titles (ideally IMDb 7.0+): modern or cult classics, hidden gems and overlooked quality titles, preferably ones available in high quality (4K Blu-ray or good digital releases).',
        '- Do not recommend something only because it is popular. Every pick must be justified by my specific ratings.',
        '- Mix a few well-known titles with lesser-known ones, and vary the picks instead of repeating one niche.',
        `- ${media.kindRule}`,
        '- Only recommend real, released titles. Never recommend anything listed in the input.',
        '',
        '# Output',
        `- ${media.yearRule}`,
        '- Order recommendations from best to weakest fit.',
        '- Write each reason in under 30 words and name one or two of my liked titles it connects to.',
    ].join('\n');
}

export function buildRecommendationPrompt(input: RecommendationPromptInput): RecommendationPrompt {
    const media = MEDIA_RULES[input.mediaType];
    const liked = input.rated.filter((item) => item.feedback === 'like');
    const disliked = input.rated.filter((item) => item.feedback === 'dislike');

    const sections = [
        section('Liked', formatList(liked, true)),
        section('Disliked', formatList(disliked, true)),
        section('Already in my library', formatList(input.owned, false)),
        section('Recently suggested', formatList(input.previouslySuggested, false)),
        `Recommend exactly ${input.count} ${media.label}.`,
    ];

    return {
        mediaLabel: media.label,
        instructions: buildInstructions(input.mediaType),
        input: sections.filter((part): part is string => part !== null).join('\n\n'),
    };
}
