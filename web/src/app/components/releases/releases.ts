import { Component, inject, computed, viewChild, input, effect, resource } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAccordion } from '@angular/material/expansion';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { ReleaseCardComponent } from '../release-card/release-card';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { SearchService } from '../../services/search.service';
import { TitleService } from '../../services/title.service';
import { ActivatedRoute, Router } from '@angular/router';
import type { NcoreCategoryKey, NcoreResult } from '@rm/shared/ncore.models';
import { extractHttpError } from '../../utils/http-error';
import { parsePage, parseQuery } from '../../utils/query-params';

const VALID_CATEGORIES: NcoreCategoryKey[] = ['all', 'movies', 'tv'];
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
})
export class ReleasesComponent {
    private search = inject(SearchService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private releaseSearch = viewChild(FilterSearchComponent);
    private titleService = inject(TitleService);

    q = input('', { transform: parseQuery });
    category = input<NcoreCategoryKey, unknown>('all', { transform: parseCategory });
    uhd = input(false, { transform: (value: string | undefined) => value === 'true' });
    page = input(1, { transform: parsePage });

    protected releaseFilters = RELEASE_SEARCH_FILTERS;
    protected searchFilterValues = computed(() => ({ category: this.category(), uhdOnly: this.uhd() }));
    protected readonly skeletonItems = [0, 1, 2, 3, 4, 5];
    protected readonly pageSize = 100;

    private searchResource = resource({
        params: () => ({ query: this.q(), category: this.category(), uhd: this.uhd(), page: this.page() }),
        loader: ({ params }) =>
            this.search.search(params.category, params.query, params.page, this.pageSize, !params.query && params.uhd),
    });

    protected loading = this.searchResource.isLoading;
    protected error = computed(() => {
        const error = this.searchResource.error();
        return error ? extractHttpError(error, 'Search failed') : null;
    });
    private results = computed(() => (this.searchResource.hasValue() ? this.searchResource.value().results : []));
    protected totalResults = computed(() =>
        this.searchResource.hasValue() ? this.searchResource.value().totalResults : 0,
    );

    private pageTitle = computed(() => {
        const query = this.q();
        if (query) return `Results for: ${query}`;
        const category = this.category();
        return category === 'movies' ? 'Top Movies' : category === 'tv' ? 'Top TV Shows' : 'Top Releases';
    });

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
        effect(() => this.titleService.setTitle(this.pageTitle()));
    }

    protected onSearch(params: FilterSearchSubmit): void {
        const query = params.query.trim();
        const category = parseCategory(params.filters['category']);
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                q: query || null,
                category: category !== 'all' ? category : null,
                uhd: params.filters['uhdOnly'] === true ? 'true' : null,
            },
        });
    }

    protected onSearchByTitle(title: string): void {
        this.releaseSearch()?.setQuery(title);
    }

    protected onPage(event: PageEvent): void {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { page: event.pageIndex > 0 ? event.pageIndex + 1 : null },
            queryParamsHandling: 'merge',
        });
    }
}

function parseCategory(value: unknown): NcoreCategoryKey {
    return typeof value === 'string' && (VALID_CATEGORIES as string[]).includes(value)
        ? (value as NcoreCategoryKey)
        : 'all';
}
