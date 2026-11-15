import { Component, computed, inject, input, resource, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { FailureNoticeComponent } from '../failure-notice/failure-notice';
import { ListDetailComponent } from '../list-detail/list-detail';
import { ReleaseListComponent } from '../release-list/release-list';
import { RowSkeletonsComponent } from '../row-skeletons/row-skeletons';
import { TitleDetailComponent, type StatusCell } from '../title-detail/title-detail';
import { TitleRowComponent } from '../title-row/title-row';
import { SearchService, type TitleReleasesOptions } from '../../services/search.service';
import { WatchlistService } from '../../services/watchlist.service';
import { injectIsDesktop } from '../../utils/breakpoint';
import { trackerFailureNotices } from '../../utils/failure-notice';
import { extractHttpError } from '../../utils/http-error';
import { parsePage, parseQuery } from '../../utils/query-params';
import { releaseQualities, releaseResolutions } from '../../utils/release-view';
import {
    TRACKERS,
    parseReleaseFilters,
    sortReleases,
    trackerName,
    type ReleaseCategory,
    type ReleaseSort,
    type TitleReleases,
    type TrackerId,
} from '@rm/shared/tracker.models';
import type { ReleaseTag } from '@rm/shared/release-tags';

const PAGE_SIZE = 100;
const VALID_CATEGORIES: ReleaseCategory[] = ['all', 'movies', 'tv'];
const HEADINGS: Record<ReleaseCategory, string> = {
    all: 'Top releases',
    movies: 'Top movies',
    tv: 'Top TV shows',
};
const RELEASE_SEARCH_FILTERS: SearchFilterDefinition[] = [
    {
        key: 'category',
        control: 'select',
        defaultValue: 'all',
        options: [
            { value: 'all', label: 'All' },
            { value: 'movies', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
        ],
    },
    {
        key: 'filters',
        control: 'toggle',
        options: [
            { value: 'uhd', label: '4K only' },
            { value: 'bluray', label: 'BluRay only' },
        ],
    },
];

const RELEASE_SORTS: { id: ReleaseSort; label: string; param: string | null }[] = [
    { id: 'seeders', label: 'Most seeders', param: null },
    { id: 'size', label: 'Largest size', param: 'size' },
];

interface TitleGroup extends TitleReleases {
    qualities: ReleaseTag[];
}

@Component({
    selector: 'app-releases',
    imports: [
        RouterLink,
        MatIconModule,
        MatMenuModule,
        MatPaginatorModule,
        FailureNoticeComponent,
        FilterSearchComponent,
        ListDetailComponent,
        ReleaseListComponent,
        RowSkeletonsComponent,
        TitleDetailComponent,
        TitleRowComponent,
    ],
    templateUrl: './releases.html',
    styleUrl: './releases.scss',
})
export class ReleasesComponent {
    private search = inject(SearchService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private isDesktop = injectIsDesktop();
    private layout = viewChild.required(ListDetailComponent);
    protected watchlist = inject(WatchlistService);

    q = input('', { transform: parseQuery });
    category = input<ReleaseCategory, unknown>('all', { transform: parseCategory });
    filters = input('', { transform: parseQuery });
    tracker = input<TrackerId | null, unknown>(null, { transform: parseTracker });
    page = input(1, { transform: parsePage });
    sort = input<ReleaseSort, unknown>('seeders', { transform: parseSort });
    open = input('', { transform: parseQuery });

    protected releaseFilters = RELEASE_SEARCH_FILTERS;
    protected trackers = TRACKERS;
    protected pageSize = PAGE_SIZE;
    protected sorts = RELEASE_SORTS;
    protected currentSort = computed(
        () => RELEASE_SORTS.find((option) => option.id === this.sort()) ?? RELEASE_SORTS[0],
    );
    private activeFilters = computed(() => parseReleaseFilters(this.filters()));
    protected searchFilterValues = computed(() => ({ category: this.category(), filters: this.activeFilters() }));
    protected trackerLabel = computed(() => {
        const tracker = this.tracker();
        return tracker ? trackerName(tracker) : 'All trackers';
    });

    private searchParams = computed(() => {
        const tracker = this.tracker();
        return {
            query: this.q(),
            category: this.category(),
            filters: this.activeFilters(),
            page: this.page(),
            trackers: tracker ? [tracker] : [],
        };
    });
    private searchResource = resource({
        params: () => this.searchParams(),
        loader: ({ params }) => this.search.search(params),
    });
    private response = computed(() => (this.searchResource.hasValue() ? this.searchResource.value() : null));

    protected loading = this.searchResource.isLoading;
    protected error = computed(() => {
        const error = this.searchResource.error();
        return error ? extractHttpError(error, 'Search failed') : null;
    });
    protected failures = computed(() => trackerFailureNotices(this.response()?.failures ?? []));
    protected totalResults = computed(() => this.response()?.totalResults ?? 0);
    protected pageCount = computed(() => Math.max(1, Math.ceil(this.totalResults() / PAGE_SIZE)));

    protected heading = computed(() => {
        const query = this.q();
        if (query) return `Results for “${query}”`;
        return HEADINGS[this.category()];
    });
    protected emptyMessage = computed(() => {
        const hasTopList = this.q() || this.response()?.trackers.length;
        return hasTopList
            ? 'No results found.'
            : `${this.trackerLabel()} has no top list. Search for a title to see its releases.`;
    });

    protected groups = computed(() =>
        (this.response()?.titles ?? []).map((title): TitleGroup => ({
            ...title,
            qualities: releaseQualities(title.releases),
        })),
    );

    protected selected = computed(() => {
        const groups = this.groups();
        return groups.find((group) => group.key === this.open()) ?? (this.isDesktop() ? groups[0] : undefined);
    });

    // The list only holds the releases of its own page, so an opened title is looked up on every tracker.
    private lookupParams = computed<TitleReleasesOptions | undefined>(() => {
        const title = this.selected();
        if (!title || (!title.imdbId && !title.title)) return undefined;

        const tracker = this.tracker();
        const { imdbId, title: name, year, mediaType } = title;
        return {
            imdbId,
            title: name,
            year,
            mediaType,
            filters: this.activeFilters(),
            trackers: tracker ? [tracker] : [],
        };
    });
    private lookupResource = resource({
        params: () => this.lookupParams(),
        loader: ({ params }) => this.search.titleReleases(params),
    });

    protected lookupBusy = this.lookupResource.isLoading;
    protected lookupFailures = computed(() => {
        const error = this.lookupResource.error();
        if (error) {
            return [{ heading: 'Loading all releases failed', detail: extractHttpError(error, 'Lookup failed') }];
        }
        return trackerFailureNotices(this.lookupResource.hasValue() ? this.lookupResource.value().failures : []);
    });

    protected shownReleases = computed(() => {
        const listed = this.selected()?.releases ?? [];
        const found = this.lookupResource.hasValue() ? this.lookupResource.value().releases : [];
        const unique = new Map([...listed, ...found].map((release) => [release.tracker + release.torrentId, release]));
        return sortReleases([...unique.values()], this.sort());
    });

    protected trackerStatus = computed<StatusCell | null>(() => {
        if (!this.selected()) return null;
        const releases = this.shownReleases();
        const count = releases.length;
        const trackerCount = new Set(releases.map((release) => release.tracker)).size;
        return {
            value: `${count} ${count === 1 ? 'release' : 'releases'}`,
            detail: [
                `on ${trackerCount} ${trackerCount === 1 ? 'tracker' : 'trackers'}`,
                releaseResolutions(releases).join(', '),
            ]
                .filter(Boolean)
                .join(' · '),
        };
    });

    protected libraryStatus = computed<StatusCell | null>(() => {
        const metadata = this.selected()?.metadata;
        if (!metadata) return { value: 'Unknown title', detail: 'No metadata found for this release' };
        return metadata.inJellyfinLibrary ? { value: 'In library', tone: 'yes' } : { value: 'Not in the library' };
    });

    protected isFollowing(group: TitleGroup): boolean {
        return !!group.metadata && !!this.watchlist.find(group.metadata.tmdbId, group.metadata.mediaType);
    }

    protected onSearch(params: FilterSearchSubmit): void {
        const category = parseCategory(params.filters['category']);
        const filters = parseReleaseFilters(params.filters['filters']);
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                q: params.query.trim() || null,
                category: category !== 'all' ? category : null,
                filters: filters.length > 0 ? filters.join(',') : null,
                tracker: this.tracker(),
                sort: this.currentSort().param,
            },
        });
    }

    protected onPage(event: PageEvent): void {
        this.layout().scrollListToTop();
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { page: event.pageIndex > 0 ? event.pageIndex + 1 : null, open: null },
            queryParamsHandling: 'merge',
        });
    }
}

function parseCategory(value: unknown): ReleaseCategory {
    return VALID_CATEGORIES.find((category) => category === value) ?? 'all';
}

function parseSort(value: unknown): ReleaseSort {
    return value === 'size' ? 'size' : 'seeders';
}

function parseTracker(value: unknown): TrackerId | null {
    return TRACKERS.find((tracker) => tracker.id === value)?.id ?? null;
}
