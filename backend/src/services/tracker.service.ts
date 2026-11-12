import { apibayService } from './apibay.service.js';
import { getCacheKey, getMetadata } from './metadata.service.js';
import { ncoreService } from './ncore.service.js';
import type { TorrentSource, TrackerPage, TrackerProvider, TrackerTitleQuery } from './tracker-provider.js';
import { mapConcurrent } from '../utils/concurrent.js';
import { logger } from '../utils/logger.js';
import type { MetadataLookup, MovieMetadata } from 'shared/tmdb.models';
import { sortReleases, sortTitles } from 'shared/tracker.models';
import type {
    ReleaseCategory,
    ReleaseSearchResponse,
    TitleReleases,
    TitleReleasesResponse,
    TrackerFailure,
    TrackerId,
    TrackerRelease,
} from 'shared/tracker.models';

const REGISTRY: { primaryTracker: TrackerProvider; secondaryTrackers: TrackerProvider[] } = {
    primaryTracker: ncoreService,
    secondaryTrackers: [apibayService],
};
const PROVIDERS = [REGISTRY.primaryTracker, ...REGISTRY.secondaryTrackers];

const METADATA_CONCURRENCY = 6;

interface ReleaseSearchParams {
    category: ReleaseCategory;
    search: string;
    page: number;
    uhd: boolean;
    trackers?: TrackerId[];
}

export interface TitleLookup extends TitleReleasesResponse {
    checked: TrackerId[];
}

interface Gathered<T> {
    values: T[];
    succeeded: TrackerId[];
    failures: TrackerFailure[];
}

class TrackerService {
    async search(params: ReleaseSearchParams): Promise<ReleaseSearchResponse> {
        const search = params.search.trim();
        const providers = this.select(search ? PROVIDERS : [REGISTRY.primaryTracker], params.trackers);
        const gathered = await this.gather(providers, (provider) => fetchPage(provider, { ...params, search }));

        return {
            titles: await groupByTitle(gathered.values.flatMap((page) => page.results)),
            totalResults: Math.max(0, ...gathered.values.map((page) => page.totalResults)),
            trackers: providers.map((provider) => provider.id),
            failures: gathered.failures,
        };
    }

    /** Every release of one title, as far as each tracker can match it. */
    async findTitle(title: TrackerTitleQuery, trackers?: TrackerId[]): Promise<TitleLookup> {
        const gathered = await this.gather(this.select(PROVIDERS, trackers), (provider) => provider.findTitle(title));
        return {
            releases: sortReleases(gathered.values.flat()),
            checked: gathered.succeeded,
            failures: gathered.failures,
        };
    }

    getTorrent(tracker: TrackerId, downloadRef: string): Promise<TorrentSource> {
        return this.provider(tracker).getTorrent(downloadRef);
    }

    async fetchNfo(tracker: TrackerId, torrentId: string): Promise<string | null> {
        return (await this.provider(tracker).fetchNfo?.(torrentId)) ?? null;
    }

    private provider(tracker: TrackerId): TrackerProvider {
        const provider = PROVIDERS.find((candidate) => candidate.id === tracker);
        if (!provider) throw new Error(`Tracker "${tracker}" is not available.`);
        return provider;
    }

    private select(providers: TrackerProvider[], trackers?: TrackerId[]): TrackerProvider[] {
        if (!trackers?.length) return providers;
        return providers.filter((provider) => trackers.includes(provider.id));
    }

    private async gather<T>(
        providers: TrackerProvider[],
        task: (provider: TrackerProvider) => Promise<T>,
    ): Promise<Gathered<T>> {
        const settled = await Promise.allSettled(providers.map(task));
        const gathered: Gathered<T> = { values: [], succeeded: [], failures: [] };

        settled.forEach((outcome, index) => {
            const tracker = providers[index].id;
            if (outcome.status === 'fulfilled') {
                gathered.values.push(outcome.value);
                gathered.succeeded.push(tracker);
            } else {
                gathered.failures.push(toFailure(tracker, outcome.reason));
            }
        });
        return gathered;
    }
}

function fetchPage(provider: TrackerProvider, params: ReleaseSearchParams): Promise<TrackerPage> {
    return params.search ? provider.search(params) : provider.browseTop(params);
}

function toFailure(tracker: TrackerId, error: unknown): TrackerFailure {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[Trackers] Lookup failed', { tracker, error: message });

    return { tracker, message };
}

async function groupByTitle(releases: TrackerRelease[]): Promise<TitleReleases[]> {
    const metadataByLookup = await fetchMetadata(releases.map((release) => release.metadataLookup));
    const titles = new Map<string, TitleReleases>();

    for (const release of sortReleases(releases)) {
        const lookupKey = getCacheKey(release.metadataLookup);
        const metadata = metadataByLookup.get(lookupKey) ?? null;
        const key = metadata ? `${metadata.mediaType}:${metadata.tmdbId}` : lookupKey;

        const title = titles.get(key) ?? newTitle(key, release, metadata);
        title.releases.push(release);
        title.imdbId ||= release.imdbId;
        titles.set(key, title);
    }

    return sortTitles([...titles.values()]);
}

function newTitle(key: string, release: TrackerRelease, metadata: MovieMetadata | null): TitleReleases {
    return {
        key,
        title: metadata?.title || release.metadataLookup.title,
        year: metadata?.year || release.metadataLookup.year,
        imdbId: metadata?.imdbId ?? '',
        mediaType: metadata?.mediaType ?? release.mediaType,
        metadata,
        releases: [],
    };
}

async function fetchMetadata(lookups: MetadataLookup[]): Promise<Map<string, MovieMetadata | null>> {
    const unique = new Map(lookups.map((lookup) => [getCacheKey(lookup), lookup]));
    const found = new Map<string, MovieMetadata | null>();
    await mapConcurrent([...unique], METADATA_CONCURRENCY, async ([key, lookup]) => {
        found.set(key, (await getMetadata(lookup)).metadata);
    });

    return found;
}

export const trackerService = new TrackerService();
