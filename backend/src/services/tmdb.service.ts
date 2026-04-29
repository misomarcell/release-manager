import { config } from '../config.js';
import { asRecord, asString, asNumber } from '../utils/coerce.js';
import { TMDB_GENRE_MAP } from 'shared/constants';
import type { MovieMetadata, MovieDetailMetadata, MetadataLookup } from 'shared/tmdb.models';
import type { Recommendation } from 'shared/recommendations.models';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.tmdb.accessToken}`,
    Accept: 'application/json',
  };
}

async function tmdbGet(path: string, params?: Record<string, string>): Promise<Record<string, unknown> | null> {
  const url = new URL(`${TMDB_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  console.log('[TMDB]', url.toString());

  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return null;
    return asRecord(await res.json());
  } catch {
    return null;
  }
}

interface FindResult {
  id: number;
  type: 'movie' | 'tv';
  data: Record<string, unknown>;
}

function extractFromFindResponse(data: Record<string, unknown>): FindResult | null {
  const movieResults = Array.isArray(data['movie_results']) ? data['movie_results'] : [];
  if (movieResults.length > 0) {
    const rec = asRecord(movieResults[0]);
    const id = asNumber(rec['id']);
    if (id) return { id, type: 'movie', data: rec };
  }

  const tvResults = Array.isArray(data['tv_results']) ? data['tv_results'] : [];
  if (tvResults.length > 0) {
    const rec = asRecord(tvResults[0]);
    const id = asNumber(rec['id']);
    if (id) return { id, type: 'tv', data: rec };
  }

  return null;
}

function extractFromSearchResponse(data: Record<string, unknown>, type: 'movie' | 'tv'): FindResult | null {
  const results = Array.isArray(data['results']) ? data['results'] : [];
  if (results.length > 0) {
    const rec = asRecord(results[0]);
    const id = asNumber(rec['id']);
    if (id) return { id, type, data: rec };
  }
  return null;
}

function extractYear(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : '';
}

function resolveGenres(genreIds: unknown[]): string {
  return genreIds
    .map((id) => TMDB_GENRE_MAP[asNumber(id) ?? 0])
    .filter(Boolean)
    .join(', ');
}

function buildBasicMetadata(item: FindResult, lookup: MetadataLookup): MovieMetadata {
  const d = item.data;
  const title = asString(d[item.type === 'movie' ? 'title' : 'name']) || lookup.title;
  const dateField = item.type === 'movie' ? 'release_date' : 'first_air_date';
  const year = extractYear(asString(d[dateField])) || lookup.year;

  const posterPath = asString(d['poster_path']);
  const poster = posterPath ? `${IMAGE_BASE}${posterPath}` : '';

  const genreIds = Array.isArray(d['genre_ids']) ? d['genre_ids'] : [];
  const genre = resolveGenres(genreIds);

  const voteAverage = asNumber(d['vote_average']);
  const rating = voteAverage ? String(Math.round(voteAverage * 10) / 10) : '';

  return {
    tmdbId: item.id,
    mediaType: item.type,
    title,
    year,
    poster,
    genre,
    rating,
    plot: '',
    runtime: '',
    rated: '',
  };
}

function extractCertification(data: Record<string, unknown>, type: 'movie' | 'tv'): string {
  if (type === 'movie') {
    const releaseDates = asRecord(data['release_dates']);
    const results = Array.isArray(releaseDates['results']) ? releaseDates['results'] : [];
    for (const entry of results) {
      const e = asRecord(entry);
      if (asString(e['iso_3166_1']) === 'US') {
        const dates = Array.isArray(e['release_dates']) ? e['release_dates'] : [];
        for (const rd of dates) {
          const cert = asString(asRecord(rd)['certification']);
          if (cert) return cert;
        }
      }
    }
  } else {
    const contentRatings = asRecord(data['content_ratings']);
    const results = Array.isArray(contentRatings['results']) ? contentRatings['results'] : [];
    for (const entry of results) {
      const e = asRecord(entry);
      if (asString(e['iso_3166_1']) === 'US') {
        const r = asString(e['rating']);
        if (r) return r;
      }
    }
  }
  return '';
}

function extractTrailerKey(data: Record<string, unknown>): string {
  const videos = asRecord(data['videos']);
  const results = Array.isArray(videos['results']) ? videos['results'] : [];
  const youtubeVideos = results.map((r) => asRecord(r)).filter((r) => asString(r['site']) === 'YouTube');
  const trailer = youtubeVideos.find((r) => asString(r['type']) === 'Trailer');
  if (trailer) return asString(trailer['key']) || '';
  const teaser = youtubeVideos.find((r) => asString(r['type']) === 'Teaser');
  return teaser ? asString(teaser['key']) || '' : '';
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

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Resolve basic metadata (title, poster, genres, rating) for a given lookup.
 * Priority: TMDB ID → IMDB ID → title+year search.
 * Returns raw TMDB data mapped to MovieMetadata — no caching.
 */
export async function tmdbFetchBasic(lookup: MetadataLookup): Promise<MovieMetadata | null> {
  if (!config.tmdb.accessToken) return null;

  let item: FindResult | null = null;

  if (lookup.tmdbId && lookup.mediaType) {
    const data = await tmdbGet(`/${lookup.mediaType}/${lookup.tmdbId}`);
    if (data) {
      const rawGenres = Array.isArray(data['genres']) ? (data['genres'] as unknown[]) : [];
      const normalized: Record<string, unknown> = {
        ...data,
        genre_ids: rawGenres.map((g) => asNumber(asRecord(g as Record<string, unknown>)['id'])),
      };
      item = { id: lookup.tmdbId, type: lookup.mediaType, data: normalized };
    }
  }

  if (!item && lookup.imdbId) {
    const data = await tmdbGet(`/find/${encodeURIComponent(lookup.imdbId)}`, {
      external_source: 'imdb_id',
    });
    if (data) item = extractFromFindResponse(data);
  }

  if (!item && lookup.title) {
    const params: Record<string, string> = { query: lookup.title };
    if (lookup.year) params['year'] = lookup.year;

    const movieData = await tmdbGet('/search/movie', params);
    if (movieData) item = extractFromSearchResponse(movieData, 'movie');

    if (!item) {
      const tvParams: Record<string, string> = { query: lookup.title };
      if (lookup.year) tvParams['first_air_date_year'] = lookup.year;
      const tvData = await tmdbGet('/search/tv', tvParams);
      if (tvData) item = extractFromSearchResponse(tvData, 'tv');
    }
  }

  if (!item) return null;
  return buildBasicMetadata(item, lookup);
}

/**
 * Fetch detail metadata (plot, runtime, rating, release date, trailer) for a known TMDB title.
 * No caching — returns raw TMDB data.
 */
export async function tmdbFetchDetail(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<MovieDetailMetadata | null> {
  if (!config.tmdb.accessToken) return null;

  const appendParam = mediaType === 'movie' ? 'release_dates,videos' : 'content_ratings,videos,external_ids';
  const details = await tmdbGet(`/${mediaType}/${tmdbId}`, { append_to_response: appendParam });
  if (!details) return null;

  let runtime = '';
  if (mediaType === 'movie') {
    const rt = asNumber(details['runtime']);
    if (rt) runtime = `${rt} min`;
  } else {
    const ert = Array.isArray(details['episode_run_time']) ? details['episode_run_time'] : [];
    if (ert.length > 0) {
      const rt = asNumber(ert[0]);
      if (rt) runtime = `${rt} min`;
    }
  }

  const plot = asString(details['overview']);
  const rated = extractCertification(details, mediaType);
  const dateField = mediaType === 'movie' ? 'release_date' : 'first_air_date';
  const releaseDate = asString(details[dateField]);
  const trailerKey = extractTrailerKey(details) || undefined;

  let imdbId: string | undefined;
  if (mediaType === 'movie') {
    imdbId = asString(details['imdb_id']) || undefined;
  } else {
    const externalIds = asRecord(details['external_ids']);
    imdbId = asString(externalIds['imdb_id']) || undefined;
  }

  return { plot, runtime, rated, releaseDate, trailerKey, imdbId };
}

/**
 * Fetch external IDs (IMDB) and trailer key for a known TMDB title.
 * No caching.
 */
export async function tmdbFetchExternalData(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
): Promise<{ imdbId: string | null; trailerKey: string | null }> {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}`, {
    append_to_response: 'external_ids,videos',
  });
  if (!data) return { imdbId: null, trailerKey: null };

  const externalIds = asRecord(data['external_ids']);
  const imdbId = asString(externalIds['imdb_id']) || null;
  const trailerKey = extractTrailerKey(data) || null;
  return { imdbId, trailerKey };
}

/**
 * Fetch TMDB top-rated titles for a given media type.
 * No caching.
 */
async function fetchTopRatedByType(type: 'movie' | 'tv', count: number): Promise<Recommendation[]> {
  const data = await tmdbGet(`/${type}/top_rated`, { language: 'en-US', page: '1' });
  if (!data) return [];
  const results = Array.isArray(data['results']) ? data['results'] : [];
  return results
    .slice(0, count)
    .map((item) => buildRecommendation(asRecord(item), type))
    .filter((r): r is Recommendation => r !== null);
}

export async function tmdbFetchTopRated(
  count: number,
  filter: 'movie' | 'tv' | null = null,
): Promise<Recommendation[]> {
  if (filter !== null) return fetchTopRatedByType(filter, count);

  const [movies, tvShows] = await Promise.all([fetchTopRatedByType('movie', count), fetchTopRatedByType('tv', count)]);

  const combined: Recommendation[] = [];
  const maxLen = Math.max(movies.length, tvShows.length);
  for (let i = 0; i < maxLen && combined.length < count; i++) {
    if (movies[i]) combined.push(movies[i]);
    if (combined.length < count && tvShows[i]) combined.push(tvShows[i]);
  }
  return combined;
}

/**
 * Search TMDB for a single title and return it as a Recommendation.
 * No caching.
 */
export async function tmdbSearchRecommendation(
  title: string,
  year: string,
  mediaType: 'movie' | 'tv',
): Promise<Recommendation | null> {
  if (!config.tmdb.accessToken) return null;

  const params: Record<string, string> = { query: title, language: 'en-US' };
  if (year) params[mediaType === 'movie' ? 'year' : 'first_air_date_year'] = year;

  const data = await tmdbGet(`/search/${mediaType}`, params);
  if (!data) return null;

  const items = Array.isArray(data['results']) ? data['results'] : [];
  if (items.length === 0) return null;

  return buildRecommendation(asRecord(items[0]), mediaType);
}
