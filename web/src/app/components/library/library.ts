import { Component, computed, inject, input, resource } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatAccordion } from '@angular/material/expansion';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { LibraryCardComponent } from '../library-card/library-card';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { LibraryService } from '../../services/library.service';
import { ActivatedRoute, Router } from '@angular/router';
import type { MediaType } from '@rm/shared/tmdb.models';
import { parsePage, parseQuery } from '../../utils/query-params';
import { extractHttpError } from '../../utils/http-error';

const PAGE_SIZE = 30;
const GIBIBYTE = 1_073_741_824;
const TEBIBYTE = 1_024 * GIBIBYTE;
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
        DecimalPipe,
        FilterSearchComponent,
        LibraryCardComponent,
    ],
    templateUrl: './library.html',
    styleUrl: './library.scss',
})
export class LibraryComponent {
    private libraryService = inject(LibraryService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    q = input('', { transform: parseQuery });
    type = input<LibraryMediaFilter, unknown>('all', { transform: parseMediaType });
    page = input(1, { transform: parsePage });

    protected libraryFilters = LIBRARY_SEARCH_FILTERS;
    protected searchFilterValues = computed(() => ({ mediaType: this.type() }));
    protected readonly pageSize = PAGE_SIZE;
    protected readonly skeletonItems = [0, 1, 2, 3, 4];

    private library = resource({
        params: () => ({ query: this.q(), type: this.type(), page: this.page() }),
        loader: ({ params }) =>
            this.libraryService.getLibrary(
                params.query,
                params.page,
                this.pageSize,
                params.type === 'all' ? null : params.type,
            ),
    });

    protected loading = this.library.isLoading;
    protected error = computed(() => {
        const error = this.library.error();
        return error ? extractHttpError(error, 'Failed to load library') : null;
    });
    protected items = computed(() => (this.library.hasValue() ? this.library.value().items : []));
    protected total = computed(() => (this.library.hasValue() ? this.library.value().total : 0));
    protected jellyfinBaseUrl = computed(() => (this.library.hasValue() ? this.library.value().jellyfinBaseUrl : ''));
    protected remainingSpace = computed(() => {
        const bytes = this.library.hasValue() ? this.library.value().freeSpaceOnDisk : null;
        if (bytes === null) return null;

        return bytes >= TEBIBYTE
            ? { amount: bytes / TEBIBYTE, unit: 'TiB' }
            : { amount: bytes / GIBIBYTE, unit: 'GiB' };
    });

    protected onSearch(params: FilterSearchSubmit): void {
        const query = params.query.trim();
        const mediaType = parseMediaType(params.filters['mediaType']);
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                q: query || null,
                type: mediaType !== 'all' ? mediaType : null,
            },
        });
    }

    protected mediaTypeLabel(): string {
        return this.type() === 'movie' ? 'movies' : 'TV shows';
    }

    protected onPage(event: PageEvent): void {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { page: event.pageIndex > 0 ? event.pageIndex + 1 : null },
            queryParamsHandling: 'merge',
        });
    }

    protected onItemDeleted(jellyfinId: string): void {
        this.library.update(
            (response) =>
                response && {
                    ...response,
                    items: response.items.filter((item) => item.jellyfinId !== jellyfinId),
                    total: Math.max(0, response.total - 1),
                },
        );
    }
}

function parseMediaType(value: unknown): LibraryMediaFilter {
    return typeof value === 'string' && (VALID_MEDIA_FILTERS as string[]).includes(value)
        ? (value as LibraryMediaFilter)
        : 'all';
}
