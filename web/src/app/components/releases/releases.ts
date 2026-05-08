import { ChangeDetectionStrategy, Component, inject, signal, computed, viewChild } from '@angular/core';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAccordion } from '@angular/material/expansion';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { ReleaseCardComponent } from '../release-card/release-card';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { SearchService } from '../../services/search.service';
import { TitleService } from '../../services/title.service';
import { ActivatedRoute, Params } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { NcoreCategoryKey, NcoreResult } from '@rm/shared/ncore.models';
import { extractHttpError } from '../../utils/http-error';
import { FilterStateStorage } from '../../services/filter-state-storage.service';

const VALID_CATEGORIES: NcoreCategoryKey[] = ['all', 'movies', 'tv'];
const LEGACY_RELEASE_FILTER_STORAGE_KEY = 'movie-releases.releases.filters';
const RELEASE_FILTER_STORAGE_KEY = 'movie-releases.releases.filters.v2';
const RELEASE_FILTER_QUERY_KEYS = ['q', 'category', 'uhd'];
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

interface ReleaseSearchState {
    query: string;
    filters: {
        category?: NcoreCategoryKey;
        uhdOnly?: boolean;
    };
}

export interface GroupedMovie {
    key: string;
    metadata: NcoreResult['metadata'];
    metadata_lookup: NcoreResult['metadata_lookup'];
    imdb_id: string;
    releases: NcoreResult[];
}

@Component({
    selector: 'app-releases',
    imports: [
        MatButtonModule,
        MatIconModule,
        MatAccordion,
        MatPaginatorModule,
        ReleaseCardComponent,
        FilterSearchComponent,
    ],
    templateUrl: './releases.html',
    styleUrl: './releases.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleasesComponent {
    private search = inject(SearchService);
    private location = inject(Location);
    private route = inject(ActivatedRoute);
    private releaseSearch = viewChild(FilterSearchComponent);
    private titleService = inject(TitleService);
    private filterStateStorage = inject(FilterStateStorage);

    protected releaseFilters = RELEASE_SEARCH_FILTERS;
    protected loading = signal(false);
    protected error = signal<string | null>(null);
    private results = signal<NcoreResult[]>([]);
    protected readonly skeletonItems = [0, 1, 2, 3, 4, 5];
    protected totalResults = signal(0);
    protected currentPage = signal(1);
    protected readonly pageSize = 100;
    private activeSearch = signal('');
    private categoryFilter = signal<NcoreCategoryKey>('all');
    private uhdOnlyFilter = signal(false);

    protected groupedMovies = computed(() => {
        const results = this.results();
        const groups = new Map<string, GroupedMovie>();
        for (const r of results) {
            const key = r.imdb_id || `${r.metadata_lookup.title}::${r.metadata_lookup.year}`;
            const existing = groups.get(key);
            if (existing) {
                existing.releases.push(r);
                if (!existing.metadata && r.metadata) {
                    existing.metadata = r.metadata;
                }
            } else {
                groups.set(key, {
                    key,
                    metadata: r.metadata,
                    metadata_lookup: r.metadata_lookup,
                    imdb_id: r.imdb_id,
                    releases: [r],
                });
            }
        }
        return [...groups.values()];
    });

    constructor() {
        this.filterStateStorage.remove(LEGACY_RELEASE_FILTER_STORAGE_KEY);
        this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
            const state = this.resolveSearchState(params);
            this.applySearchState(state);
            this.currentPage.set(this.getPageParam(params['page']));
            queueMicrotask(() =>
                this.releaseSearch()?.setState(state.query, {
                    category: this.categoryFilter(),
                    uhdOnly: this.uhdOnlyFilter(),
                }),
            );
            void this.loadResults();
        });
    }

    protected onSearch(params: FilterSearchSubmit): void {
        this.applySearchState({
            query: params.query,
            filters: {
                category: this.getCategoryFilter(params.filters['category']),
                uhdOnly: params.filters['uhdOnly'] === true,
            },
        });
        this.currentPage.set(1);
        void this.loadResults();
    }

    protected onSearchByTitle(title: string): void {
        this.releaseSearch()?.setQuery(title);
    }

    protected onPage(event: PageEvent): void {
        const page = event.pageIndex + 1;
        this.currentPage.set(page);
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        void this.loadResults();
    }

    private async loadResults(): Promise<void> {
        const query = this.activeSearch();
        const category = this.categoryFilter();
        const uhdOnly = this.uhdOnlyFilter();
        const page = this.currentPage();

        this.loading.set(true);
        this.error.set(null);
        this.syncQueryParams(query, category, uhdOnly, page);
        this.persistSearchState(query, category, uhdOnly);
        const hasSearchTerm = !!query.trim();
        this.titleService.setTitle(
            hasSearchTerm
                ? `Results for: ${query.trim()}`
                : category === 'movies'
                  ? 'Top Movies'
                  : category === 'tv'
                    ? 'Top TV Shows'
                    : 'Top Releases',
        );
        try {
            const response = await this.search.search(category, query, page, this.pageSize, !hasSearchTerm && uhdOnly);
            this.results.set(response.results);
            this.totalResults.set(response.totalResults);
        } catch (e: unknown) {
            this.error.set(extractHttpError(e, 'Search failed'));
            this.results.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    private resolveSearchState(params: Params): ReleaseSearchState {
        const queryState = this.searchStateFromQueryParams(params);
        if (this.hasFilterQueryParams(params)) {
            return queryState;
        }

        return this.filterStateStorage.read(RELEASE_FILTER_STORAGE_KEY, isReleaseSearchState) ?? queryState;
    }

    private searchStateFromQueryParams(params: Params): ReleaseSearchState {
        return {
            query: typeof params['q'] === 'string' ? params['q'].trim() : '',
            filters: {
                category: this.getCategoryFilter(params['category']),
                uhdOnly: params['uhd'] === 'true',
            },
        };
    }

    private applySearchState(state: ReleaseSearchState): void {
        this.activeSearch.set(state.query.trim());
        this.categoryFilter.set(this.getCategoryFilter(state.filters.category));
        this.uhdOnlyFilter.set(state.filters.uhdOnly === true);
    }

    private syncQueryParams(query: string, category: NcoreCategoryKey, uhdOnly: boolean, page: number): void {
        const params: Record<string, string> = {};
        if (query.trim()) params['q'] = query.trim();
        if (category !== 'all') params['category'] = category;
        if (uhdOnly) params['uhd'] = 'true';
        if (page > 1) params['page'] = String(page);
        this.location.replaceState('/releases', new URLSearchParams(params).toString());
    }

    private persistSearchState(query: string, category: NcoreCategoryKey, uhdOnly: boolean): void {
        const filters: ReleaseSearchState['filters'] = {};
        if (category !== 'all') {
            filters.category = category;
        }
        if (uhdOnly) {
            filters.uhdOnly = true;
        }

        this.filterStateStorage.write(RELEASE_FILTER_STORAGE_KEY, {
            query: query.trim(),
            filters,
        } satisfies ReleaseSearchState);
    }

    private hasFilterQueryParams(params: Params): boolean {
        return RELEASE_FILTER_QUERY_KEYS.some((key) => Object.prototype.hasOwnProperty.call(params, key));
    }

    private getPageParam(value: unknown): number {
        return Math.max(1, parseInt(typeof value === 'string' ? value : '', 10) || 1);
    }

    private getCategoryFilter(value: unknown): NcoreCategoryKey {
        return typeof value === 'string' && (VALID_CATEGORIES as string[]).includes(value)
            ? (value as NcoreCategoryKey)
            : 'all';
    }
}

function isReleaseSearchState(value: unknown): value is ReleaseSearchState {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const state = value as Partial<ReleaseSearchState>;
    const filters = state.filters as Partial<ReleaseSearchState['filters']> | undefined;
    return (
        typeof state.query === 'string' &&
        !!filters &&
        (filters.category === undefined ||
            (typeof filters.category === 'string' && (VALID_CATEGORIES as string[]).includes(filters.category))) &&
        (filters.uhdOnly === undefined || typeof filters.uhdOnly === 'boolean')
    );
}
