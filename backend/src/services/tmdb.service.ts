import { config } from '../config.js';
import { asRecord, asString, asNumber } from '../utils/coerce.js';
import { TMDB_GENRE_MAP } from 'shared/constants';
import type { MovieMetadata, MovieDetailMetadata, MetadataLookup, MediaType } from 'shared/tmdb.models';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const EMPTY_LOOKUP: MetadataLookup = { title: '', year: '', imdbId: '' };

interface FindResult {
    id: number;
    type: MediaType;
    data: Record<string, unknown>;
}

interface MediaFields {
    title: string;
    originalTitle: string;
    date: string;
    searchYearParam: string;
    findResults: string;
    detailAppend: string;
}

const MEDIA_FIELDS: Record<MediaType, MediaFields> = {
    movie: {
        title: 'title',
        originalTitle: 'original_title',
        date: 'release_date',
        searchYearParam: 'year',
        findResults: 'movie_results',
        detailAppend: 'release_dates,videos',
    },
    tv: {
        title: 'name',
        originalTitle: 'original_name',
        date: 'first_air_date',
        searchYearParam: 'first_air_date_year',
        findResults: 'tv_results',
        detailAppend: 'content_ratings,videos,external_ids',
    },
};

class TmdbService {
    async fetchBasic(lookup: MetadataLookup): Promise<MovieMetadata | null> {
        if (!config.tmdb.accessToken) return null;

        const item = await this.resolveItem(lookup);
        return item ? this.toBasicMetadata(item, lookup) : null;
    }

    async fetchDetail(tmdbId: number, mediaType: MediaType): Promise<MovieDetailMetadata | null> {
        if (!config.tmdb.accessToken) return null;

        const details = await this.tmdbGet(`/${mediaType}/${tmdbId}`, {
            append_to_response: MEDIA_FIELDS[mediaType].detailAppend,
        });

        return details ? this.toDetailMetadata(details, mediaType) : null;
    }

    async fetchTopRated(count: number, filter: MediaType | null = null): Promise<MovieMetadata[]> {
        if (filter) return this.fetchTopRatedByType(filter, count);

        const [movies, tvShows] = await Promise.all([
            this.fetchTopRatedByType('movie', count),
            this.fetchTopRatedByType('tv', count),
        ]);

        return this.interleaveTopRated(movies, tvShows, count);
    }

    private async resolveItem(lookup: MetadataLookup): Promise<FindResult | null> {
        return (
            (await this.resolveByTmdbId(lookup)) ??
            (await this.resolveByImdbId(lookup)) ??
            (await this.resolveByTitle(lookup))
        );
    }

    private async resolveByTmdbId(lookup: MetadataLookup): Promise<FindResult | null> {
        if (!lookup.tmdbId || !lookup.mediaType) return null;

        const data = await this.tmdbGet(`/${lookup.mediaType}/${lookup.tmdbId}`);
        return data
            ? { id: lookup.tmdbId, type: lookup.mediaType, data: this.withGenreIds(data) }
            : null;
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
        if (lookup.year) params[MEDIA_FIELDS[type].searchYearParam] = lookup.year;

        const data = await this.tmdbGet(`/search/${type}`, params);
        if (!data) return null;

        const result = this.pickSearchRecord(this.records(data['results']), type, lookup);
        if (!result) return null;

        const id = asNumber(result['id']);
        return id ? { id, type, data: result } : null;
    }

    private pickFindResult(data: Record<string, unknown>, preferredType?: MediaType): FindResult | null {
        if (preferredType) return this.findResultByType(data, preferredType);

        return this.findResultByType(data, 'movie') ?? this.findResultByType(data, 'tv');
    }

    private findResultByType(data: Record<string, unknown>, type: MediaType): FindResult | null {
        const result = this.records(data[MEDIA_FIELDS[type].findResults])[0];
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
        const fields = MEDIA_FIELDS[type];
        const normalizedTitle = this.normalizeTitle(title);
        return [asString(record[fields.title]), asString(record[fields.originalTitle])].some(
            (candidate) => this.normalizeTitle(candidate) === normalizedTitle,
        );
    }

    private toBasicMetadata(item: FindResult, lookup: MetadataLookup): MovieMetadata {
        const fields = MEDIA_FIELDS[item.type];
        const title = asString(item.data[fields.title]) || lookup.title;
        const year = this.getYear(item.data, item.type) || lookup.year;
        const posterPath = asString(item.data['poster_path']);
        const voteAverage = asNumber(item.data['vote_average']);

        return {
            tmdbId: item.id,
            mediaType: item.type,
            title,
            year,
            poster: posterPath ? `${IMAGE_BASE}${posterPath}` : '',
            genre: this.resolveGenres(this.array(item.data['genre_ids'])),
            rating: voteAverage ? String(Math.round(voteAverage * 10) / 10) : '',
            plot: '',
            runtime: '',
            rated: '',
        };
    }

    private toDetailMetadata(details: Record<string, unknown>, mediaType: MediaType): MovieDetailMetadata {
        return {
            plot: asString(details['overview']),
            runtime: this.getRuntime(details, mediaType),
            rated: this.getCertification(details, mediaType),
            releaseDate: asString(details[MEDIA_FIELDS[mediaType].date]),
            trailerKey: this.getTrailerKey(details) || undefined,
            imdbId: this.getImdbId(details, mediaType),
        };
    }

    private async fetchTopRatedByType(type: MediaType, count: number): Promise<MovieMetadata[]> {
        const data = await this.tmdbGet(`/${type}/top_rated`, { language: 'en-US', page: '1' });
        if (!data) return [];

        return this.records(data['results'])
            .slice(0, count)
            .map((record) => {
                const id = asNumber(record['id']);
                return id ? this.toBasicMetadata({ id, type, data: record }, EMPTY_LOOKUP) : null;
            })
            .filter((metadata): metadata is MovieMetadata => metadata !== null);
    }

    private interleaveTopRated(
        movies: MovieMetadata[],
        tvShows: MovieMetadata[],
        count: number,
    ): MovieMetadata[] {
        const combined: MovieMetadata[] = [];
        const maxLen = Math.max(movies.length, tvShows.length);

        for (let i = 0; i < maxLen && combined.length < count; i++) {
            if (movies[i]) combined.push(movies[i]);
            if (combined.length < count && tvShows[i]) combined.push(tvShows[i]);
        }

        return combined;
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
            });
            if (!res.ok) return null;
            return asRecord(await res.json());
        } catch {
            return null;
        }
    }

    private withGenreIds(data: Record<string, unknown>): Record<string, unknown> {
        return {
            ...data,
            genre_ids: this.records(data['genres']).map((genre) => asNumber(genre['id'])),
        };
    }

    private resolveGenres(genreIds: unknown[]): string {
        return genreIds
            .map((id) => TMDB_GENRE_MAP[asNumber(id) ?? 0])
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
        return this.extractYear(asString(record[MEDIA_FIELDS[type].date]));
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
