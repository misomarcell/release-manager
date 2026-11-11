import { Component, computed, inject, input, resource, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { ListDetailComponent } from '../list-detail/list-detail';
import { ReleaseListComponent } from '../release-list/release-list';
import { RowSkeletonsComponent } from '../row-skeletons/row-skeletons';
import { TitleDetailComponent, type StatusCell } from '../title-detail/title-detail';
import { TitleRowComponent } from '../title-row/title-row';
import { SearchService } from '../../services/search.service';
import { WatchlistService } from '../../services/watchlist.service';
import { injectIsDesktop } from '../../utils/breakpoint';
import { extractHttpError } from '../../utils/http-error';
import { parsePage, parseQuery } from '../../utils/query-params';
import { releaseResolutions } from '../../utils/release-view';
import { cleanSearchTerm } from '../../utils/search-term';
import { TRACKERS, type TrackerId } from '@rm/shared/tracker.models';
import type { NcoreCategoryKey, NcoreResult } from '@rm/shared/ncore.models';

const PAGE_SIZE = 100;
const VALID_CATEGORIES: NcoreCategoryKey[] = ['all', 'movies', 'tv'];
const HEADINGS: Record<NcoreCategoryKey, string> = {
    all: 'Top releases',
    movies: 'Top movies',
    tv: 'Top TV shows',
};
const RELEASE_SEARCH_FILTERS: SearchFilterDefinition[] = [
    {
        key: 'category',
        label: 'Category',
        control: 'select',
        defaultValue: 'all',
        options: [
            { value: 'all', label: 'All' },
            { value: 'movies', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
        ],
    },
    {
        key: 'uhdOnly',
        label: 'Quality',
        control: 'toggle',
        defaultValue: false,
        options: [{ value: 'true', label: '4K only' }],
    },
];

interface TitleGroup {
    key: string;
    title: string;
    metadata: NcoreResult['metadata'];
    imdbId: string;
    releases: NcoreResult[];
    resolutions: string[];
    topSeeders: number;
}

@Component({
    selector: 'app-releases',
    imports: [
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatPaginatorModule,
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
    category = input<NcoreCategoryKey, unknown>('all', { transform: parseCategory });
    uhd = input(false, { transform: (value: string | undefined) => value === 'true' });
    tracker = input<TrackerId | null, unknown>(null, { transform: parseTracker });
    page = input(1, { transform: parsePage });
    open = input('', { transform: parseQuery });

    protected releaseFilters = RELEASE_SEARCH_FILTERS;
    protected trackers = TRACKERS;
    protected pageSize = PAGE_SIZE;
    protected searchFilterValues = computed(() => ({ category: this.category(), uhdOnly: this.uhd() }));
    protected trackerLabel = computed(
        () => TRACKERS.find((tracker) => tracker.id === this.tracker())?.name ?? 'All trackers',
    );

    private searchResource = resource({
        params: () => ({ query: this.q(), category: this.category(), uhd: this.uhd(), page: this.page() }),
        loader: ({ params }) =>
            this.search.search({ ...params, perPage: PAGE_SIZE, uhd: !params.query && params.uhd }),
    });

    protected loading = this.searchResource.isLoading;
    protected error = computed(() => {
        const error = this.searchResource.error();
        return error ? extractHttpError(error, 'Search failed') : null;
    });
    protected totalResults = computed(() =>
        this.searchResource.hasValue() ? this.searchResource.value().totalResults : 0,
    );
    protected pageCount = computed(() => Math.max(1, Math.ceil(this.totalResults() / PAGE_SIZE)));

    protected heading = computed(() => {
        const query = this.q();
        if (query) return `Results for “${query}”`;
        return HEADINGS[this.category()];
    });

    protected groups = computed(() => {
        const tracker = this.tracker();
        const results = this.searchResource.hasValue() ? this.searchResource.value().results : [];
        const byKey = new Map<string, NcoreResult[]>();
        for (const result of results) {
            if (tracker && result.tracker !== tracker) continue;
            const key = result.imdb_id || `${result.metadata_lookup.title}::${result.metadata_lookup.year}`;
            byKey.set(key, [...(byKey.get(key) ?? []), result]);
        }
        return [...byKey].map(([key, releases]): TitleGroup => {
            const metadata = releases.find((release) => release.metadata)?.metadata ?? null;
            return {
                key,
                title: metadata?.title || releases[0].metadata_lookup.title,
                metadata,
                imdbId: releases[0].imdb_id,
                releases,
                resolutions: releaseResolutions(releases),
                topSeeders: Math.max(...releases.map((release) => release.seeders)),
            };
        });
    });

    protected selected = computed(() => {
        const groups = this.groups();
        return groups.find((group) => group.key === this.open()) ?? (this.isDesktop() ? groups[0] : undefined);
    });

    protected trackerStatus = computed<StatusCell | null>(() => {
        const group = this.selected();
        if (!group) return null;
        const count = group.releases.length;
        const trackerCount = new Set(group.releases.map((release) => release.tracker)).size;
        return {
            value: `${count} ${count === 1 ? 'release' : 'releases'}`,
            detail: [`on ${trackerCount} ${trackerCount === 1 ? 'tracker' : 'trackers'}`, group.resolutions.join(', ')]
                .filter(Boolean)
                .join(' · '),
        };
    });

    protected libraryStatus = computed<StatusCell | null>(() => {
        const metadata = this.selected()?.metadata;
        if (!metadata) return { value: 'Unknown title', detail: 'No metadata found for this release' };
        return metadata.inJellyfinLibrary ? { value: 'In library', tone: 'yes' } : { value: 'Not in the library' };
    });

    protected titleQuery = computed(() => {
        const group = this.selected();
        const query = group ? cleanSearchTerm(group.title) : '';
        return query && query.toLocaleLowerCase() !== cleanSearchTerm(this.q()).toLocaleLowerCase() ? query : null;
    });

    protected isFollowing(group: TitleGroup): boolean {
        return !!group.metadata && !!this.watchlist.find(group.metadata.tmdbId, group.metadata.mediaType);
    }

    protected onSearch(params: FilterSearchSubmit): void {
        const category = parseCategory(params.filters['category']);
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                q: params.query.trim() || null,
                category: category !== 'all' ? category : null,
                uhd: params.filters['uhdOnly'] === true ? 'true' : null,
                tracker: this.tracker(),
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

function parseCategory(value: unknown): NcoreCategoryKey {
    return VALID_CATEGORIES.find((category) => category === value) ?? 'all';
}

function parseTracker(value: unknown): TrackerId | null {
    return TRACKERS.find((tracker) => tracker.id === value)?.id ?? null;
}
