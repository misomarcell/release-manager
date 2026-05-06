import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { Location } from '@angular/common';
import { MatAccordion } from '@angular/material/expansion';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { LibraryCardComponent } from '../library-card/library-card';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { LibraryService } from '../../services/library.service';
import { ActivatedRoute } from '@angular/router';
import type { LibraryItem } from '@rm/shared/jellyfin.models';
import type { MediaType } from '@rm/shared/tmdb.models';

const PAGE_SIZE = 30;
type LibraryMediaFilter = MediaType | 'all';
const VALID_MEDIA_FILTERS: LibraryMediaFilter[] = ['all', 'movie', 'tv'];
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
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit {
    private libraryService = inject(LibraryService);
    private location = inject(Location);
    private route = inject(ActivatedRoute);
    private librarySearch = viewChild(FilterSearchComponent);

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

    ngOnInit(): void {
        const params = this.route.snapshot.queryParams;
        const search = typeof params['q'] === 'string' ? params['q'] : '';
        const mediaType = this.getMediaTypeFilter(params['type']);
        this.activeSearch.set(search);
        this.mediaTypeFilter.set(mediaType);

        const page = parseInt(params['page'], 10);
        if (page > 0) {
            this.currentPage.set(page);
        }

        queueMicrotask(() => this.librarySearch()?.setState(search, { mediaType }));
        void this.loadItems();
    }

    protected onSearch(params: FilterSearchSubmit): void {
        this.activeSearch.set(params.query);
        this.mediaTypeFilter.set(this.getMediaTypeFilter(params.filters['mediaType']));
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

    private syncQueryParams(): void {
        const params: Record<string, string> = {};
        if (this.activeSearch().trim()) params['q'] = this.activeSearch().trim();
        if (this.mediaTypeFilter() !== 'all') params['type'] = this.mediaTypeFilter();
        if (this.currentPage() > 1) params['page'] = String(this.currentPage());
        const qs = new URLSearchParams(params).toString();
        this.location.replaceState('/library', qs);
    }

    private getMediaTypeFilter(value: unknown): LibraryMediaFilter {
        return typeof value === 'string' && (VALID_MEDIA_FILTERS as string[]).includes(value)
            ? (value as LibraryMediaFilter)
            : 'all';
    }
}
