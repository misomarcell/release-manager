import { Component, inject, signal, viewChild } from '@angular/core';
import { Location } from '@angular/common';
import { MatAccordion } from '@angular/material/expansion';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { LibraryCardComponent } from '../library-card/library-card';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { LibraryService } from '../../services/library.service';
import { ActivatedRoute, Params } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { LibraryItem } from '@rm/shared/jellyfin.models';
import type { MediaType } from '@rm/shared/tmdb.models';
import { FilterStateStorage } from '../../services/filter-state-storage.service';

const PAGE_SIZE = 30;
type LibraryMediaFilter = MediaType | 'all';
const VALID_MEDIA_FILTERS: LibraryMediaFilter[] = ['all', 'movie', 'tv'];
const LIBRARY_FILTER_STORAGE_KEY = 'movie-releases.library.filters';
const LIBRARY_FILTER_QUERY_KEYS = ['q', 'type'];
const LIBRARY_SEARCH_FILTERS: SearchFilterDefinition[] = [
    {
        key: 'mediaType',
        label: 'Media type',
        control: 'select',
        defaultValue: 'all',
        options: [
            { value: 'all', label: 'Both' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
        ],
    },
];

interface LibrarySearchState {
    query: string;
    filters: {
        mediaType: LibraryMediaFilter;
    };
}

@Component({
    selector: 'app-library',
    imports: [
        MatAccordion,
        MatPaginatorModule,
        FilterSearchComponent,
        LibraryCardComponent,
    ],
    templateUrl: './library.html',
    styleUrl: './library.scss',
})
export class LibraryComponent {
    private libraryService = inject(LibraryService);
    private location = inject(Location);
    private route = inject(ActivatedRoute);
    private librarySearch = viewChild(FilterSearchComponent);
    private filterStateStorage = inject(FilterStateStorage);

    protected libraryFilters = LIBRARY_SEARCH_FILTERS;
    protected loading = signal(false);
    protected error = signal<string | null>(null);
    protected items = signal<LibraryItem[]>([]);
    protected total = signal(0);
    protected currentPage = signal(1);
    protected jellyfinBaseUrl = signal('');
    protected activeSearch = signal('');
    protected mediaTypeFilter = signal<LibraryMediaFilter>('all');
    protected readonly pageSize = PAGE_SIZE;
    protected readonly skeletonItems = [0, 1, 2, 3, 4];

    constructor() {
        this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
            const state = this.resolveSearchState(params);
            this.applySearchState(state);
            this.currentPage.set(this.getPageParam(params['page']));
            queueMicrotask(() => this.librarySearch()?.setState(state.query, state.filters));
            void this.loadItems();
        });
    }

    protected onSearch(params: FilterSearchSubmit): void {
        this.applySearchState({
            query: params.query,
            filters: {
                mediaType: this.getMediaTypeFilter(params.filters['mediaType']),
            },
        });
        this.currentPage.set(1);
        void this.loadItems();
    }

    protected mediaTypeLabel(): string {
        return this.mediaTypeFilter() === 'movie' ? 'movies' : 'TV shows';
    }

    protected onPage(event: PageEvent): void {
        this.currentPage.set(event.pageIndex + 1);
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        void this.loadItems();
    }

    protected onItemDeleted(jellyfinId: string): void {
        this.items.update((items) => items.filter((item) => item.jellyfinId !== jellyfinId));
        this.total.update((total) => Math.max(0, total - 1));
    }

    private async loadItems(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);
        this.syncQueryParams();
        this.persistSearchState();

        try {
            const mediaType = this.mediaTypeFilter();
            const response = await this.libraryService.getLibrary(
                this.activeSearch(),
                this.currentPage(),
                this.pageSize,
                mediaType === 'all' ? null : mediaType,
            );
            this.items.set(response.items);
            this.total.set(response.total);
            this.jellyfinBaseUrl.set(response.jellyfinBaseUrl);
        } catch (e: unknown) {
            this.error.set(e instanceof Error ? e.message : 'Failed to load library');
            this.items.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    private resolveSearchState(params: Params): LibrarySearchState {
        const queryState = this.searchStateFromQueryParams(params);
        if (this.hasFilterQueryParams(params)) {
            return queryState;
        }

        return this.filterStateStorage.read(LIBRARY_FILTER_STORAGE_KEY, isLibrarySearchState) ?? queryState;
    }

    private searchStateFromQueryParams(params: Params): LibrarySearchState {
        return {
            query: typeof params['q'] === 'string' ? params['q'].trim() : '',
            filters: {
                mediaType: this.getMediaTypeFilter(params['type']),
            },
        };
    }

    private applySearchState(state: LibrarySearchState): void {
        this.activeSearch.set(state.query.trim());
        this.mediaTypeFilter.set(state.filters.mediaType);
    }

    private syncQueryParams(): void {
        const params: Record<string, string> = {};
        if (this.activeSearch().trim()) params['q'] = this.activeSearch().trim();
        if (this.mediaTypeFilter() !== 'all') params['type'] = this.mediaTypeFilter();
        if (this.currentPage() > 1) params['page'] = String(this.currentPage());
        const qs = new URLSearchParams(params).toString();
        this.location.replaceState('/library', qs);
    }

    private persistSearchState(): void {
        this.filterStateStorage.write(LIBRARY_FILTER_STORAGE_KEY, {
            query: this.activeSearch().trim(),
            filters: { mediaType: this.mediaTypeFilter() },
        } satisfies LibrarySearchState);
    }

    private hasFilterQueryParams(params: Params): boolean {
        return LIBRARY_FILTER_QUERY_KEYS.some((key) => Object.prototype.hasOwnProperty.call(params, key));
    }

    private getPageParam(value: unknown): number {
        return Math.max(1, parseInt(typeof value === 'string' ? value : '', 10) || 1);
    }

    private getMediaTypeFilter(value: unknown): LibraryMediaFilter {
        return typeof value === 'string' && (VALID_MEDIA_FILTERS as string[]).includes(value)
            ? (value as LibraryMediaFilter)
            : 'all';
    }
}

function isLibrarySearchState(value: unknown): value is LibrarySearchState {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const state = value as Partial<LibrarySearchState>;
    const filters = state.filters as Partial<LibrarySearchState['filters']> | undefined;
    return (
        typeof state.query === 'string' &&
        !!filters &&
        typeof filters.mediaType === 'string' &&
        (VALID_MEDIA_FILTERS as string[]).includes(filters.mediaType)
    );
}
