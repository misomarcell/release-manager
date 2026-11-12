import type { MediaType, MetadataLookup, MovieMetadata } from './tmdb.models.js';

// Listed in display order: the primary tracker first, as registered in the backend's tracker service.
export const TRACKERS = [
    { id: 'ncore', name: 'nCore', nfo: true },
    { id: 'thepiratebay', name: 'The Pirate Bay', nfo: false },
] as const;

export type TrackerId = (typeof TRACKERS)[number]['id'];

export function isTrackerId(value: unknown): value is TrackerId {
    return TRACKERS.some((tracker) => tracker.id === value);
}

export function trackerName(id: TrackerId): string {
    return TRACKERS.find((tracker) => tracker.id === id)?.name ?? id;
}

export function trackerHasNfo(id: TrackerId): boolean {
    return TRACKERS.find((tracker) => tracker.id === id)?.nfo ?? false;
}

export type ReleaseCategory = 'all' | 'movies' | 'tv';

export type TvType = 'episode' | 'season' | 'series';

export interface TvInfo {
    type: TvType;
    season: number | null;
    episode: number | null;
}

export interface TrackerRelease {
    tracker: TrackerId;
    torrentId: string;
    downloadRef: string;
    mediaType: MediaType;
    releaseName: string;
    detailsUrl: string;
    freeleech: boolean;
    imdbId: string;
    size: number;
    seeders: number;
    leechers: number;
    metadataLookup: MetadataLookup;
    tvInfo: TvInfo | null;
}

export interface TitleReleases {
    key: string;
    title: string;
    year: string;
    imdbId: string;
    mediaType: MediaType;
    metadata: MovieMetadata | null;
    releases: TrackerRelease[];
}

export interface TrackerFailure {
    tracker: TrackerId;
    message: string;
}

export interface ReleaseSearchResponse {
    titles: TitleReleases[];
    totalResults: number;
    trackers: TrackerId[];
    failures: TrackerFailure[];
}

export interface TitleReleasesResponse {
    releases: TrackerRelease[];
    failures: TrackerFailure[];
}

function trackerRank(id: TrackerId): number {
    return TRACKERS.findIndex((tracker) => tracker.id === id);
}

export type ReleaseSort = 'seeders' | 'size';

/** Orders releases by tracker (primary first), then from most to least seeders or size. */
export function sortReleases(releases: TrackerRelease[], by: ReleaseSort = 'seeders'): TrackerRelease[] {
    return [...releases].sort((a, b) => trackerRank(a.tracker) - trackerRank(b.tracker) || b[by] - a[by]);
}

/** Orders titles by their best tracker (primary first), then by their most seeded release. */
export function sortTitles(titles: TitleReleases[]): TitleReleases[] {
    const rank = (title: TitleReleases) => Math.min(...title.releases.map((release) => trackerRank(release.tracker)));
    const seeders = (title: TitleReleases) => Math.max(...title.releases.map((release) => release.seeders));
    return [...titles].sort((a, b) => rank(a) - rank(b) || seeders(b) - seeders(a));
}
