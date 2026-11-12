import type { MediaType } from 'shared/tmdb.models';
import type { ReleaseCategory, TrackerId, TrackerRelease } from 'shared/tracker.models';

export interface TrackerSearchQuery {
    category: ReleaseCategory;
    search: string;
    page: number;
}

export interface TrackerBrowseQuery {
    category: ReleaseCategory;
    page: number;
    uhd: boolean;
}

export interface TrackerTitleQuery {
    imdbId: string;
    title: string;
    year: string;
    mediaType: MediaType;
}

export interface TrackerPage {
    results: TrackerRelease[];
    totalResults: number;
}

export const EMPTY_PAGE: TrackerPage = { results: [], totalResults: 0 };

export type TorrentSource = { kind: 'file'; data: ArrayBuffer } | { kind: 'magnet'; uri: string };

/**
 * A tracker plugin. Register it in `tracker.service.ts` and list it in `TRACKERS` (shared).
 * `browseTop` returns an empty page when the tracker has no top list. `findTitle` returns the releases of one
 * title: by IMDb id, and only when the tracker can match reliably without one, by title and year.
 * `fetchNfo` is optional: leave it out when the tracker has no NFO files.
 * Results need no particular order (the tracker service sorts them); a thrown error becomes that tracker's failure,
 * with its message shown to the user.
 */
export interface TrackerProvider {
    readonly id: TrackerId;
    search(query: TrackerSearchQuery): Promise<TrackerPage>;
    findTitle(title: TrackerTitleQuery): Promise<TrackerRelease[]>;
    getTorrent(downloadRef: string): Promise<TorrentSource>;
    browseTop(query: TrackerBrowseQuery): Promise<TrackerPage>;
    fetchNfo?(torrentId: string): Promise<string>;
}
