import { config } from '../config.js';
import { asRecord, asString, asNumber } from '../utils/coerce.js';
import { TMDB_GENRE_MAP } from 'shared/constants';
import type { MovieMetadata, MetadataLookup, MediaType, TitleSummary } from 'shared/tmdb.models';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

function posterUrl(posterPath: string): string {
    return posterPath ? `${IMAGE_BASE}${posterPath}` : '';
}

function formatRating(voteAverage: number): string {
    return voteAverage ? String(Math.round(voteAverage * 10) / 10) : '';
}
const REQUEST_TIMEOUT_MS = 10_000;

interface FindResult {
    id: number;
    type: MediaType;
    data: Record<string, unknown>;
}

interface TmdbRecommendationRef {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    year: string;
}

class TmdbService {
    async fetchMetadata(lookup: MetadataLookup): Promise<MovieMetadata | null> {
        if (!config.tmdb.accessToken) return null;

        const item = await this.resolveItem(lookup);
        if (!item) return null;

        const details = await this.fetchDetails(item.id, item.type);
        return details ? this.toMetadata(item, details, lookup) : null;
    }

    async fetchTopRated(count: number, mediaType: MediaType): Promise<TmdbRecommendationRef[]> {
        const data = await this.tmdbGet(`/${mediaType}/top_rated`, { language: 'en-US', page: '1' });
        return this.toRefs(data, mediaType, count);
    }

    async fetchTrending(mediaType: MediaType): Promise<TmdbRecommendationRef[]> {
        const data = await this.tmdbGet(`/trending/${mediaType}/week`, { language: 'en-US' });
        return this.toRefs(data, mediaType, undefined, true);
    }

    async searchTitles(query: string, mediaType?: MediaType): Promise<Omit<TitleSummary, 'inJellyfinLibrary'>[]> {
        const data = await this.tmdbGet(`/search/${mediaType ?? 'multi'}`, { query, language: 'en-US' });
        if (!data) return [];

        return this.records(data['results']).flatMap((record) => {
            const type = mediaType ?? asString(record['media_type']);
            const tmdbId = asNumber(record['id']);
            if (!tmdbId || (type !== 'movie' && type !== 'tv')) return [];

            const posterPath = asString(record['poster_path']);
            const voteAverage = asNumber(record['vote_average']);
            return {
                tmdbId,
                mediaType: type,
                title: this.getTitle(record, type),
                year: this.getYear(record, type),
                poster: posterUrl(posterPath),
                genre: this.resolveGenres(this.array(record['genre_ids'])),
                rating: formatRating(voteAverage),
            };
        });
    }

    private async resolveItem(lookup: MetadataLookup): Promise<FindResult | null> {
        return (
            this.resolveByTmdbId(lookup) ?? (await this.resolveByImdbId(lookup)) ?? (await this.resolveByTitle(lookup))
        );
    }

    private resolveByTmdbId(lookup: MetadataLookup): FindResult | null {
        if (!lookup.tmdbId || !lookup.mediaType) return null;
        return { id: lookup.tmdbId, type: lookup.mediaType, data: {} };
    }

    private async resolveByImdbId(lookup: MetadataLookup): Promise<FindResult | null> {
        if (!lookup.imdbId) return null;

        const data = await this.tmdbGet(`/find/${encodeURIComponent(lookup.imdbId)}`, {
            external_source: 'imdb_id',
        });

        return data ? this.pickFindResult(data, lookup.mediaType) : null;
    }

    private async resolveByTitle(lookup: MetadataLookup): Promise<FindResult | null> {
        if (!lookup.title) return null;
        if (lookup.mediaType) return this.searchByType(lookup, lookup.mediaType);

        return (await this.searchByType(lookup, 'movie')) ?? (await this.searchByType(lookup, 'tv'));
    }

    private async searchByType(lookup: MetadataLookup, type: MediaType): Promise<FindResult | null> {
        const params: Record<string, string> = { query: lookup.title };
        if (lookup.year) params[this.getSearchYearParam(type)] = lookup.year;

        const data = await this.tmdbGet(`/search/${type}`, params);
        if (!data) return null;

        const result = this.pickSearchRecord(this.records(data['results']), type, lookup);
        if (!result) return null;

        const id = asNumber(result['id']);
        return id ? { id, type, data: result } : null;
    }

    private async fetchDetails(tmdbId: number, mediaType: MediaType): Promise<Record<string, unknown> | null> {
        return this.tmdbGet(`/${mediaType}/${tmdbId}`, {
            append_to_response: this.getDetailAppend(mediaType),
        });
    }

    private pickFindResult(data: Record<string, unknown>, preferredType?: MediaType): FindResult | null {
        if (preferredType) return this.findResultByType(data, preferredType);

        return this.findResultByType(data, 'movie') ?? this.findResultByType(data, 'tv');
    }

    private findResultByType(data: Record<string, unknown>, type: MediaType): FindResult | null {
        const result = this.records(data[this.getFindResultsKey(type)])[0];
        const id = result ? asNumber(result['id']) : 0;
        return id ? { id, type, data: result } : null;
    }

    private pickSearchRecord(
        records: Record<string, unknown>[],
        type: MediaType,
        lookup: MetadataLookup,
    ): Record<string, unknown> | null {
        if (records.length === 0) return null;

        const titleMatches = records.filter((record) => this.matchesTitle(record, type, lookup.title));

        if (lookup.year) {
            const exactTitleAndYear = titleMatches.find((record) => this.getYear(record, type) === lookup.year);
            if (exactTitleAndYear) return exactTitleAndYear;
        }

        return titleMatches[0] ?? records[0];
    }

    private matchesTitle(record: Record<string, unknown>, type: MediaType, title: string): boolean {
        const normalizedTitle = this.normalizeTitle(title);
        return [this.getTitle(record, type), this.getOriginalTitle(record, type)].some(
            (candidate) => this.normalizeTitle(candidate) === normalizedTitle,
        );
    }

    private toMetadata(item: FindResult, details: Record<string, unknown>, lookup: MetadataLookup): MovieMetadata {
        const title = this.getTitle(details, item.type) || this.getTitle(item.data, item.type) || lookup.title;
        const year = this.getYear(details, item.type) || this.getYear(item.data, item.type) || lookup.year;
        const posterPath = asString(details['poster_path']) || asString(item.data['poster_path']);
        const voteAverage = asNumber(details['vote_average']) || asNumber(item.data['vote_average']);

        return {
            tmdbId: item.id,
            mediaType: item.type,
            title,
            year,
            poster: posterUrl(posterPath),
            genre: this.getGenres(details) || this.resolveGenres(this.array(item.data['genre_ids'])),
            rating: formatRating(voteAverage),
            plot: asString(details['overview']),
            runtime: this.getRuntime(details, item.type),
            rated: this.getCertification(details, item.type),
            releaseDate: this.getDate(details, item.type),
            trailerKey: this.getTrailerKey(details) || undefined,
            imdbId: this.getImdbId(details, item.type),
        };
    }

    private toRefs(
        data: Record<string, unknown> | null,
        type: MediaType,
        count?: number,
        sortByPopularity = false,
    ): TmdbRecommendationRef[] {
        if (!data) return [];

        const records = this.records(data['results']);
        if (sortByPopularity) {
            records.sort((a, b) => asNumber(b['popularity']) - asNumber(a['popularity']));
        }

        return records
            .slice(0, count ?? records.length)
            .map((record) => {
                const tmdbId = asNumber(record['id']);
                if (!tmdbId) return null;

                return {
                    tmdbId,
                    mediaType: type,
                    title: this.getTitle(record, type),
                    year: this.getYear(record, type),
                };
            })
            .filter((item): item is TmdbRecommendationRef => item !== null);
    }

    private async tmdbGet(path: string, params?: Record<string, string>): Promise<Record<string, unknown> | null> {
        const url = new URL(`${TMDB_BASE}${path}`);
        for (const [key, value] of Object.entries(params ?? {})) {
            url.searchParams.set(key, value);
        }

        console.log('[TMDB]', url.toString());

        try {
            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${config.tmdb.accessToken}`,
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            if (!res.ok) return null;
            return asRecord(await res.json());
        } catch {
            return null;
        }
    }

    private getGenres(details: Record<string, unknown>): string {
        return this.records(details['genres'])
            .map((genre) => asString(genre['name']))
            .filter(Boolean)
            .join(', ');
    }

    private resolveGenres(genreIds: unknown[]): string {
        return genreIds
            .map((id) => TMDB_GENRE_MAP[asNumber(id)])
            .filter(Boolean)
            .join(', ');
    }

    private getRuntime(details: Record<string, unknown>, mediaType: MediaType): string {
        if (mediaType === 'movie') {
            const runtime = asNumber(details['runtime']);
            return runtime ? `${runtime} min` : '';
        }

        const runtime = asNumber(this.array(details['episode_run_time'])[0]);
        return runtime ? `${runtime} min` : '';
    }

    private getCertification(details: Record<string, unknown>, mediaType: MediaType): string {
        return mediaType === 'movie' ? this.getMovieCertification(details) : this.getTvCertification(details);
    }

    private getMovieCertification(details: Record<string, unknown>): string {
        const countries = this.records(asRecord(details['release_dates'])['results']);
        const usRelease = countries.find((entry) => asString(entry['iso_3166_1']) === 'US');
        if (!usRelease) return '';

        const releaseDates = this.records(usRelease['release_dates']);
        return releaseDates.map((date) => asString(date['certification'])).find(Boolean) ?? '';
    }

    private getTvCertification(details: Record<string, unknown>): string {
        const countries = this.records(asRecord(details['content_ratings'])['results']);
        const usRating = countries.find((entry) => asString(entry['iso_3166_1']) === 'US');
        return usRating ? asString(usRating['rating']) : '';
    }

    private getTrailerKey(details: Record<string, unknown>): string {
        const youtubeVideos = this.records(asRecord(details['videos'])['results']).filter(
            (video) => asString(video['site']) === 'YouTube',
        );
        const trailer = youtubeVideos.find((video) => asString(video['type']) === 'Trailer');
        if (trailer) return asString(trailer['key']) || '';

        const teaser = youtubeVideos.find((video) => asString(video['type']) === 'Teaser');
        return teaser ? asString(teaser['key']) || '' : '';
    }

    private getImdbId(details: Record<string, unknown>, mediaType: MediaType): string | undefined {
        if (mediaType === 'movie') return asString(details['imdb_id']) || undefined;

        const externalIds = asRecord(details['external_ids']);
        return asString(externalIds['imdb_id']) || undefined;
    }

    private getYear(record: Record<string, unknown>, type: MediaType): string {
        return this.extractYear(this.getDate(record, type));
    }

    private getTitle(record: Record<string, unknown>, type: MediaType): string {
        return asString(record[type === 'movie' ? 'title' : 'name']);
    }

    private getOriginalTitle(record: Record<string, unknown>, type: MediaType): string {
        return asString(record[type === 'movie' ? 'original_title' : 'original_name']);
    }

    private getDate(record: Record<string, unknown>, type: MediaType): string {
        return asString(record[type === 'movie' ? 'release_date' : 'first_air_date']);
    }

    private getSearchYearParam(type: MediaType): string {
        return type === 'movie' ? 'year' : 'first_air_date_year';
    }

    private getFindResultsKey(type: MediaType): string {
        return type === 'movie' ? 'movie_results' : 'tv_results';
    }

    private getDetailAppend(type: MediaType): string {
        return type === 'movie' ? 'release_dates,videos' : 'content_ratings,videos,external_ids';
    }

    private extractYear(dateStr: string): string {
        return dateStr.match(/^(\d{4})/)?.[1] ?? '';
    }

    private normalizeTitle(value: string): string {
        return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    private records(value: unknown): Record<string, unknown>[] {
        return this.array(value).map((item) => asRecord(item));
    }

    private array(value: unknown): unknown[] {
        return Array.isArray(value) ? value : [];
    }
}

export const tmdbService = new TmdbService();
